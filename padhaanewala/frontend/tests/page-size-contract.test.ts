import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  ENDPOINT_PAGE_SIZES,
  pageSizeFor,
} from "@/lib/api-server";

/**
 * BUG-05, made structural.
 *
 * `lib/api-server.ts` walks list endpoints with `?limit=&offset=`. The backend
 * caps `limit` per route with `Query(..., le=N)`, and those caps are **not
 * uniform**: `/colleges` and friends allow 100, `/blogs` and `/blog-categories`
 * allow 50.
 *
 * A single shared `PAGE_SIZE = 100` therefore issued `GET /blogs?limit=100`,
 * got a 422, and — because `serverGet` mapped every non-2xx to `null` and `null`
 * to `[]` — served `/blog` as **HTTP 200 with an empty article grid**. The code
 * even carried a comment predicting exactly that, which is how it stayed fixed
 * for as long as it did.
 *
 * Fixing the constant is not enough. The two numbers live in different
 * languages, in different files, in different repositories-worth-of-code, and
 * nothing about either type stops them drifting again. So this file reads the
 * `le=` bounds straight out of the Python routers and holds the frontend's
 * declared page sizes against them. Tightening a backend cap without updating
 * the frontend now fails a test instead of emptying a page.
 */
const BACKEND_ROUTERS = resolve(import.meta.dirname, "../../backend/app/routers");

interface RouteBound {
  /** Full path as the frontend would call it, e.g. `/colleges`. */
  path: string;
  /** The `le=` upper bound on `limit`, or undefined if the route has no cap. */
  le: number | undefined;
}

/**
 * Parse the backend routers.
 *
 * Deliberately a regex reader rather than an import: the backend is a separate
 * Python application with its own venv, and a Node test cannot import it. All
 * this needs is the two facts that can be read textually — the router prefix
 * from `APIRouter(prefix=...)` and the `le=` bound from the `limit` parameter
 * of the function a `@router.get(...)` decorator introduces.
 */
function readBackendBounds(): RouteBound[] {
  let files: string[];
  try {
    files = readdirSync(BACKEND_ROUTERS).filter((f) => f.endsWith(".py"));
  } catch {
    return [];
  }

  const out: RouteBound[] = [];

  for (const file of files) {
    const source = readFileSync(join(BACKEND_ROUTERS, file), "utf8");

    // Router variable -> prefix. A module can declare more than one
    // (`enrichment.py` has `router` and `catalog_router`).
    const prefixes = new Map<string, string>();
    for (const m of source.matchAll(/(\w+)\s*=\s*APIRouter\(\s*prefix="([^"]*)"/g)) {
      prefixes.set(m[1], m[2]);
    }
    if (prefixes.size === 0) continue;

    // Split on route decorators and treat each chunk as "one decorator plus the
    // signature it introduces". A regex with a bounded `[\s\S]{n}?` window was
    // tried first and silently dropped every handler whose signature happened to
    // be long — which is exactly how `/universities` went missing and the test
    // would have passed while checking nothing.
    const chunks = source.split(/(?=@\w+\.(?:get|post|put|patch|delete)\()/);
    for (const chunk of chunks) {
      const head = /^@(\w+)\.(?:get|post|put|patch|delete)\(\s*\n?\s*"([^"]*)"/.exec(chunk);
      if (!head) continue;

      const [, routerVar, subPath] = head;
      const prefix = prefixes.get(routerVar);
      if (prefix === undefined) continue;

      // Everything up to the closing `):` of the parameter list.
      const signatureEnd = chunk.indexOf("\n):");
      const signature = signatureEnd === -1 ? chunk : chunk.slice(0, signatureEnd);

      // `limit: int = Query(50, ge=1, le=100)` — read the bound from inside the
      // `Query(...)` call, not by scanning to the next `le=`, which would pick
      // up a neighbouring parameter's bound.
      const queryArgs = /limit:\s*[^,()]*=\s*Query\(([^)]*)\)/.exec(signature);
      const le = queryArgs ? /le=(\d+)/.exec(queryArgs[1]) : null;

      out.push({
        path: `${prefix}${subPath}`.replace(/\/+$/, "") || prefix,
        le: le ? Number(le[1]) : undefined,
      });
    }
  }

  return out;
}

const backendBounds = readBackendBounds();

/** The frontend's endpoint key is the path relative to `/api/v1`. */
function boundFor(endpointKey: string): number | undefined {
  const full = `/api/v1${endpointKey}`;
  // Prefer an exact match; fall back to the longest prefix so a route declared
  // as `/colleges` still answers for `/colleges/cutoffs`-style sub-paths.
  const exact = backendBounds.find((b) => b.path === full);
  if (exact) return exact.le;
  const prefixed = backendBounds
    .filter((b) => full.startsWith(`${b.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return prefixed?.le;
}

describe("page-size contract between frontend and backend", () => {
  it("can read the backend at all, so the assertions below are not vacuous", () => {
    // Without this, a moved directory or a refactor of the routers would make
    // every bound `undefined`, every comparison below skip, and the file would
    // go green having checked nothing. The same reasoning as the "not vacuously
    // empty" test in `nav-manifest.test.ts`.
    expect(backendBounds.length).toBeGreaterThan(15);
    expect(backendBounds.filter((b) => b.le !== undefined).length).toBeGreaterThan(10);
  });

  it("declares a page size for every endpoint the frontend walks with the paged fetcher", () => {
    for (const key of Object.keys(ENDPOINT_PAGE_SIZES)) {
      expect(boundFor(key), `no backend route found for ${key}`).toBeDefined();
    }
  });

  it("never declares a page size larger than the backend's own cap", () => {
    // The BUG-05 assertion, stated directly.
    for (const [key, size] of Object.entries(ENDPOINT_PAGE_SIZES)) {
      const le = boundFor(key);
      if (le === undefined) continue;
      expect(size, `${key} asks for ${size} but the backend caps limit at ${le}`).toBeLessThanOrEqual(le);
    }
  });

  it("keeps the default page size safe against every capped route in the API", () => {
    // This is what stops a *newly added* paged call site from re-arming BUG-05.
    // An endpoint only opts above the floor by naming itself in the map, where
    // the test above holds it to the real bound.
    const caps = backendBounds
      .map((b) => b.le)
      .filter((le): le is number => le !== undefined);
    expect(caps.length).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(Math.min(...caps));
  });

  it("resolves an unknown endpoint to the safe default rather than to a guess", () => {
    expect(pageSizeFor("/not-a-real-endpoint")).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeFor("/blogs?status=published")).toBe(50);
    expect(pageSizeFor("/colleges?state=Kerala")).toBe(100);
  });

  it("gives the 50-capped endpoints a page size that is not larger than 50", () => {
    // Spelled out rather than left to the generic loop, because these two are
    // the routes BUG-05 actually broke and the ones most likely to be retightened.
    expect(ENDPOINT_PAGE_SIZES["/blogs"]).toBeLessThanOrEqual(50);
    expect(ENDPOINT_PAGE_SIZES["/blog-categories"]).toBeLessThanOrEqual(50);
  });
});
