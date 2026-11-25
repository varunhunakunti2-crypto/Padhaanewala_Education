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

/**
 * Read at most `MAX_BODY_BYTES` from the request stream, counting bytes as they
 * arrive. `Request.text()` buffers the whole body first, so a chunked upload
 * with no Content-Length (or a lying one) could grow without bound before the
 * old slice-to-32KB check ever ran. Returning `null` here means the cap was
 * crossed; the reader is cancelled at that point rather than drained.
 */
async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    // `cancel()` above has already released the stream in the overflow case.
    try {
      reader.releaseLock();
    } catch {
      /* nothing to release */
    }
  }
}

export async function POST(request: Request) {
  if (overRateLimit()) {
    return new NextResponse(null, { status: 429 });
  }

  // Content-Length is a hint at best: it is client-controlled and absent on
  // chunked uploads. The stream counter below is the only enforced cap.
  let raw: string | null;
  try {
    raw = await readBoundedBody(request);
  } catch {
    // A broken/destroyed stream is a malformed request, not an oversized one.
    return new NextResponse(null, { status: 400 });
  }
  if (raw === null) {
    return new NextResponse(null, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
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
