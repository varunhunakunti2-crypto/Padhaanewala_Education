import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidateTag }));

import { POST } from "@/app/api/revalidate/route";

/**
 * `POST /api/revalidate` can force every cached catalogue page to refetch, so
 * its authorization branches are a security boundary, not a detail. The route
 * delegates identity to `/users/me/roles` and applies its own admin allowlist;
 * these tests exercise both halves through the real handler.
 */

const body = JSON.stringify({ resources: ["colleges", "scholarships"] });

function request(token?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://padhaanewala.test/api/revalidate", {
    method: "POST",
    headers,
    body,
  });
}

function backend(roles: unknown, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // The mock ignores its arguments; the assertions below inspect the call.
    void _input;
    void _init;
    return new Response(JSON.stringify({ roles }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

beforeEach(() => {
  revalidateTag.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/revalidate authorization", () => {
  it("rejects a missing bearer without contacting the auth service", async () => {
    const fetchMock = backend(["admin"]);
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ revalidated: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired bearer", async () => {
    vi.stubGlobal("fetch", backend([], 401));

    const response = await POST(request("expired-token"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Invalid or expired token." });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("denies an authenticated non-admin", async () => {
    vi.stubGlobal("fetch", backend(["student", { name: "content_manager" }]));

    const response = await POST(request("student-token"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "Admin role required." });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each(["admin", "super_admin"])("allows %s and revalidates the requested tags", async (role) => {
    const fetchMock = backend([{ name: role }]);
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("staff-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: ["colleges", "scholarships"] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/users\/me\/roles$/);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer staff-token");
    expect(revalidateTag).toHaveBeenCalledWith("catalog:colleges", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("catalog:scholarships", { expire: 0 });
  });
});
