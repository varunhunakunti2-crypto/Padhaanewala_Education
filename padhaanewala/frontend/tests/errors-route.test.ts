/**
 * The unauthenticated error sink must stay bounded even when a client lies
 * about Content-Length or uses chunked transfer encoding, where there is no
 * length to check at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const URL = "http://localhost/api/errors";

type ErrorsRoute = typeof import("@/app/api/errors/route");
let route: ErrorsRoute;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  // The 60/min bucket is process state; each test gets a fresh module.
  vi.resetModules();
  route = await import("@/app/api/errors/route");
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonRequest(payload: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

/** Undici requires `duplex` when a Request body is a stream. */
function streamRequest(body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);
}

describe("bounded error-report bodies", () => {
  it("returns 413 as soon as a chunked body crosses 32 KB, without waiting for the rest", async () => {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        // 20 KB chunks: the second one crosses the cap, so a third must never
        // be pulled. The old `await request.text()` drained everything first.
        controller.enqueue(new Uint8Array(20 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });

    const res = await route.POST(streamRequest(body));

    expect(res.status).toBe(413);
    expect(pulls).toBe(2);
    expect(cancelled).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("ignores a Content-Length that understates a chunked body", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20 * 1024));
        controller.enqueue(new Uint8Array(20 * 1024));
        controller.close();
      },
    });

    const res = await route.POST(streamRequest(body, { "content-length": "1" }));

    expect(res.status).toBe(413);
  });

  it("accepts a normal body even if Content-Length claims it is huge", async () => {
    const res = await route.POST(
      jsonRequest({ message: "A short report", secret: "not allowlisted" }, {
        "content-length": "999999",
      }),
    );

    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    const event = JSON.parse(log.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(event.event).toBe("client_error");
    expect(event.message).toBe("A short report");
    expect(event).not.toHaveProperty("secret");
  });

  it("keeps the 400 response for malformed or non-object JSON", async () => {
    expect((await route.POST(jsonRequest("[1,2,3]"))).status).toBe(400);
    expect(
      (
        await route.POST(
          new Request(URL, { method: "POST", body: "{not json" }),
        )
      ).status,
    ).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it("returns 400 when the request stream errors", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("stream broke"));
      },
    });

    const res = await route.POST(streamRequest(body));

    expect(res.status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it("still refuses the 61st accepted report in a one-minute window", async () => {
    for (let i = 0; i < 60; i += 1) {
      expect((await route.POST(jsonRequest({ message: `report ${i}` }))).status).toBe(204);
    }
    expect((await route.POST(jsonRequest({ message: "one too many" }))).status).toBe(429);
    expect(log).toHaveBeenCalledTimes(60);
  });
});
