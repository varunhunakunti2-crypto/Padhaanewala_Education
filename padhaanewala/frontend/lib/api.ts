import type { StudentProfile } from "@/lib/types";
// Type-only, so nothing in the server-side client is pulled into the browser
// bundle. These are the single source of truth for the college shapes; the
// read-only list type is already imported from here by `CollegesSection`.
import type { ApiCollegeDetail, ApiCollegeListItem } from "@/lib/api-server";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/+$/, "");

const USER_KEY = "cp_user";

/**
 * Credentials written by builds that predate Phase 3.6.
 *
 * The access token lived in `localStorage` until this change, so any browser
 * that has ever signed in still has a long-lived JWT sitting in local storage,
 * where every npm dependency, every extension and any injected script can read
 * it. Moving the *new* token to memory is only half the fix: without an explicit
 * purge, the old one is still there, still valid for 30 minutes, and still
 * exfiltratable. `purgeLegacyTokenStorage` deletes these on boot.
 */
const LEGACY_TOKEN_KEYS = ["cp_access_token", "cp_refresh_token"] as const;

/**
 * The access token, in memory only.
 *
 * ## Why not `localStorage`
 *
 * The OWASP Session Management Cheat Sheet is unambiguous: *"Do not store
 * authentication tokens, session IDs, JWTs, refresh tokens, or any credential in
 * `localStorage` or `sessionStorage`. These APIs are accessible to any
 * JavaScript executing in the origin, so a single XSS vulnerability discloses
 * every token."* `localStorage` is readable by first-party code, by all 373 npm
 * packages, by every browser extension with host permissions, and by any
 * injected script — and it survives the tab closing, so one XSS on any page
 * yields a credential that keeps working after the tab is gone.
 *
 * The refresh token is already an HttpOnly cookie and is unreadable from
 * JavaScript by construction. This is the same guarantee for the access token,
 * as far as it can be had: JS can still *use* the token this frame holds, but
 * cannot read it out of storage and walk away with it.
 *
 * ## What this costs
 *
 * A page load no longer restores the session from storage; it has to call
 * `/auth/refresh` and be handed a new access token. That is one extra same-origin
 * round trip before the app can know whether anyone is signed in, and it is the
 * price of the property above. `authReady` in `AppContext` gates on it so the UI
 * does not flash a signed-out state in the meantime.
 *
 * The trade is deliberate and worth stating plainly: this does **not** prevent
 * XSS. An injected script can still call the API as the user while the page is
 * open. What it removes is the durable, exfiltratable copy — the thing that
 * turns "one bad page, one afternoon" into "a credential that works for a month".
 */

/** Rotating this on every deploy invalidates every open tab at once, so no. */
const ACCESS_TOKEN_CHANNEL = "cp-access-token";
/** Cross-tab mutex name. Arbitrary, but must match across tabs of one origin. */
const REFRESH_LOCK_NAME = "cp-refresh-token-rotation";

let accessToken: string | null = null;
let accessChannel: BroadcastChannel | null = null;

function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!accessChannel) accessChannel = new BroadcastChannel(ACCESS_TOKEN_CHANNEL);
  return accessChannel;
}

/**
 * Adopt a token, and tell the other tabs about it.
 *
 * The broadcast is what makes cross-tab rotation safe: rotation is single-use
 * with reuse detection and no grace window, so two tabs refreshing at the same
 * moment would present the same refresh token, the loser would trip
 * `RefreshReuseDetected`, and the whole family would be revoked — signing the
 * user out of every tab through no action of their own. See `withRefreshLock`.
 */
function setAccessToken(next: string | null, broadcast = true): void {
  accessToken = next;
  if (next && broadcast) {
    try {
      ensureChannel()?.postMessage({ type: "access-token", token: next });
    } catch {
      // A closed channel must not fail a successful sign-in.
    }
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Delete the tokens earlier builds wrote to `localStorage`.
 *
 * Idempotent, and safe to call on every boot. Called from `AppContext` during
 * hydration; the keys are already gone for a fresh visitor, and for anyone who
 * signed in before this change this is the step that actually removes the
 * exposure.
 */
export function purgeLegacyTokenStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_TOKEN_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Private-mode Safari can throw on storage access; the token is in memory
      // either way, so there is nothing to recover from here.
    }
  }
}

/** Adopt a token handed over by another tab, without persisting it. */
export function adoptAccessToken(token: string | null): void {
  if (token) setAccessToken(token, false);
  else accessToken = null;
}

export class ApiError extends Error {
  status: number;
  /**
   * The raw `detail` from the response body, kept as-is.
   *
   * Most endpoints return a plain string, but `POST /auth/login` returns a
   * structured object when the account exists and its email is unconfirmed
   * (`{ code: "email_not_verified", email, resend_endpoint }`). Collapsing that
   * to a string — as the previous message-building code did — threw away the one
   * field the login screen needs in order to offer a resend instead of asking
   * for the password again.
   */
  detail?: unknown;

  constructor(message: string, status = 0, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface AuthTokens {
  access_token: string;
  // Phase 3: the refresh token no longer travels in the body — it is an
  // HttpOnly cookie the browser carries for us (see refreshAccessToken).
  refresh_token: string | null;
  token_type?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  /**
   * Required by `RegisterRequest.age_band` with no default
   * (`backend/app/schemas/auth.py`).
   *
   * It was added to the backend as part of Phase 9.1 and this type was not
   * updated with it, so every signup from the UI answered 422 for as long as
   * that lasted — a silently broken registration form that type checking,
   * linting and a full production build were all perfectly happy with, because
   * a missing property is not a type error when the type is the thing that is
   * wrong.
   *
   * A band rather than a date of birth: s.9 turns only on whether the user is
   * under 18, and s.5(1)(ii) requires collecting no more than necessary.
   */
  age_band: AgeBand;
}

export interface UserMe {
  id: number;
  email: string;
  mobile: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_mobile_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserRoles {
  roles: string[];
}

export interface BackendProfile {
  id: number;
  email: string;
  mobile: string;
  name: string;
  education_level: string | null;
  course_interest: string | null;
  preferred_state: string | null;
  preferred_city: string | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
}

export interface EnquiryPayload {
  name: string;
  mobile: string;
  email?: string | null;
  course_id?: number | null;
  college_id?: number | null;
  state_id?: number | null;
  city?: string | null;
  qualification?: string | null;
  message?: string | null;
  source?: string | null;
  source_url?: string | null;
  device_type?: string | null;
  /**
   * Required by `EnquiryCreate.age_band`, no default
   * (`backend/app/schemas/catalog.py`).
   *
   * This endpoint is unauthenticated, so the account age gate cannot reach it,
   * and it is the widest collector of minors' personal data on the site — which
   * is why the backend refuses it without an answer rather than defaulting to
   * adult. `guardian_contact` is conditionally required when this is
   * `under_18`; the form collects it only in that case.
   */
  age_band: AgeBand;
  guardian_contact?: string | null;
}

export interface EnquiryResponse {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  status: string;
  created_at: string;
}

export interface CatalogStats {
  /** True only when every catalogue endpoint answered. See `failed`. */
  ok: boolean;
  colleges: number;
  courses: number;
  exams: number;
  scholarships: number;
  blogs: number;
  mockTests: number;
  /** Per-source outcome, so a zero can be told apart from a source that is down. */
  sourceStatus?: Record<string, "ok" | "error">;
  /** Names of the sources that failed to answer. Empty when `ok` is true. */
  failed?: string[];
  /** Failure reason per failed source. */
  errors?: Record<string, string>;
  /** When these numbers were measured, as an ISO-8601 timestamp. */
  checkedAt?: string;
}

/** Mirrors the backend `GET /health` payload. */
export interface BackendHealth {
  status: "ok" | "degraded" | "unreachable";
  checks: Record<string, { ok: boolean; detail: string }>;
  error?: string;
  checkedAt?: string;
}

export const EMPTY_STATS: CatalogStats = {
  ok: false,
  colleges: 0,
  courses: 0,
  exams: 0,
  scholarships: 0,
  blogs: 0,
  mockTests: 0,
  failed: [],
  sourceStatus: {},
  errors: {},
};

export function storeAuth(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  setAccessToken(tokens.access_token);
  // A previous build may have written a refresh token here. The refresh token is
  // an HttpOnly cookie now and is never re-read from storage, but the stale copy
  // would otherwise sit in local storage for as long as the browser keeps it.
  for (const key of LEGACY_TOKEN_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable; nothing persisted to clean up */
    }
  }
}

export function getStoredUser(): BackendProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as BackendProfile) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: BackendProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  accessToken = null;
  window.localStorage.removeItem(USER_KEY);
  // Defence in depth for a rollback: if an older bundle is ever served again it
  // will look for these keys, and it should not find a live credential.
  for (const key of LEGACY_TOKEN_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetchImpl<T>(path, init, 1);
}

/**
 * Listen for an access token rotated by another tab.
 *
 * Returns an unsubscribe function. Also primes the channel, which is what makes
 * the very first cross-tab broadcast land — a channel created *after* the
 * message was sent never sees it, so a listener that attaches lazily on 401
 * would miss the token it is waiting for.
 */
export function subscribeToAccessToken(onToken: (token: string | null) => void): () => void {
  const channel = ensureChannel();
  if (!channel) return () => undefined;
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; token?: string } | null;
    if (data?.type === "access-token" && typeof data.token === "string") {
      setAccessToken(data.token, false);
      onToken(data.token);
    } else if (data?.type === "signed-out") {
      accessToken = null;
      onToken(null);
    }
  };
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

