import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminApi, authApi, complianceApi, otpApi } from "@/lib/api";

/**
 * Every endpoint wrapper, called, and held against the backend's real routes.
 *
 * `lib/api.ts` is ~90 one-line functions of the form `apiFetch(path, init)`.
 * Nothing type-checks the *path* or the *method*: `adminApi.updateUser` could
 * `PUT` where the router only declares `PATCH`, or hit `/college` instead of
 * `/colleges`, and `tsc`, lint, a production build and the backend suite would
 * all stay green. That is the same class as BUG-12 — a contract in two halves
 * with nothing holding them together.
 *
 * Two things are asserted for every method:
 *
 * 1. **It resolves.** A wrapper that throws before reaching `fetch` has never
 *    rendered anything and never will, and no test would notice.
 * 2. **Its request line exists on the server.** The paths are read out of
 *    `backend/app/routers/*.py` and turned into matchers, so a path that does
 *    not correspond to a declared route fails here rather than as a 404 that
 *    some caller silently renders as an empty state.
 *
 * The sweep is driven off the objects themselves, so a method added tomorrow is
 * covered the moment it is written.
 */

const V1 = "/api/v1";

let calls: Array<{ url: string; method: string }>;

beforeEach(() => {
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: (init?.method ?? "GET").toUpperCase(),
      });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ---------------------------------------------------------- backend routes */

const ROUTERS = resolve(import.meta.dirname, "../../backend/app/routers");

/** Every route the backend declares, as `{ method, pattern }`. */
function readBackendRoutes(): Array<{ method: string; pattern: RegExp; raw: string }> {
  const out: Array<{ method: string; pattern: RegExp; raw: string }> = [];

  for (const file of readdirSync(ROUTERS).filter((f) => f.endsWith(".py"))) {
    const source = readFileSync(join(ROUTERS, file), "utf8");

    const prefixes = new Map<string, string>();
    for (const m of source.matchAll(/(\w+)\s*=\s*APIRouter\(\s*prefix="([^"]*)"/g)) {
      prefixes.set(m[1], m[2]);
    }

    for (const chunk of source.split(/(?=@\w+\.(?:get|post|put|patch|delete)\()/)) {
      const head = /^@(\w+)\.(get|post|put|patch|delete)\(\s*\n?\s*"([^"]*)"/.exec(chunk);
      if (!head) continue;
      const prefix = prefixes.get(head[1]);
      if (prefix === undefined) continue;

      const full = `${prefix}${head[3]}`.replace(/\/+$/, "") || prefix;
      // `{ref}` -> a path segment. `/` inside a param name is not possible in
      // FastAPI, so a non-greedy segment match is exact.
      const pattern = new RegExp(
        `^${full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[^\\}]+\\\}/g, "[^/]+")}$`,
      );
      out.push({ method: head[2].toUpperCase(), pattern, raw: full });
    }
  }
  return out;
}

const backendRoutes = readBackendRoutes();

describe("backend route reader", () => {
  it("reads a meaningful number of routes, so the sweep below is not vacuous", () => {
    expect(backendRoutes.length).toBeGreaterThan(100);
  });

  it("recognises routes that are known to exist", () => {
    const raws = backendRoutes.map((r) => r.raw);
    expect(raws).toContain("/api/v1/colleges");
    expect(raws).toContain("/api/v1/auth/login");
    expect(raws).toContain("/api/v1/compliance/admin/requests/{request_id}");
  });
});

/* ------------------------------------------------------------- the sweep */

/** Dummy arguments, indexed by position. Every value survives JSON encoding. */
const DUMMY = ["ref", 1, {}, "note"] as const;

interface SweepResult {
  name: string;
  url: string;
  method: string;
  path: string;
}

/** Path a request used, relative to `/api/v1`, with any query dropped. */
function relativePath(url: string): string {
  const withoutQuery = url.split("?")[0];
  return withoutQuery.startsWith(V1) ? withoutQuery.slice(V1.length) || "/" : withoutQuery;
}

/**
 * Call one wrapper with arguments of the right arity.
 *
 * `fn.length` counts declared parameters (excluding those with defaults, which
 * are already satisfied), so `updateUser(id, payload)` gets two arguments and
 * `colleges(params = "")` gets none — the default does the rest.
 */
