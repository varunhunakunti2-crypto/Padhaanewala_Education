import { NextResponse } from "next/server";

/**
 * Sink for client error reports. Phase 5.4.
 *
 * Writes one structured line per event to stdout, which in the containerised
 * deployment (`docker compose -f docker-compose.prod.yml`) is the Docker log
 * collector. That is the whole design: no third-party service, no new
 * dependency, and the line is machine-parseable so a monitor in Phase 8.5 can
 * alert on it.
 *
 * Unauthenticated by necessity — an unauthenticated visitor is exactly who hits
 * a broken page — so the two things that matter for an open write endpoint are
 * bounded here: the accepted body size, and the rate at which log lines can be
 * produced. An attacker who can reach this endpoint should be able to make it
 * noisy, never able to make it unbounded.
 */

/** 32 KB. A real report is ~1 KB; a stack trace is capped at 8 KB upstream. */
const MAX_BODY_BYTES = 32 * 1024;
/** Per-process ceiling, so log volume stays bounded whatever the client sends. */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

/**
 * Deliberately *not* keyed on the client address.
 *
 * Keying a limiter on `X-Forwarded-For` is the rate-limit bypass that Phase 1.5
 * closed on the backend, and re-introducing it here to protect a log line would
 * trade a real fix for a cosmetic one. A single process-wide bucket bounds the
 * volume regardless of what any header claims, and the genuine client address
 * is already in Caddy's access log.
 */
let windowStart = Date.now();
let acceptedInWindow = 0;

const overRateLimit = (): boolean => {
  const now = Date.now();
  if (now - windowStart >= RATE_WINDOW_MS) {
    windowStart = now;
    acceptedInWindow = 0;
  }
  acceptedInWindow += 1;
  return acceptedInWindow > RATE_LIMIT;
};

const MAX_FIELD = 8000;
const str = (value: unknown, max = MAX_FIELD): string | null =>
  typeof value === "string" ? value.slice(0, max) : null;

export async function POST(request: Request) {
  if (overRateLimit()) {
    return new NextResponse(null, { status: 429 });
  }

  // Read the declared length first so an oversized upload is refused without
  // being buffered. A missing or lying Content-Length falls through to the
  // buffered read below, which is bounded by the slice.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = (await request.text()).slice(0, MAX_BODY_BYTES);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new NextResponse(null, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  /**
   * Allowlist, field by field. Anything the browser sends that is not named
   * here is dropped, including any field a future version of
   * `lib/observability.ts` adds by accident.
   */
  const event = {
    event: "client_error",
    reference: str(body.reference, 100),
    source: str(body.source, 100),
    message: str(body.message, 2000),
    digest: str(body.digest, 200),
    stack: str(body.stack),
    pathname: str(body.pathname, 500),
    userAgent: str(body.userAgent, 500),
    language: str(body.language, 50),
    occurredAt: str(body.occurredAt, 50),
    receivedAt: new Date().toISOString(),
  };

  /**
   * One line, one object, `event: "client_error"` as the selector. A stack trace
   * is embedded in the message with real newlines, so the whole record is
   * JSON-encoded — an unencoded multi-line stack would break every line-oriented
   * log shipper and turn one error into forty apparent lines.
   */
  console.error(JSON.stringify(event));

  return new NextResponse(null, { status: 204 });
}
