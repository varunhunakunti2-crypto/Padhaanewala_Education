import type { StudentProfile } from "@/lib/types";

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

async function apiFetchImpl<T>(
  path: string,
  init: RequestInit,
  retriesLeft: number,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
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

export interface AdminNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminBanner {
  id: number;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  display_order: number;
  is_active: boolean;
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

export interface AdminAuditLog {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  user_email: string | null;
}

export interface AdminRole {
  id: number;
  name: string;
  description: string | null;
}

export interface AdminUpdateUserPayload {
  is_active?: boolean;
  role_ids?: number[];
}

export const adminApi = {
  users: (params = "") => apiFetch<AdminUser[]>(`/users${params}`),

  roles: () => apiFetch<AdminRole[]>("/roles"),

  updateUser: (id: number, payload: AdminUpdateUserPayload) =>
    apiFetch<AdminUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  reviews: (params = "") => apiFetch<AdminReview[]>(`/reviews${params}`),

  moderateReview: (id: number, status: "approved" | "rejected", notes?: string) =>
    apiFetch<AdminReview>(`/reviews/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ status, moderation_notes: notes ?? null }),
    }),

  enquiries: () => apiFetch<AdminEnquiry[]>("/enquiries"),

  leads: (params = "") => apiFetch<AdminEnquiry[]>(`/leads${params}`),

  updateLeadStatus: (enquiryId: number, status: string) =>
    apiFetch<AdminEnquiry>(`/leads/${enquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  banners: () => apiFetch<AdminBanner[]>("/banners"),

  createBanner: (payload: Partial<AdminBanner>) =>
    apiFetch<AdminBanner>("/banners", { method: "POST", body: JSON.stringify(payload) }),

  updateBanner: (id: number, payload: Partial<AdminBanner>) =>
    apiFetch<AdminBanner>(`/banners/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteBanner: (id: number) => apiFetch<void>(`/banners/${id}`, { method: "DELETE" }),

  blogs: (params = "") => apiFetch<AdminBlog[]>(`/blogs${params}`),

  notifications: () => apiFetch<AdminNotification[]>("/notifications"),

  createNotification: (payload: { user_id?: number | null; title: string; message: string; type?: string }) =>
    apiFetch<AdminNotification>("/notifications", { method: "POST", body: JSON.stringify(payload) }),

  auditLogs: (params = "") => apiFetch<AdminAuditLog[]>(`/audit-logs${params}`),

  mockTests: () => apiFetch<unknown[]>("/mock-tests/admin/all"),

  media: () => apiFetch<unknown[]>("/media"),

  faqs: () => apiFetch<unknown[]>("/faqs"),
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
