/**
 * `/api/ai` is unauthenticated, so its 12/min limiter is the only spend cap.
 * The old clientIp() read `X-Forwarded-For` first, which a caller can set to a
 * different value on every request: the limiter never fired. The edge now sets
 * a server-owned `X-Client-IP`, and this route must read nothing else.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const URL = "http://localhost/api/ai";
const THROTTLED = /asked a lot of questions/;

type AiRoute = typeof import("@/app/api/ai/route");
let route: AiRoute;

beforeEach(async () => {
  // Per-test module instance so the 12/min bucket starts empty.
  vi.resetModules();
  route = await import("@/app/api/ai/route");
  // No upstream call and no real network, whatever the environment says.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("unexpected upstream request");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function post(headers: Record<string, string> = {}): Promise<string> {
  const res = await route.POST(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ message: "Which colleges offer B.Tech?" }),
    }),
  );
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

describe("AI rate limiting keys", () => {
  it("ignores spoofed X-Forwarded-For and limits the trusted client", async () => {
    for (let i = 0; i < 12; i += 1) {
      const reply = await post({
        "X-Client-IP": "203.0.113.10",
        "X-Forwarded-For": `198.51.100.${i + 1}`,
      });
      expect(reply).not.toMatch(THROTTLED);
    }

    // A fresh XFF value must not open a new bucket.
    const reply = await post({
      "X-Client-IP": "203.0.113.10",
      "X-Forwarded-For": "192.0.2.99",
    });
    expect(reply).toMatch(THROTTLED);
  });

  it("falls back to one safe bucket when the trusted header is missing", async () => {
    for (let i = 0; i < 12; i += 1) {
      const reply = await post({
        "X-Forwarded-For": `198.51.100.${i + 1}`,
        "X-Real-IP": `203.0.113.${i + 1}`,
      });
      expect(reply).not.toMatch(THROTTLED);
    }
    expect(await post({ "X-Forwarded-For": "192.0.2.99" })).toMatch(THROTTLED);
  });

  it("keeps the 12-request limit per trusted address", async () => {
    for (let i = 0; i < 12; i += 1) {
      expect(await post({ "X-Client-IP": "203.0.113.10" })).not.toMatch(THROTTLED);
    }
    // A different peer has its own bucket.
    expect(await post({ "X-Client-IP": "203.0.113.11" })).not.toMatch(THROTTLED);
    expect(await post({ "X-Client-IP": "203.0.113.10" })).toMatch(THROTTLED);
  });
});

describe("edge contract for the trusted header", () => {
  it("sets X-Client-IP from the peer and strips client-supplied forwarding headers", () => {
    const caddy = readFileSync(resolve(import.meta.dirname, "../../docker/Caddyfile"), "utf8");
    const routeSource = readFileSync(
      resolve(import.meta.dirname, "../app/api/ai/route.ts"),
      "utf8",
    );

    // Both proxies to Next (the API path and the catch-all that serves /api/ai).
    expect(caddy.match(/header_up -X-Forwarded-For/g)).toHaveLength(2);
    expect(caddy.match(/header_up X-Client-IP \{remote_host\}/g)).toHaveLength(2);
    expect(caddy).toContain("header_up -X-Real-IP");
    expect(routeSource).not.toMatch(/headers\.get\(["']x-forwarded-for["']\)/i);
    expect(routeSource).not.toMatch(/headers\.get\(["']x-real-ip["']\)/i);
  });
});