/**
 * Drop the in-memory token and tell the other tabs to do the same.
 *
 * The local clear is not a convenience — it is the point. This is called on the
 * path where `/auth/refresh` answers 401/403, meaning the session is genuinely
 * gone, and the caller then falls through to surfacing whatever request it was
 * repairing. Without clearing here, `getAccessToken()` keeps returning a dead
 * token: the UI stays signed-in-looking and every subsequent request re-sends
 * the corpse and re-401s, one repair attempt at a time.
 *
 * Only the in-memory token is cleared. `cp_user` and the legacy keys are left
 * alone, because that is `clearAuth`'s job and the two are called at different
 * points: here the user did not ask to sign out, their session simply expired,
 * and keeping the cached profile avoids a login form that has forgotten their
 * name.
 */
export function broadcastSignOut(): void {
  accessToken = null;
  try {
    ensureChannel()?.postMessage({ type: "signed-out" });
  } catch {
    /* channel closed; the local clear above is the part that matters */
  }
}

/**
 * Serialise refresh across tabs, so rotation happens at most once at a time.
 *
 * ## Why this is not optional
 *
 * Refresh tokens are single-use with reuse detection and **no grace window**
 * (`session_service.rotate` raises `RefreshReuseDetected` the moment a
 * consumed token is presented again, and the family is revoked). Two tabs that
 * refresh concurrently both send the *same* cookie; one wins, the other presents
 * an already-rotated token, and the entire family is revoked. The user is signed
 * out of every tab, on every device in that family, for doing nothing.
 *
 * Before this change that race was rare, because a page load restored the
 * session from `localStorage` and refreshed only on a 401. Making the access
 * token memory-only means *every* page load rotates, which is what makes the
 * race routine rather than rare — so the coordination has to arrive with it.
 *
 * `ifAvailable: true` is deliberate. A queued lock could block indefinitely if
 * the holding tab is frozen or backgrounded, and a page that hangs at "checking
 * your session" is worse than one that refreshes and risks a rare re-login. If
 * another tab holds the lock we wait briefly for its broadcast instead, and only
 * then fall back to refreshing ourselves.
 */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return fn();

  let result = await locks.request(REFRESH_LOCK_NAME, { ifAvailable: true }, async (lock) => {
    // `lock` is null when another tab holds it.
    return lock ? fn() : null;
  });

  if (result === null) {
    // Someone else is mid-rotation. Give their broadcast a moment to arrive.
    const broadcast = await waitForCrossTabToken();
    if (broadcast) return broadcast as T;
    // No token arrived — the other tab may have failed, been closed, or the
    // browser may not deliver broadcasts. Refreshing is the only way to learn
    // whether the session is still live, so do it.
    result = await fn();
  }
  return result;
}

/** Resolve with a token another tab broadcasts, or `null` after `ms`. */
function waitForCrossTabToken(ms = 1500): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") {
      resolve(null);
      return;
    }
    const channel = ensureChannel();
    if (!channel) {
      resolve(null);
      return;
    }
    const finish = (value: string | null) => {
      clearTimeout(timer);
      channel.removeEventListener("message", handler);
      resolve(value);
    };
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; token?: string } | null;
      if (data?.type === "access-token" && typeof data.token === "string") {
        setAccessToken(data.token, false);
        finish(data.token);
      }
    };
    const timer = setTimeout(() => finish(null), ms);
    channel.addEventListener("message", handler);
  });
}