async function callWrapper(fn: unknown, name: string): Promise<SweepResult> {
  if (typeof fn !== "function") throw new Error(`${name} is not a function`);
  const args = DUMMY.slice(0, (fn as (...a: unknown[]) => unknown).length);
  calls.length = 0;
  await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
  const first = calls[0];
  if (!first) throw new Error(`${name} did not issue a request`);
  return {
    name,
    url: first.url,
    method: first.method,
    path: relativePath(first.url),
  };
}

async function sweep(api: object, label: string): Promise<SweepResult[]> {
  const results: SweepResult[] = [];
  for (const [name, fn] of Object.entries(api)) {
    results.push(await callWrapper(fn, `${label}.${name}`));
  }
  return results;
}

const APIs: Array<[string, object]> = [
  ["authApi", authApi],
  ["otpApi", otpApi],
  ["adminApi", adminApi],
  ["complianceApi", complianceApi],
];

for (const [label, api] of APIs) {
  describe(`${label} request lines`, () => {
    it("resolves every method without throwing", async () => {
      // A wrapper that throws before `fetch` has never rendered anything, and
      // nothing else in the build would notice.
      const results = await sweep(api, label);
      expect(results.length).toBeGreaterThan(3);
    });

    it("sends every request under /api/v1", async () => {
      const results = await sweep(api, label);
      for (const r of results) {
        expect(r.url, `${r.name} sent ${r.url}`).toContain(V1);
        expect(r.method, `${r.name}`).toMatch(/^(GET|POST|PUT|PATCH|DELETE)$/);
      }
    });

    it("declares a route the backend actually has", async () => {
      const unmatched: string[] = [];
      for (const r of await sweep(api, label)) {
        const full = `${V1}${r.path}`;
        const hit = backendRoutes.some(
          (route) => route.method === r.method && route.pattern.test(full),
        );
        if (!hit) unmatched.push(`${r.method} ${full}  (${r.name})`);
      }
      expect(unmatched, "these request lines have no matching backend route").toEqual([]);
    });
  });
}

/* ------------------------------------------------------------ spot checks */

describe("sensitive request lines", () => {
  const requestFor = async (run: () => Promise<unknown>) => {
    calls.length = 0;
    await run();
    return calls[0];
  };

  it("uses PATCH, not PUT, to update a user", async () => {
    // `PATCH /users/{id}` is the route the RBAC self-promotion guard lives on.
    const req = await requestFor(() => adminApi.updateUser(7, {}));
    expect(relativePath(req!.url)).toBe("/users/7");
    expect(req!.method).toBe("PATCH");
  });

  it("uses PATCH for every lead transition the funnel has", async () => {
    for (const run of [
      () => adminApi.updateLeadStatus(3, "contacted"),
      () => adminApi.setLeadFollowUp(3, null),
      () => adminApi.assignLead(3, null),
    ]) {
      const req = await requestFor(run);
      expect(req!.method, `${req!.url} must be PATCH`).toBe("PATCH");
    }
  });

  it("keeps the moderation and assignment sub-paths", async () => {
    const moderate = await requestFor(() => adminApi.moderateReview(9, "approved"));
    expect(relativePath(moderate!.url)).toBe("/reviews/9/moderate");
    expect(moderate!.method).toBe("POST");

    const assign = await requestFor(() => adminApi.assignLead(9, 4));
    expect(relativePath(assign!.url)).toBe("/leads/9/assign");
  });

  it("does not send a hand-built Content-Type on a multipart upload", async () => {
    // The boundary is derived by the runtime; a hand-set header drops it and
    // the upload 422s. Asserted on the actual init, not on the wrapper.
    calls.length = 0;
    const init: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, req?: RequestInit) => {
        calls.push({ url: String(input), method: (req?.method ?? "GET").toUpperCase() });
        init.push(req!);
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.png");
    await adminApi.uploadMedia(form);

    expect(calls[0].method).toBe("POST");
    expect(new Headers(init[0].headers).get("Content-Type")).toBeNull();
  });

  it("reads the staff queue on the admin-only path", async () => {
    const req = await requestFor(() => complianceApi.adminRequests());
    expect(relativePath(req!.url)).toBe("/compliance/admin/requests");
    expect(req!.method).toBe("GET");
  });

  it("sends logout as POST with a body, because the cookie is HttpOnly", async () => {
    const req = await requestFor(() => authApi.logout());
    expect(relativePath(req!.url)).toBe("/auth/logout");
    expect(req!.method).toBe("POST");
  });
});
