/**
 * Client-side error reporting. Phase 5.4.
 *
 * Before this, `app/error.tsx` rendered the words "Our team has been notified"
 * and notified nobody: no Sentry, no `console.error`, no reporting SDK, and the
 * `error` and `digest` props were destructured away and discarded. A user who
 * hit a broken page produced no artefact anywhere — server log, browser
 * console, or third-party service. There was nothing to correlate, so nothing
 * could be diagnosed and nothing could be counted.
 *
 * This module is the minimum honest version of reporting that needs no vendor
 * and no new dependency: it ships a small structured event to a route handler
 * in this app (`app/api/errors/route.ts`), which writes one greppable JSON line
 * to the server log. That log is the thing Phase 8.5 monitoring will collect,
 * and a breach timeline under DPDP S.8(6) cannot be reconstructed from logs
 * that were never written.
 *
 * ## What is deliberately NOT sent
 *
 * A material share of this site's users are under 18 (Phase 9.1), and DPDP
 * S.8(5) requires reasonable security safeguards in the systems that hold
 * their data. An error reporter is the classic place to accidentally exfiltrate
 * a whole `localStorage` — this app alone persists 13 behavioural keys
 * (`AppContext`), including `cp_search_history` and `cp_recent_locations`, and
 * the auth token lives in `localStorage` too. So the payload is an explicit
 * allowlist built field by field below, and there is no code path that walks
 * storage, cookies or a request body. Do not add one.
 */

const ENDPOINT = "/api/errors";
/** Server-rendered error messages are capped anyway; this bounds a client one. */
const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
/** Same error thrown in a render loop must not become a request storm. */
const DEDUPE_WINDOW_MS = 30_000;

const lastSent = new Map<string, number>();

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}…[truncated ${value.length - max} chars]` : value;

const newReference = (): string =>
  `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A correlation id with no side effects, so it can be produced during render and
 * then handed to `reportError`. The error boundary needs the id *before* it
 * reports in order to display it, and generating it inside the reporting effect
 * would mean either a second render (the `react-hooks/set-state-in-effect` rule
 * is right that it cascades) or a reference that never reaches the screen.
 */
export function createReference(): string {
  return newReference();
}

export interface ErrorReport {
  /** Correlation id, safe to show to a user and to quote in support. */
  reference: string;
  /** False when the event was suppressed or the transport was unavailable. */
  dispatched: boolean;
}

/**
 * Report a caught error. Safe to call from a `useEffect`: it never throws, never
 * rejects, and never blocks rendering.
 */
export function reportError(
  error: unknown,
  context: { source: string; digest?: string; reference?: string } = { source: "unknown" },
): ErrorReport {
  const reference = context.reference ?? newReference();

  const err = error instanceof Error ? error : new Error(String(error));
  const digest = context.digest ?? (err as { digest?: string }).digest;

  // Always to the console, even if the network copy fails — a developer
  // reproducing the bug locally should not have to check a server log.
  console.error(`[${reference}] ${err.message}`, err);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "unknown";
  const key = `${context.source}|${pathname}|${digest ?? err.message}`;
  const previous = lastSent.get(key);
  const now = Date.now();
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) {
    return { reference, dispatched: false };
  }
  lastSent.set(key, now);

  const payload = JSON.stringify({
    reference,
    source: context.source,
    message: truncate(err.message, MAX_MESSAGE),
    // `digest` is the only handle that ties a browser-side error to the
    // server-side log line for the same failure. In production the message of
    // a Server Component error is deliberately generic, so without this the two
    // sides are unlinkable.
    digest: digest ? truncate(String(digest), 200) : null,
    stack: err.stack ? truncate(err.stack, MAX_STACK) : null,
    pathname,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    language: typeof navigator !== "undefined" ? navigator.language : null,
    // No IP, no user id, no storage, no cookies. The real client address belongs
    // in the reverse proxy's access log, where the trusted-proxy topology is the
    // thing that makes it trustworthy (Phase 1.5) — deriving it here from
    // X-Forwarded-For would reintroduce the exact bug that phase closed.
    occurredAt: new Date(now).toISOString(),
  });

  if (typeof window === "undefined" || typeof fetch !== "function") {
    return { reference, dispatched: false };
  }

  try {
    // sendBeacon survives the page being torn down, which is the common case:
    // an error boundary replaces the tree during a client navigation.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );
      if (queued) return { reference, dispatched: true };
    }

    void fetch(ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);

    return { reference, dispatched: true };
  } catch {
    // A reporting failure must never become a second error. The console line
    // above is the floor.
    return { reference, dispatched: false };
  }
}

/**
 * Unhandled promise rejections and `window.onerror` reach no React error
 * boundary, so nothing else would ever see them. One listener, installed once,
 * reporting through the same funnel.
 */
let globalListenersInstalled = false;

export function installGlobalErrorListeners(): void {
  if (globalListenersInstalled || typeof window === "undefined") return;
  globalListenersInstalled = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
