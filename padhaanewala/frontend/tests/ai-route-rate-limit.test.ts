import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/route";

/**
 * P6 — `/api/ai` delegates rate limiting to the backend's shared Redis limiter.
 *
 * The old route kept a `Map` in module scope, which meant N Next.js instances
 * had N independent counters and a caller could multiply their quota by hitting
 * a different instance. These tests pin the replacement behaviour:
 *
 *  * a 429 from the shared limiter stays a 429 and keeps its P5 headers,
 *  * a fail-closed limiter 503 stays a 503,
 *  * provider/config failures still use the offline responder,
 *  * the caller's `Authorization` and original proxy headers are forwarded,
 *  * the input validation from the old route is intact,
 *  * the module contains no process-local limiter.
 */

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared limiter responses", () => {
  it("propagates a 429 with the P5 headers instead of a 200", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        429,
        {
          "Retry-After": "12",
          "RateLimit-Limit": "10",
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": "12",
        },
      ),
    );

    const response = await POST(makeRequest({ message: "hello" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("RateLimit-Reset")).toBe("12");
    const body = await response.json();
    expect(body.reply).toContain("a lot of questions");
  });

  it("propagates the fail-closed limiter 503", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Request throttling is temporarily unavailable",
          },
        },
        503,
        { "Retry-After": "1" },
      ),
    );

    const response = await POST(makeRequest({ message: "hello" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
  });

  it("keeps the offline responder for a provider/config 503", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "The AI assistant is not configured." }, 503),
    );

    const response = await POST(makeRequest({ message: "hello" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reply).toContain("isn't available");
  });

  it("keeps the offline responder for a provider 502", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "The AI provider rejected the request." }, 502),
    );

    const response = await POST(makeRequest({ message: "hello" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reply).toContain("isn't available");
  });

  it("forwards Authorization and the original proxy IP headers unchanged", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: "answered" }));

    const response = await POST(
      makeRequest(
        { message: "hello" },
        {
          Authorization: "Bearer verified-jwt",
          "X-Forwarded-For": "203.0.113.7, 10.0.0.1",
          "X-Real-IP": "203.0.113.7",
          "X-User-ID": "999",
        },
      ),
    );

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer verified-jwt");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7, 10.0.0.1");
    expect(headers.get("x-real-ip")).toBe("203.0.113.7");
    // A client-supplied identity header must never be forwarded.
    expect(headers.get("x-user-id")).toBeNull();
  });
});

describe("validation and cost guards", () => {
  it("does not call the backend for an empty message", async () => {
    const response = await POST(makeRequest({ message: "   " }));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.reply.toLowerCase()).toContain("type a question");
  });

  it("does not call the backend for a message over 500 characters", async () => {
    const response = await POST(makeRequest({ message: "x".repeat(501) }));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.reply.toLowerCase()).toContain("a little long");
  });

  it("rejects an oversized request body before parsing or calling the backend", async () => {
    const response = await POST(makeRequest("x".repeat(16 * 1024 + 1)));

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("process-local limiter removal", () => {
  it("contains no in-memory Map throttle", () => {
    const source = readFileSync("app/api/ai/route.ts", "utf8");
    expect(source).not.toMatch(/new Map/);
    expect(source).not.toMatch(/isThrottled/);
    expect(source).not.toMatch(/AI_RATE_LIMIT/);
    expect(source).not.toMatch(/buckets/);
  });
});