/** Single-flight refresh of the access token via the HttpOnly refresh cookie.
 *
 * Concurrent 401s in one tab share one in-flight request instead of hammering the
 * backend with a refresh per caller, and `withRefreshLock` extends that across
 * tabs. On failure every waiter gets `null` and the caller surfaces the original
 * 401.
 *
 * ## `force`
 *
 * There are two callers with genuinely different needs, and conflating them is
 * a bug that cost a full test cycle to find:
 *
 *  - **Boot** (`AppContext`): "do I have a token, from anywhere?". If a sibling
 *    tab is already rotating, take its broadcast. Cheap, and avoids a second
 *    rotation.
 *  - **401 repair** (`apiFetchImpl`): the token in hand has just been
 *    *rejected by the server*. Returning it unchanged would retry the request
 *    with the same known-bad credential, 401 again, and hand the caller an error
 *    while leaving a dead token in memory that every later request re-sends.
 *
 * So the 401 path passes `force: true` and the shortcut below is skipped. The
 * failure mode is quiet — a user who is "signed in" and gets 401 on everything
 * until they reload — which is exactly the class of bug BUG-01 was.
 */
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(options: { force?: boolean } = {}): Promise<string | null> {
  const { force = false } = options;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      return await withRefreshLock(async (): Promise<string | null> => {
        // Another tab may have rotated while we waited for the lock. Adopting
        // its broadcast is free; rotating again would be a reuse. Skipped when
        // `force` is set, because then the token we hold is the one that was
        // just refused.
        if (accessToken && !force) return accessToken;

        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // R3.7. SameSite=strict is the primary CSRF defence; stating the
            // Origin satisfies the backend's secondary check and means a
            // cross-site caller is refused before the token is even looked up.
            Origin: window.location.origin,
          },
          body: JSON.stringify({}),
          credentials: "same-origin",
          // Without this a refresh on a slow connection hangs `authReady`
          // forever and the whole app waits behind it.
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          // 401/403 here means the session is genuinely gone — expired family,
          // revoked, or signed out elsewhere. Other tabs are holding a token that
          // no longer works, so tell them rather than leaving them to discover it
          // one 401 at a time. This also drops *our* token; see
          // `broadcastSignOut`.
          if (res.status === 401 || res.status === 403) broadcastSignOut();
          return null;
        }
        const data = (await res.json()) as AuthTokens;
        if (!data.access_token) return null;
        setAccessToken(data.access_token);
        return data.access_token;
      });
    } catch {
      // Network error or the 10s timeout. Treated as "no token", which surfaces
      // as signed-out. A transient network blip signing someone out is a lesser
      // evil than a page that never finishes hydrating.
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * True for bodies whose Content-Type the runtime already knows.
 *
 * `Blob` and `File` cover `FormData` too, since a `FormData` is not an instance
 * of either and needs its own case. `typeof` guards keep this safe to call
 * during server rendering, where only `FormData` and `URLSearchParams` are
 * defined on the Node globals but neither is reached in practice.
 */
function bodyCarriesItsOwnContentType(body: BodyInit | null | undefined): boolean {
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
  if (typeof Blob !== "undefined" && body instanceof Blob) return true;
  return body instanceof ArrayBuffer || ArrayBuffer.isView(body);
}

async function apiFetchImpl<T>(
  path: string,
  init: RequestInit,
  retriesLeft: number,
): Promise<T> {
  const headers = new Headers(init.headers);
  // `application/json` is only correct for a body the caller serialised itself.
  // A `FormData` body has to be left alone: the browser derives
  // `multipart/form-data; boundary=…` from the body, so a hand-set Content-Type
  // here either drops the boundary (Starlette cannot parse the parts, and the
  // upload 422s) or makes it look for a part named after the media type.
  // `URLSearchParams` and `Blob` are in the same position and are covered by the
  // same check rather than one caller at a time.
  if (init.body && !headers.has("Content-Type") && !bodyCarriesItsOwnContentType(init.body)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Phase 3: an expired access token is repaired once by rotating through the
  // HttpOnly refresh cookie (automatically attached for same-origin). Auth
  // endpoints are excluded: /auth/login legitimately 401s and must surface that.
  if (
    res.status === 401 &&
    retriesLeft > 0 &&
    !path.startsWith("/auth/") &&
    getAccessToken()
  ) {
    // `force`, because the token in hand is the one the server just refused.
    // Without it the refresh short-circuits and hands back the same dead token.
    const fresh = await refreshAccessToken({ force: true });
    if (fresh) {
      headers.set("Authorization", `Bearer ${fresh}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    let detail: unknown;
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data?.detail;
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((d: { msg?: string }) => d.msg ?? "")
          .filter(Boolean)
          .join(", ");
      } else if (detail && typeof detail === "object") {
        const structured = detail as { message?: string };
        if (structured.message) message = structured.message;
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<AuthTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload: RegisterPayload) =>
    apiFetch<AuthTokens>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<UserMe>("/users/me"),

  myProfile: () => apiFetch<BackendProfile>("/users/me/profile"),

  myRoles: () => apiFetch<UserRoles>("/users/me/roles"),

  /**
   * Revoke the server-side session.
   *
   * No body. The refresh token is an HttpOnly cookie the browser attaches on its
   * own, and the backend reads it from there (`auth.py:403` falls back to
   * `request.cookies`). This previously sent `{ refresh_token: … }` read from
   * local storage, which could only ever be `undefined` — the token moved to a
   * cookie in Phase 3 — so the field was always dropped by `JSON.stringify` and
   * the call looked like it needed a credential it does not have.
   */
  logout: () =>
    apiFetch<StandardActionResponse>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
      credentials: "same-origin",
    }),
};

/** Roles that may open the admin console. Mirrors the backend `require_role` gates. */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

/**
 * Mirrors `CONTENT_ROLES` in `backend/app/roles.py` — `ADMIN_ROLES` plus
 * `content_manager`.
 *
 * Gates `POST /media/upload`, `PUT /media/{id}` and `DELETE /media/{id}`. Kept
 * separate from `ADMIN_ROLES` because the two are genuinely different sets: a
 * content manager may upload a college logo without being able to edit colleges.
 */
export const CONTENT_ROLES = [...ADMIN_ROLES, "content_manager"] as const;

export function hasAdminRole(roles: readonly string[]): boolean {
  return ADMIN_ROLES.some((r) => roles.includes(r));
}

export async function fetchMyRoles(): Promise<string[]> {
  try {
    const res = await authApi.myRoles();
    return Array.isArray(res?.roles) ? res.roles : [];
  } catch {
    // A failed role lookup must never be read as "is admin".
    return [];
  }
}

export async function submitEnquiry(payload: EnquiryPayload): Promise<EnquiryResponse> {
  return apiFetch<EnquiryResponse>("/enquiries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type CourseLookupRow = { id: number; name: string; degree: string | null };

let coursesCache: CourseLookupRow[] | null = null;
let statesCache: { id: number; name: string }[] | null = null;

/**
 * Must stay in step with the backend's `le=` bound on `limit`; a value above
 * it is rejected with 422, which used to surface as a silently empty course
 * list rather than an error. Pages are walked so the lookup keeps working as
 * the catalogue grows past one page.
 */
const COURSE_PAGE_SIZE = 100;

async function courseLookup(): Promise<CourseLookupRow[]> {
  if (!coursesCache) {
    const rows: CourseLookupRow[] = [];
    for (;;) {
      const page = await apiFetch<CourseLookupRow[]>(
        `/courses?limit=${COURSE_PAGE_SIZE}&offset=${rows.length}`,
      ).catch(() => null);
      if (!Array.isArray(page) || page.length === 0) break;
      rows.push(...page);
      if (page.length < COURSE_PAGE_SIZE) break;
    }
    coursesCache = rows;
  }
  return coursesCache;
}

async function stateLookup(): Promise<NonNullable<typeof statesCache>> {
  if (!statesCache) {
    statesCache = await apiFetch<NonNullable<typeof statesCache>>("/locations/states");
  }
  return statesCache ?? [];
}

/**
 * Every state the backend knows about, for populating a dropdown.
 *
 * Exported because the admission form needs a populated `<select>` rather than a
 * bundled constant: `ALL_STATES` in `lib/data` is derived from the deliberately
 * empty `COLLEGES` array and is therefore permanently `[]`, so a required
 * "select a state" validation was rejecting every submission against a dropdown
 * with no options. Throws on failure so the caller can show free text rather
 * than an empty list.
 */
export async function fetchStateNames(): Promise<string[]> {
  return (await stateLookup()).map((s) => s.name).filter(Boolean);
}

/**
 * Course names, from the live catalogue, for the same reason as
 * `fetchStateNames`. Falls back to the course's `degree` label when a row has no
 * name, and de-duplicates case-insensitively so the dropdown does not list
 * "B.Tech" and "B.Tech " as two options.
 */
export async function fetchCourseNames(): Promise<string[]> {
  const list = await courseLookup();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of list) {
    const label = (row.name || row.degree || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export async function resolveCourseId(name: string): Promise<number | null> {
  try {
    const norm = name.trim().toLowerCase();
    const list = await courseLookup();
    const hit = list.find(
      (c) => c.name.toLowerCase() === norm || (c.degree && c.degree.toLowerCase() === norm),
    );
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveStateId(name: string): Promise<number | null> {
  try {
    const norm = name.trim().toLowerCase();
    const list = await stateLookup();
    const hit = list.find((s) => s.name.toLowerCase() === norm);
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchCatalogStats(fallback: CatalogStats = EMPTY_STATS): Promise<CatalogStats> {
  try {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = await res.json();
    return { ...fallback, ...data, ok: Boolean(data.ok) };
  } catch {
    return fallback;
  }
}

/**
 * Read the backend's own health verdict. Never throws: an unreachable backend is
 * reported as `status: "unreachable"` so the UI can show a measured state rather
 * than a default that looks healthy.
 */
export async function fetchBackendHealth(): Promise<BackendHealth> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const data = await res.json();
    return data as BackendHealth;
  } catch {
    return {
      status: "unreachable",
      checks: {},
      error: "The health request could not be completed.",
    };
  }
}

/* ------------------------------------------------------------------ *
 * Saved colleges
 *
 * The dashboard used to render a hardcoded shortlist, then quietly fell back to
 * the `cp_saved` localStorage list. These calls make the signed-in user's
 * server-side list the source of truth; the local list is only a cache.
 * ------------------------------------------------------------------ */

export interface SavedCollegeRecord {
  id: number;
  college_id: number;
  saved_at: string;
  college: {
    id: number;
    college_id: string;
    name: string;
    slug: string;
    college_type: string | null;
    ownership: string | null;
    city: string | null;
    state: string | null;
    university_name: string | null;
    has_hostel: boolean | null;
    total_reviews: number;
    average_rating: string;
    is_featured: boolean;
  };
}

/** Distinguishes "no saved colleges" from "we could not ask the server". */
export type SavedCollegesResult =
  | { state: "ok"; records: SavedCollegeRecord[] }
  /** 400: the account has no StudentProfile yet, so there is nothing to attach saves to. */
  | { state: "no-profile" }
  | { state: "error"; message: string };

export async function fetchSavedColleges(): Promise<SavedCollegesResult> {
  try {
    const records = await apiFetch<SavedCollegeRecord[]>("/saved-colleges");
    return { state: "ok", records: Array.isArray(records) ? records : [] };
  } catch (err) {
    if (isForbidden(err)) return { state: "error", message: "You do not have access to saved colleges." };
    if (err instanceof ApiError && err.status === 400) return { state: "no-profile" };
    if (err instanceof ApiError && err.status === 401) {
      return { state: "error", message: "Sign in to see your saved colleges." };
    }
    return {
      state: "error",
      message: err instanceof Error ? err.message : "Could not load saved colleges.",
    };
  }
}

export async function saveCollegeRemote(collegeId: number): Promise<void> {
  await apiFetch<SavedCollegeRecord>("/saved-colleges", {
    method: "POST",
    body: JSON.stringify({ college_id: collegeId }),
  });
}

export async function unsaveCollegeRemote(collegeId: number): Promise<void> {
  await apiFetch<void>(`/saved-colleges/${collegeId}`, { method: "DELETE" });
}

export function toStudentProfile(p: BackendProfile): StudentProfile {
  return {
    name: p.name || p.email.split("@")[0],
    email: p.email,
    mobile: p.mobile,
    city: p.preferred_city ?? "",
    state: p.preferred_state ?? "",
    education: p.education_level ? [p.education_level] : [],
    interests: p.course_interest ? [p.course_interest] : [],
    preferredState: p.preferred_state ?? "",
    preferredCity: p.preferred_city ?? "",
    budgetMin: p.budget_min,
    budgetMax: p.budget_max,
  };
}

/* ------------------------------------------------------------------ *
 * Admin API
 *
 * Every endpoint below is role-gated server-side (see backend/app/dependencies.py
 * `require_role`). The 403 handling here is for UX only — it is not a security
 * boundary.
 * ------------------------------------------------------------------ */

export interface AdminUser {
  id: number;
  email: string;
  mobile: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: string[];
  /** The student's profile name, falling back to the email server-side. */
  display_name: string;
}

export interface AdminReview {
  id: number;
  college_id: number;
  rating: number;
  review_text: string | null;
  status: string;
  created_at: string;
  student_name: string | null;
}

export interface AdminEnquiry {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  status: string;
  created_at: string;
  source: string | null;
}

/** One row of `GET /api/v1/leads` — `LeadListItem` on the backend. */
export interface AdminLead {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  course_name: string | null;
  college_name: string | null;
  state_name: string | null;
  city: string | null;
  qualification: string | null;
  message: string | null;
  source: string | null;
  status: string;
  /** Display name, or null when the lead has overflowed to the admins. */
  assigned_counsellor: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface AdminLeadNote {
  id: number;
  note: string;
  created_at: string;
}

export interface AdminLeadStatusEvent {
  id: number;
  old_status: string | null;
  new_status: string;
  created_at: string;
}

/** `GET /api/v1/leads/{id}` — `LeadDetailResponse`: the list row plus its trail. */
export interface AdminLeadDetail extends AdminLead {
  notes: AdminLeadNote[];
  status_history: AdminLeadStatusEvent[];
}

/** `GET /api/v1/counsellors` — the assign dropdown's roster. */
export interface AdminCounsellor {
  id: number;
  name: string;
  specialization: string | null;
  max_leads: number;
  is_active: boolean;
  /** Open leads already on this counsellor, against the same rule the round-robin uses. */
  active_leads: number;
}

/** The backend's `LEAD_STATUSES`. Kept in step with `schemas/engagement.py`. */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
  "closed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/* ----------------------------- Question bank ----------------------------- */

/**
 * The server's `QuestionType` enum. `mcq` and `numeric` are auto-graded; `essay`
 * is never auto-graded and is routed to manual review, which is what keeps a
 * descriptive question scoreable at all.
 *
 * `ALL_QUESTION_TYPES` in `backend/app/question_types.py` is the source of truth
 * -- a value outside this list is rejected by the DB CHECK constraint, not just
 * by the API, so a typo here would not be caught until a 500.
 */
export const QUESTION_TYPES = ["mcq", "numeric", "essay"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * A question, as the paper-scoped write routes return it.
 *
 * Mirrors `AdminQuestionResponse` in `backend/app/schemas/catalog.py`. Kept
 * separate from the bank row below because the two endpoints genuinely differ:
 * the nested POST/PUT routes know only the question, and typed their return as
 * the bank row would promise `paper_name`/`paper_slug` that never arrive. The
 * editor does not read them back -- it re-fetches the bank after a save -- but a
 * type that lies is worse than no type, because the mistake surfaces later, in
 * whichever component finally trusts it.
 */
export interface AdminQuestion {
  id: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
  /**
   * The key for an `mcq`, and it must be one of `options` -- an `mcq` whose key
   * is not among its options is accepted by every storage layer and then marks
   * every submission wrong. See `lib/question-form.ts`.
   */
  correct_answer: string | null;
  marks: string;
  negative_marks: string;
  difficulty: string;
  explanation: string | null;
  sort_order: number;
  is_active: boolean;
  subject: string | null;
  topic: string | null;
  /** The answer key for a `numeric` question, separate from `correct_answer`. */
  numeric_answer: string | null;
  /** Absolute margin: correct when |given - key| <= tolerance. */
  tolerance: string;
}

/** A question as the cross-paper bank sees it: the above, plus its paper. */
export interface AdminQuestionListItem extends AdminQuestion {
  /**
   * The owning paper. Present on every bank row because the write path is
   * `/mock-tests/{ref}/questions` -- a bank row without it cannot be edited.
   */
  mock_test_id: number;
  paper_name: string;
  paper_slug: string;
}

export interface AdminQuestionPaper {
  mock_test_id: number;
  name: string;
  slug: string;
  question_count: number;
}

/**
 * Filter values, computed by the server from the rows that exist.
 *
 * Subjects and topics are authored content, not configuration. Hardcoding them
 * in this file means every new paper has to be remembered here, and until
 * someone remembers, the dropdown offers a subject that matches nothing and
 * reads as a broken control.
 */
export interface AdminQuestionFacets {
  subjects: string[];
  topics: string[];
  difficulties: string[];
  question_types: string[];
  papers: AdminQuestionPaper[];
}

/**
 * Body for the question create/update routes.
 *
 * Mirrors `TestQuestionCreate` / `TestQuestionUpdate`. Note that the *update*
 * route uses `exclude_unset=True`, so a key that is absent leaves the column
 * alone while a key sent as `null` clears it -- `lib/question-form.ts` builds
 * this object deliberately rather than spreading a form state.
 */
export interface QuestionPayload {
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: string | null;
  subject: string | null;
  topic: string | null;
  numeric_answer: string | null;
  tolerance: string;
  marks: string;
  negative_marks: string;
  difficulty: string;
  explanation: string | null;
  sort_order: number;
}

/**
 * `TestQuestionUpdate` is `QuestionPayload` plus `is_active`. Separate rather
 * than optional because the two routes have genuinely different rules: create
 * has no `is_active` field, and a body carrying one is silently ignored.
 */
export interface QuestionUpdatePayload extends QuestionPayload {
  is_active: boolean;
}

/**
 * `AdminNotificationResponse` from `backend/app/schemas/content.py`.
 *
 * `message` is nullable on the wire (`NotificationResponse.message: str | None`),
 * and `user_id`/`username` are present so the admin log can say who a
 * notification went to — a delivery log that renders every row as anonymous is
 * the same defect as an audit log that renders every actor as "system".
 */
export interface AdminNotification {
  id: number;
  user_id: number;
  username: string | null;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  channel: string;
  created_at: string;
}

/**
 * `NotificationBroadcastResult`. `created` is the recipient count, so the UI can
 * report "sent to N students" instead of assuming the press did nothing.
 */
export interface AdminNotificationBroadcast {
  created: number;
  recipients: AdminNotification[];
}

export interface AdminBanner {
  id: number;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  display_order: number;
  is_active: boolean;
  /**
   * The optional schedule window, returned by `BannerResponse` but previously
   * absent from this type. The panel cannot tell a live banner from an expired
   * or not-yet-started one without them, and "Active" was the only badge it
   * could render.
   */
  start_date?: string | null;
  end_date?: string | null;
}

/** `GET /api/v1/locations/states` — 36 rows, no pagination. */
export interface AdminState {
  id: number;
  name: string;
  code: string;
  is_union_territory: boolean;
}

export interface AdminDistrict {
  id: number;
  name: string;
  code: string;
  state_id: number;
}

export interface AdminUniversity {
  id: number;
  name: string;
  state_id: number | null;
  city: string | null;
  type: string;
}

/**
 * Page size for the admin catalogue walk.
 *
 * `GET /colleges`, `/universities` and `/courses` all cap `limit` with
 * `Query(..., le=100)`. `CollegesSection` used to ask for `limit=1000`, which is
 * a 422 — and because `useAdminResource` turns any thrown error into its error
 * state, the panel rendered "Could not reach the colleges API" every time and
 * nobody noticed, because a 422 from an over-large page size looks exactly like
 * an unreachable server. This constant is held against the real `le=` bounds by
 * `tests/page-size-contract.test.ts`.
 */
export const CATALOG_PAGE_SIZE = 100;

/**
 * `GET /blogs` and `GET /blog-categories` cap `limit` at 50, not 100.
 *
 * Separate from `CATALOG_PAGE_SIZE` rather than derived from it, because a
 * walk that asked for 100 here would 422 and `fetchAllPages` would throw — the
 * exact BUG-05 shape. `tests/page-size-contract.test.ts` reads the real `le=`
 * bounds out of the Python routers and holds this number against them.
 */
export const BLOG_PAGE_SIZE = 50;

/** Enough to cover the seeded catalogue with room to spare, and no more. */
const MAX_CATALOG_ROWS = 5000;

/**
 * Walk a capped, `offset`-paginated list endpoint to completion.
 *
 * Deliberately **not** the failure-tolerant paged fetcher in `api-server.ts`,
 * which resolves to `[]` on any non-2xx. That is right for a public page that
 * must render regardless and wrong here: an admin list that silently empties
 * itself looks like "the catalogue is empty" rather than "the request failed",
 * and an admin who then creates a duplicate is the cost. A throw becomes the
 * panel's error state, which says so.
 */
export async function fetchAllPages<T>(
  path: string,
  pageSize: number = CATALOG_PAGE_SIZE,
  maxRows: number = MAX_CATALOG_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  const separator = path.includes("?") ? "&" : "?";

  for (;;) {
    const page = await apiFetch<T[]>(`${path}${separator}limit=${pageSize}&offset=${rows.length}`);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    // A short page means the end of the list.
    if (page.length < pageSize) break;
    if (rows.length >= maxRows) break;
  }

  return rows;
}

export interface AdminBlog {
  id: number;
  title: string;
  slug: string;
  status: string;
  view_count: number;
  published_at: string | null;
  created_at: string;
  category_name: string | null;
}

/**
 * `AuditLogResponse` from `backend/app/schemas/content.py`, populated by
 * `routers/audit.py::_to_response`.
 *
 * The actor field is `username` (a `users.display_name`), NOT `user_email`.
 * This interface previously declared `user_email`, which the backend never
 * sends, so every audit row resolved to `undefined` and the console rendered
 * "by system" for all of them — including privileged actions with a real actor
 * on record. `ip_address` was equally absent from the type and equally present
 * in every response.
 */
export interface AdminAuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminRole {
  id: number;
  name: string;
  description: string | null;
  /**
   * Whether the *calling* admin may grant this role, computed server-side by the
   * same `outranks()` that `PATCH /users/{id}` enforces. Never derive this from
   * the role's name or a client-side privilege table — that is how the console
   * ends up offering a control whose only outcome is a 403.
   */
  grantable: boolean;
}

export interface AdminUpdateUserPayload {
  is_active?: boolean;
  role_ids?: number[];
}

/** A page of users plus the unpaged, filtered total. */
export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserQuery {
  search?: string;
  role?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * `MediaResponse` from `backend/app/schemas/content.py`.
 *
 * `url` is `MEDIA_URL_PREFIX/{id}` — a same-origin `/api/v1/media/files/{id}`
 * path, so it renders through the existing rewrite with no `next.config` remote
 * pattern and no absolute origin. `file_type` and `file_size` are nullable
 * because a registry row (one inserted with an external URL rather than an
 * upload) has neither.
 */
export interface AdminMedia {
  id: number;
  url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  alt_text: string | null;
  entity_type: string | null;
  entity_id: number | null;
  image_type: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

/**
 * `CourseResponse` from `backend/app/schemas/catalog.py`.
 *
 * Note what is **not** here: `is_active`. The list schema omits it entirely, so
 * the old courses table rendered a Status column that read a field the response
 * never carried and showed "Inactive" for every row in the catalogue.
 */
export interface AdminCourse {
  id: number;
  name: string;
  slug: string;
  degree: string | null;
  duration: string | null;
  category: string | null;
}

/** `CourseDetailResponse` — the list row plus the three long-text columns. */
export interface AdminCourseDetail extends AdminCourse {
  overview: string | null;
  eligibility: string | null;
  career_information: string | null;
  college_count: number;
}

/** `ExamResponse`. */
export interface AdminExam {
  id: number;
  name: string;
  slug: string;
  conducting_authority: string;
  exam_type: string;
  eligibility: string | null;
  application_start_date: string | null;
  application_deadline: string | null;
  exam_date: string | null;
  admit_card_date: string | null;
  result_date: string | null;
  official_website: string | null;
  official_notification: string | null;
  /**
   * JSON columns, and typed loosely on purpose. The schema says `dict | None` and
   * `list | None`; the frontend's older `ApiExam` claimed `string[]` and a
   * `{question, answer}[]`, neither of which the backend guarantees. `unknown`
   * means a caller has to look before it renders, which is the honest position.
   */
  syllabus: unknown;
  faqs: unknown;
  is_active: boolean;
}

/** `ScholarshipResponse`. */
export interface AdminScholarship {
  id: number;
  name: string;
  slug: string;
  provider: string;
  ownership: string;
  eligibility: string | null;
  state_id: number | null;
  state_name: string | null;
  course: string | null;
  category: string | null;
  income_criteria: string | null;
  /** A `String(255)`, not a number — see `lib/scholarship-form.ts`. */
  amount: string | null;
  application_deadline: string | null;
  documents_required: unknown;
  application_procedure: string | null;
  official_website: string | null;
  verification_status: string;
  last_verified_date: string | null;
  next_verification_date: string | null;
  is_active: boolean;
}

/** `BlogResponse`. */
export interface AdminBlogDetail extends AdminBlog {
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category_id: number | null;
  author_name: string | null;
  is_featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  updated_at: string;
}

/** `BlogCategoryResponse`. */
export interface AdminBlogCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  blog_count: number;
}

/** `FAQResponse`. */
export interface AdminFaq {
  id: number;
  question: string;
  /** `str | None` in the schema; the older `ApiFaq` typed it as `string`. */
  answer: string | null;
  entity_type: string;
  entity_id: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export const adminApi = {
  /**
   * Filtering and paging happen on the server. The console can only ever hold one
   * page, so a client-side "Inactive" filter would describe the page and not the
   * account base. The response is a page + total rather than a bare array, so
   * the UI can say "1–50 of 312" instead of implying the page is everything.
   */
  users: (query: AdminUserQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.role) params.set("role", query.role);
    if (query.is_active !== undefined) params.set("is_active", String(query.is_active));
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.offset !== undefined) params.set("offset", String(query.offset));
    const qs = params.toString();
    return apiFetch<AdminUserPage>(`/users${qs ? `?${qs}` : ""}`);
  },

  roles: () => apiFetch<AdminRole[]>("/roles"),

  updateUser: (id: number, payload: AdminUpdateUserPayload) =>
    apiFetch<AdminUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  /**
   * The moderation queue, or another explicitly named scope.
   *
   * The default is `/moderation` rather than `""` because **there is no
   * `GET /reviews`**. The router exposes `/college/{ref}`, `/moderation`,
   * `/my`, `POST /`, `PUT /{id}`, `POST /{id}/moderate` and `DELETE /{id}` —
   * nothing at the collection root for GET. `params = ""` therefore produced a
   * 404 that the caller rendered as an empty panel, and any future call site
   * that omitted the argument would have hit the same wall. Found by
   * `tests/api-endpoints.test.ts`, which sweeps every wrapper against the
   * routes the backend actually declares.
   */
  reviews: (params = "/moderation") => apiFetch<AdminReview[]>(`/reviews${params}`),

  moderateReview: (id: number, status: "approved" | "rejected", notes?: string) =>
    apiFetch<AdminReview>(`/reviews/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ status, moderation_notes: notes ?? null }),
    }),

  enquiries: () => apiFetch<AdminEnquiry[]>("/enquiries"),

  leads: (params = "") => apiFetch<AdminLead[]>(`/leads${params}`),

  /** `null` in `params` unsets the assignment, matching the backend's own rule. */
  assignLead: (enquiryId: number, counsellorId: number | null) =>
    apiFetch<AdminLeadDetail>(`/leads/${enquiryId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ counsellor_id: counsellorId }),
    }),

  getLead: (enquiryId: number) => apiFetch<AdminLeadDetail>(`/leads/${enquiryId}`),

  addLeadNote: (enquiryId: number, note: string) =>
    apiFetch<AdminLeadNote>(`/leads/${enquiryId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  /** `null` clears the follow-up date. */
  setLeadFollowUp: (enquiryId: number, followUpDate: string | null) =>
    apiFetch<AdminLeadDetail>(`/leads/${enquiryId}/follow-up`, {
      method: "PATCH",
      body: JSON.stringify({ follow_up_date: followUpDate }),
    }),

  updateLeadStatus: (enquiryId: number, status: string) =>
    apiFetch<AdminLeadDetail>(`/leads/${enquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  /**
   * Admin-only roster for the assign dropdown; 403s for a counsellor.
   *
   * Walked rather than fetched once: the route defaults to `limit=50` and caps at
   * 200, so a single call silently truncated the roster at 50 — and the leads
   * panel uses this same method to populate its assign `<select>`, where a
   * missing counsellor is a lead that cannot be handed over. `CATALOG_PAGE_SIZE`
   * (100) is inside the cap.
   *
   * Defaults to active-only, which is what the assign dropdown needs: handing a
   * lead to a deactivated counsellor is rejected by `PATCH /leads/{id}/assign`.
   * The counsellors panel asks for `includeInactive` so a deactivated counsellor
   * is still visible instead of vanishing from the roster.
   */
  counsellors: (opts: { includeInactive?: boolean } = {}) =>
    fetchAllPages<AdminCounsellor>(
      opts.includeInactive ? "/counsellors?include_inactive=true" : "/counsellors",
    ),

  /**
   * The cross-paper question bank, walked to completion.
   *
   * Always a `fetchAllPages` walk, filtered or not. The route caps `limit` at
   * 100, so a single page would be a truncated bank that looks complete — and
   * the page size is deliberately not written here or in the panel:
   * `tests/page-size-contract.test.ts` fails if an admin section hand-writes
   * `limit=`, because that is how the college panel came to send `?limit=1000`,
   * 422, and render as an empty catalogue.
   */
  questions: (params = "") =>
    fetchAllPages<AdminQuestionListItem>(params ? `/questions?${params}` : "/questions"),

  /** What is in the bank, for the filter dropdowns. Never hardcoded. */
  questionFacets: () => apiFetch<AdminQuestionFacets>("/questions/facets"),

  /**
   * Question writes are nested under the paper and have always been.
   * `{ref}` accepts an id or a slug, which is what `paper_slug` on each bank row
   * is for.
   */
  createQuestion: (paperRef: string | number, payload: QuestionPayload) =>
    apiFetch<AdminQuestion>(`/mock-tests/${paperRef}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * `PUT`, not `PATCH`: the route is a full replace and uses
   * `exclude_unset=True`, so a field absent from the body is left alone while a
   * field sent as `null` clears the column. The form sends every field it owns
   * on purpose -- see `lib/question-form.ts`.
   */
  updateQuestion: (
    paperRef: string | number,
    questionId: number,
    payload: QuestionUpdatePayload,
  ) =>
    apiFetch<AdminQuestion>(`/mock-tests/${paperRef}/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  /** Soft delete. Drops the question from the paper, keeps every attempt's answer. */
  deleteQuestion: (paperRef: string | number, questionId: number) =>
    apiFetch<void>(`/mock-tests/${paperRef}/questions/${questionId}`, {
      method: "DELETE",
    }),

  /**
   * Every banner, including paused, expired and not-yet-scheduled ones.
   *
   * `include_inactive=true` is required here, not optional. `list_banners`
   * filters `where(Banner.is_active)` *and* a start/end date window unless the
   * flag is set, so the old flagless call could only ever return banners that
   * were already live. The panel's Pause/Activate toggle was therefore
   * unreachable in the paused direction: once a banner was paused it vanished
   * from the console with no route back, and its Status badge — which reads
   * `is_active` — was structurally always "Active". This is the same defect the
   * FAQ client documents at {@link adminApi.faqs}.
   *
   * Both the list and the by-id handler 403 unless the caller holds
   * `CONTENT_ROLES`, so the flag cannot be used to enumerate draft banners
   * anonymously.
   *
   * Walked rather than fetched once: the route caps `limit` at 100, which is
   * exactly `CATALOG_PAGE_SIZE`, and a plain call would silently truncate at the
   * first 50.
   */
  banners: () => fetchAllPages<AdminBanner>("/banners?include_inactive=true"),

  createBanner: (payload: Partial<AdminBanner>) =>
    apiFetch<AdminBanner>("/banners", { method: "POST", body: JSON.stringify(payload) }),

  updateBanner: (id: number, payload: Partial<AdminBanner>) =>
    apiFetch<AdminBanner>(`/banners/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteBanner: (id: number) => apiFetch<void>(`/banners/${id}`, { method: "DELETE" }),

  /**
   * One page of published posts, or of drafts when the caller asks and holds a
   * content role.
   *
   * `list_blogs` returns **published only** unless both conditions hold: the
   * caller is in `CONTENT_ROLES` *and* a `status` parameter is present. So this
   * raw single-page call is kept for narrow uses, and {@link adminApi.blogs} is
   * what the admin panels call.
   */
  blogsPage: (params = "") => apiFetch<AdminBlog[]>(`/blogs${params}`),

  /**
   * Every article, drafts included.
   *
   * The old call was `GET /blogs` with no `status`, which took the route's
   * `else` branch and returned published posts only. The panel was titled
   * "Published articles" and every draft in the database was unreachable — not
   * unlistable, unreachable: `GET /blogs/{ref}` also filters on
   * `status == "published"`, so a draft could not be opened for editing either.
   * Both statuses are therefore walked explicitly and merged.
   *
   * A caller **without** a content role still gets published-only, whatever
   * `status` it sends — the gate is on the server and cannot be widened here.
   */
  async blogs(): Promise<AdminBlogDetail[]> {
    const [drafts, published] = await Promise.all([
      fetchAllPages<AdminBlogDetail>("/blogs?status=draft", BLOG_PAGE_SIZE),
      fetchAllPages<AdminBlogDetail>("/blogs?status=published", BLOG_PAGE_SIZE),
    ]);
    return [...drafts, ...published];
  },

  /**
   * The raw row for the edit form.
   *
   * Safe only for a **published** post: `get_blog` is the public read and
   * filters `status == "published"`, so a draft is a 404. The blog panel
   * therefore prefills from the table row — `GET /blogs` returns `content` for
   * every row it returns — and does not call this. It exists for the one case
   * that genuinely needs a fresh read: a published post whose content is long
   * enough that the panel holds a truncated copy.
   */
  blog: (ref: string | number) => apiFetch<AdminBlogDetail>(`/blogs/${ref}`),

  createBlog: (payload: Record<string, unknown>) =>
    apiFetch<AdminBlogDetail>("/blogs", { method: "POST", body: JSON.stringify(payload) }),

  updateBlog: (ref: string | number, payload: Record<string, unknown>) =>
    apiFetch<AdminBlogDetail>(`/blogs/${ref}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteBlog: (ref: string | number) => apiFetch<void>(`/blogs/${ref}`, { method: "DELETE" }),

  blogCategories: () => fetchAllPages<AdminBlogCategory>("/blog-categories", BLOG_PAGE_SIZE),

  /* ------------------------------- Colleges ------------------------------- */

  /**
   * The whole catalogue, not the first page of it.
   *
   * `GET /colleges` caps `limit` at 100 and offers no search and no admin-only
   * variant. Fetching 100 of 331 colleges would show an admin a third of the
   * records and label the count 100, which reads as "this is everything". So this
   * walks the offsets.
   *
   * `include_inactive=true` is required, not optional. `list_colleges` filtered
   * `College.is_active` unconditionally, so deactivating a college removed it from
   * this console permanently — even though `is_active` is writable on update,
   * there was no route back. `PUT /colleges/{ref}` also 404s on an inactive row
   * for a caller without a content role, so it could not be un-deactivated
   * through the same panel either.
   *
   * The server 403s the flag for anyone outside `CONTENT_ROLES`, so it cannot be
   * used to enumerate draft colleges anonymously. Every caller of this method is
   * an admin panel.
   */
  colleges: () =>
    fetchAllPages<ApiCollegeListItem>("/colleges?include_inactive=true"),

  college: (ref: string | number) => apiFetch<ApiCollegeDetail>(`/colleges/${ref}`),

  /**
   * `admin` or `super_admin` only.
   *
   * `college_id`, `slug` and `verification_status` are server-generated — the
   * last is forced to `"unverified"` regardless of the body — so none of them
   * appear in the payload type.
   */
  createCollege: (payload: Record<string, unknown>) =>
    apiFetch<ApiCollegeDetail>("/colleges", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * `admin` or `super_admin`. The handler uses `model_dump(exclude_unset=True)`,
   * so only the keys present in the body are applied and an explicit `null`
   * clears a column. `lib/college-form.ts` decides which keys those are.
   */
  updateCollege: (ref: string | number, payload: Record<string, unknown>) =>
    apiFetch<ApiCollegeDetail>(`/colleges/${ref}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  /** `super_admin` only, and cascades six dependent tables. 204 on success. */
  deleteCollege: (ref: string | number) =>
    apiFetch<void>(`/colleges/${ref}`, { method: "DELETE" }),

  states: () => apiFetch<AdminState[]>("/locations/states"),

  districts: (stateId: number) =>
    apiFetch<AdminDistrict[]>(`/locations/states/${stateId}/districts`),

  universities: () =>
    fetchAllPages<AdminUniversity>("/universities?include_inactive=true"),

  /**
   * The course list, shared by the college form's course picker, the media
   * entity picker and the courses panel. It lives with the other reference
   * lookups because two of the three callers are not the courses panel; the
   * courses panel's own read is `adminApi.course(ref)` below.
   */
  courses: () => fetchAllPages<AdminCourse>("/courses?include_inactive=true"),

  /**
   * `GET /notifications` answers with an array and is admin-only. The route did
   * not exist when this was written — the call 405'd, the panel showed its error
   * banner, and the console substituted a hardcoded "No notifications sent yet"
   * row, which is indistinguishable from a genuinely empty log.
   */
  notifications: () => apiFetch<AdminNotification[]>("/notifications"),

  /**
   * Omitting `user_id` broadcasts to every active student; supplying one targets
   * that account. `notifications.user_id` is `NOT NULL`, so a broadcast is
   * fanned out into one row per recipient rather than stored as a single
   * recipient-less message.
   */
  createNotification: (payload: { user_id?: number; title: string; message: string; type?: string }) =>
    apiFetch<AdminNotificationBroadcast>("/notifications", { method: "POST", body: JSON.stringify(payload) }),

  auditLogs: (params = "") => apiFetch<AdminAuditLog[]>(`/audit-logs${params}`),

  mockTests: () => apiFetch<unknown[]>("/mock-tests/admin/all"),

  /**
   * The whole library, walked to completion.
   *
   * Was a single unpaginated call, which returned 50 rows and called that the
   * library — the route defaults to `limit=50` and caps at 100, so `fetchAllPages`
   * is the difference between "every asset" and "the first fifty".
   */
  media: () => fetchAllPages<AdminMedia>("/media"),

  /**
   * `POST /media/upload`. The body is `FormData` and must stay one — see the
   * `bodyCarriesItsOwnContentType` note in `apiFetchImpl`. `MediaCreate` (the
   * JSON route) is deliberately not exposed here: it writes a row with no file
   * behind it, which is the orphaned-record case `upload_media` exists to avoid.
   */
  uploadMedia: (body: FormData) =>
    apiFetch<AdminMedia>("/media/upload", { method: "POST", body }),

  /**
   * Metadata only — this route does not replace the stored bytes, so a claim in
   * this panel that it can swap the image file would be false.
   */
  updateMedia: (id: number, payload: { alt_text?: string | null; image_type?: string | null; display_order?: number; is_active?: boolean }) =>
    apiFetch<AdminMedia>(`/media/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  /** Removes the row and, for an uploaded file, the bytes on disk with it. */
  deleteMedia: (id: number) => apiFetch<void>(`/media/${id}`, { method: "DELETE" }),

  /**
   * `include_inactive=true` is required here, not optional.
   *
   * `list_faqs` filters `where(FAQ.is_active)` unconditionally, so without the
   * flag an admin listing FAQs never sees a hidden one — and because the edit
   * dialog loads its record through `GET /faqs/{id}`, which 404'd on an inactive
   * row, a hidden FAQ could not be reopened either. The panel's Status column
   * rendered "Hidden" from a field that was structurally always `true`.
   *
   * Both endpoints 403 unless the caller holds `CONTENT_ROLES`, so the flag
   * cannot be used to read unpublished answers anonymously.
   */
  faqs: () => fetchAllPages<AdminFaq>("/faqs?include_inactive=true"),

  /** `GET /faqs/{faq_id}` takes a plain integer. */
  faq: (id: number) =>
    apiFetch<AdminFaq>(`/faqs/${id}?include_inactive=true`),

  createFaq: (payload: Record<string, unknown>) =>
    apiFetch<AdminFaq>("/faqs", { method: "POST", body: JSON.stringify(payload) }),

  /**
   * `FAQUpdate` has no `entity_type` or `entity_id`, so the attachment cannot be
   * changed after creation — see `lib/faq-form.ts`. The payload type is a plain
   * record, so nothing stops a caller sending the pair and getting a silent
   * no-op; the form builder is the thing that keeps it out.
   */
  updateFaq: (id: number, payload: Record<string, unknown>) =>
    apiFetch<AdminFaq>(`/faqs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteFaq: (id: number) => apiFetch<void>(`/faqs/${id}`, { method: "DELETE" }),

  /* ------------------------------------------------------------------ *
   * Courses, scholarships, exams
   *
   * These three routers share a shape: `GET ""` (offset-paginated, `le=100`), a
   * by-ref `GET`, and `POST` / `PUT` / `DELETE` behind role gates that differ per
   * verb. The `*_ref` path parameter is resolved as an integer when the segment
   * is all digits and as a slug otherwise, so these take the numeric id — see
   * `rowRefFor` in `lib/form-parts.ts`.
   *
   * Every `PUT` here applies `model_dump(exclude_unset=True)`, which is what makes
   * the deliberate field omissions in each form module safe: an absent key leaves
   * the column alone, and only a key that is *sent* can clear it.
   *
   * The three lists all cap `limit` at 100. The panels used to ask for 1000 and
   * 200 respectively, which is a 422 — and `useAdminResource` turns any thrown
   * error into "Could not reach the API", so those tables showed a connection
   * error rather than a page-size bug. See `lib/form-parts.ts` for the
   * `is_active` omission these three share.
   * ------------------------------------------------------------------ */

  course: (ref: string | number) => apiFetch<AdminCourseDetail>(`/courses/${ref}`),

  createCourse: (payload: Record<string, unknown>) =>
    apiFetch<AdminCourseDetail>("/courses", { method: "POST", body: JSON.stringify(payload) }),

  updateCourse: (ref: string | number, payload: Record<string, unknown>) =>
    apiFetch<AdminCourseDetail>(`/courses/${ref}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteCourse: (ref: string | number) => apiFetch<void>(`/courses/${ref}`, { method: "DELETE" }),

  courseCategories: () => apiFetch<string[]>("/courses/categories"),

  scholarships: () =>
    fetchAllPages<AdminScholarship>("/scholarships?include_inactive=true"),

  scholarship: (ref: string | number) => apiFetch<AdminScholarship>(`/scholarships/${ref}`),

  createScholarship: (payload: Record<string, unknown>) =>
    apiFetch<AdminScholarship>("/scholarships", { method: "POST", body: JSON.stringify(payload) }),

  updateScholarship: (ref: string | number, payload: Record<string, unknown>) =>
    apiFetch<AdminScholarship>(`/scholarships/${ref}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteScholarship: (ref: string | number) => apiFetch<void>(`/scholarships/${ref}`, { method: "DELETE" }),

  exams: () => fetchAllPages<AdminExam>("/exams?include_inactive=true"),

  exam: (ref: string | number) => apiFetch<AdminExam>(`/exams/${ref}`),

  createExam: (payload: Record<string, unknown>) =>
    apiFetch<AdminExam>("/exams", { method: "POST", body: JSON.stringify(payload) }),

  updateExam: (ref: string | number, payload: Record<string, unknown>) =>
    apiFetch<AdminExam>(`/exams/${ref}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteExam: (ref: string | number) => apiFetch<void>(`/exams/${ref}`, { method: "DELETE" }),
};

/** True when an error is simply "you don't have the role for this". */
export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

/* ------------------------------------------------------------------ *
 * Phase 3 — OTP, email verification, password reset
 * ------------------------------------------------------------------ */

/** Shape of the structured 403 `POST /auth/login` returns for an unverified address. */
interface EmailNotVerifiedDetail {
  code: "email_not_verified";
  message: string;
  email: string;
  resend_endpoint: string;
}

/**
 * True when a login was refused *only* because the address is unconfirmed.
 *
 * Narrow on purpose: it must not fire for a deactivated account, which also
 * returns 403 but with a plain-string detail, or the UI would offer to resend a
 * confirmation email to somebody who can never use it.
 */
export function isEmailNotVerified(err: unknown): err is ApiError & { detail: EmailNotVerifiedDetail } {
  if (!(err instanceof ApiError) || err.status !== 403) return false;
  const detail = err.detail as Partial<EmailNotVerifiedDetail> | undefined;
  return detail?.code === "email_not_verified" && typeof detail.email === "string";
}

export interface OtpChallenge {
  success: boolean;
  message: string;
  expires_in_seconds: number;
}

export interface StandardActionResponse {
  success: boolean;
  message: string;
  data: Record<string, unknown>;
}

export const otpApi = {
  /** Ask for a sign-in OTP. The response is identical for unknown numbers. */
  sendLoginOtp: (mobile: string) =>
    apiFetch<OtpChallenge>("/auth/login/otp/send", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),

  verifyLoginOtp: (mobile: string, otp: string) =>
    apiFetch<AuthTokens>("/auth/login/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    }),

  /** Authenticated: verify the mobile already on the account. */
  sendMobileOtp: () =>
    apiFetch<OtpChallenge>("/auth/verify-mobile/send", { method: "POST" }),

  verifyMobile: (mobile: string, otp: string) =>
    apiFetch<StandardActionResponse>("/auth/verify-mobile/verify", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    }),

  /** Consumes the `?token=` from the confirmation email. */
  verifyEmail: (token: string) =>
    apiFetch<StandardActionResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    apiFetch<StandardActionResponse>("/auth/verify-email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<StandardActionResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<StandardActionResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
};

/* ------------------------------------------------------------------ *
 * DPDP compliance — Phase 9.1 (age gate + parental consent) and 9.4
 * (data-principal requests).
 *
 * Every shape below mirrors `backend/app/schemas/compliance.py` exactly. The
 * backend models are `extra="forbid"`, so a field that is misspelled here is
 * not ignored — it is a 422 — which is the reason these are typed rather than
 * built ad hoc at each call site.
 * ------------------------------------------------------------------ */

export type AgeBand = "under_18" | "18_plus";

export type GuardianConsentStatus =
  | "pending"
  | "verified"
  | "denied"
  | "expired"
  | "withdrawn";

export type DataRequestType =
  | "access"
  | "correction"
  | "erasure"
  | "withdrawal"
  | "grievance"
  | "nomination";

export type DataRequestStatus =
  | "received"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "rejected";

export interface GuardianConsent {
  id: number;
  status: GuardianConsentStatus;
  verification_channel: string;
  requested_at: string;
  verified_at: string | null;
  withdrawn_at: string | null;
  expires_at: string;
  consent_version: string | null;
}

export interface AgeDeclareResponse {
  age_band: AgeBand | null;
  is_minor: boolean;
  processing_allowed: boolean;
  blocked_reason: string | null;
  blocked_message: string | null;
}

export interface ComplianceStatus {
  age_band: AgeBand | null;
  is_minor: boolean;
  age_answered: boolean;
  processing_allowed: boolean;
  blocked_reason: string | null;
  blocked_message: string | null;
  parental_consent: GuardianConsent | null;
  sla_days: number;
}

export interface DataRequest {
  id: number;
  request_type: DataRequestType;
  status: DataRequestStatus;
  subject: string | null;
  details: string;
  received_at: string;
  acknowledged_at: string | null;
  due_at: string;
  completed_at: string | null;
  resolution: string | null;
  days_remaining: number;
  overdue: boolean;
}

/**
 * `GET /compliance/parental-consent` answers `null` when no consent exists.
 * That is valid JSON, so it goes through `apiFetch` like everything else — no
 * special case. What would *not* be valid is an empty body, and none of these
 * endpoints send one: the 204 case is handled inside `apiFetchImpl`.
 */
export const complianceApi = {
  /** The whole gate in one round trip. Never `null`. */
  status: () => apiFetch<ComplianceStatus>("/compliance/status"),

  /**
   * Declare or correct an age band.
   *
   * Both directions are allowed by the backend on purpose: moving towards the
   * stricter treatment cannot be a way to escalate one's own consent state.
   */
  declareAge: (age_band: AgeBand) =>
    apiFetch<AgeDeclareResponse>("/compliance/age", {
      method: "POST",
      body: JSON.stringify({ age_band }),
    }),

  parentalConsent: () => apiFetch<GuardianConsent | null>("/compliance/parental-consent"),

  requestParentalConsent: (payload: {
    guardian_name: string;
    guardian_mobile?: string | null;
    guardian_email?: string | null;
  }) =>
    apiFetch<GuardianConsent>("/compliance/parental-consent/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyParentalConsent: (code: string) =>
    apiFetch<GuardianConsent>("/compliance/parental-consent/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  /** No body, no code: withdrawal must be as easy as the grant was. */
  withdrawParentalConsent: () =>
    apiFetch<GuardianConsent>("/compliance/parental-consent/withdraw", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  myRequests: () => apiFetch<DataRequest[]>("/compliance/requests"),

  createRequest: (payload: {
    request_type: DataRequestType;
    details: string;
    subject?: string | null;
  }) =>
    apiFetch<DataRequest>("/compliance/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /** Staff queue, soonest deadline first. */
  adminRequests: () => apiFetch<DataRequest[]>("/compliance/admin/requests"),

  updateAdminRequest: (
    id: number,
    payload: { status: DataRequestStatus; resolution?: string | null },
  ) =>
    apiFetch<DataRequest>(`/compliance/admin/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
