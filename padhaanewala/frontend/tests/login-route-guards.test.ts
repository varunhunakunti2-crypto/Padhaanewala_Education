import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/login/route";

/**
 * The no-JavaScript login POST validates `next` a second time before issuing a
 * 303. A guard here that accepts an absolute URL, `//host`, `\host` or a
 * newline turns the sign-in form into an open redirect. These cases are fed
 * through the real handler so the FormData decoding and `new URL` resolution
 * are part of the test, not just the regex.
 */

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function redirectFor(next: string): Promise<string> {
  const form = new FormData();
  form.set("email", "student@example.test");
  form.set("password", "correct horse battery staple");
  form.set("next", next);

  const response = await POST(
    new Request("https://padhaanewala.test/api/auth/login", {
      method: "POST",
      body: form,
    }),
  );

  expect(response.status).toBe(303);
  return response.headers.get("location") ?? "";
}

describe("safeNext in the native login route", () => {
  it("keeps a local absolute path", async () => {
    // Location is relative on purpose: the server may be bound to `::` behind a
    // proxy, so an absolute URL built from request.url would be unroutable.
    expect(await redirectFor("/exams/mains?page=2")).toBe(
      "/exams/mains?page=2",
    );
  });

  it.each([
    ["absolute URL", "https://evil.test/steal"],
    ["protocol-relative", "//evil.test/steal"],
    ["backslash", "/\\evil.test/steal"],
    ["fully encoded slashes", "%2F%2Fevil.test%2Fsteal"],
    ["encoded leading backslash", "%5Cevil.test"],
    ["newline", "/\nLocation: https://evil.test"],
    ["carriage return", "/\rLocation: https://evil.test"],
  ])("falls back to / for %s", async (_label, value) => {
    expect(await redirectFor(value)).toBe("/");
  });
});
