import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";

/**
 * Browser-visible header contract for `proxy.ts`.
 *
 * `script-src` deliberately still contains `'unsafe-inline'`: Next emits its
 * flight-payload bootstrap as inline `<script>self.__next_f.push(…)</script>`
 * tags even in a production build, and the site prerenders/ISR-caches pages, so
 * a nonce would disable that architecture. This suite records the exception so
 * it cannot be changed accidentally in either direction.
 *
 * What *was* safe to remove: the internal `BACKEND_URL` rewrite target and the
 * `https://*.onrender.com` wildcard. Neither is a browser origin; only the
 * explicit `NEXT_PUBLIC_API_URL` needs a connect-src entry.
 */

const saved = {
  BACKEND_URL: process.env.BACKEND_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
};

beforeEach(() => {
  delete process.env.BACKEND_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function responseFor(pathname: string, env: { prod?: boolean } = {}) {
  vi.stubEnv("NODE_ENV", env.prod ? "production" : "development");
  return proxy(new NextRequest(`https://padhaanewala.test${pathname}`));
}

function directive(csp: string | null, name: string): string {
  return (
    csp
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

describe("proxy security headers", () => {
  it("keeps production script-src honest about Next's inline flight scripts", () => {
    const csp = responseFor("/exams", { prod: true }).headers.get("content-security-policy");

    expect(directive(csp, "script-src")).toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("adds 'unsafe-eval' only in development", () => {
    const dev = responseFor("/exams");
    const csp = dev.headers.get("content-security-policy");

    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(dev.headers.get("strict-transport-security")).toBeNull();
  });

  it("advertises HSTS only outside development", () => {
    expect(responseFor("/exams", { prod: true }).headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("never publishes the internal backend host or a Render wildcard in connect-src", () => {
    process.env.BACKEND_URL = "http://internal.backend.invalid";
    process.env.NEXT_PUBLIC_API_URL = "https://api.padhaanewala.test";

    const csp = responseFor("/login", { prod: true }).headers.get("content-security-policy");
    const connect = directive(csp, "connect-src");

    expect(connect).toBe("connect-src 'self' https://api.padhaanewala.test");
    expect(connect).not.toContain("internal.backend.invalid");
    expect(connect).not.toContain("*.onrender.com");
  });

  it("always sends a strict, cross-origin-safe Referrer-Policy", () => {
    for (const path of ["/login", "/mock-tests/live", "/colleges/iit-delhi"]) {
      expect(responseFor(path).headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    }
  });

  it("grants camera/microphone/display-capture only under /mock-tests", () => {
    const proctored = responseFor("/mock-tests/live").headers.get("permissions-policy") ?? "";
    expect(proctored).toContain("camera=(self)");
    expect(proctored).toContain("microphone=(self)");
    expect(proctored).toContain("display-capture=(self)");
    expect(proctored).not.toContain("camera=()");

    const ordinary = responseFor("/mock-tests-extra").headers.get("permissions-policy") ?? "";
    expect(ordinary).toContain("camera=()");
    expect(ordinary).toContain("microphone=()");
    expect(ordinary).toContain("display-capture=()");
    expect(ordinary).not.toContain("(self)");
  });
});
