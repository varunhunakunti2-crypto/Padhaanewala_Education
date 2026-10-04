import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  ENDPOINT_PAGE_SIZES,
  pageSizeFor,
} from "@/lib/api-server";
import { BLOG_PAGE_SIZE, CATALOG_PAGE_SIZE } from "@/lib/api";

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

/**
 * The admin catalogue walk had the same defect, on the same endpoint, and the
 * contract test above did not catch it.
 *
 * `CollegesSection` asked for `GET /colleges?limit=1000` against a route capped
 * at 100. That is a 422, and `useAdminResource` turns any thrown error into its
 * error state — so the panel rendered "Could not reach the colleges API" on
 * every single load. A page-size bug presented as a backend outage, and the
 * contract test was green throughout because the broken call site lived in a
 * client component, not in `ENDPOINT_PAGE_SIZES`.
 *
 * So the second dimension of the contract: the size the *admin client* sends is
 * held against the same real `le=` bounds, by path.
 */
describe("admin catalogue walk stays inside the backend's own caps", () => {
  /**
   * Every path `adminApi` walks with `fetchAllPages`.
   *
   * Was three entries — `/colleges`, `/universities`, `/courses` — which is
   * exactly the gap: the courses, scholarships, exams, blogs and FAQs panels all
   * asked for `limit=1000`, `limit=200` or nothing at all and all got a 422
   * rendered as "Could not reach the API". The contract was green the whole time
   * because the list only recorded the walks that had already been fixed.
   */
  const ADMIN_WALKED_PATHS = [
    "/colleges",
    "/universities",
    "/courses",
    "/scholarships",
    "/exams",
    "/faqs",
    "/banners",
  ] as const;

  /**
   * The two routes that cap at 50 rather than 100, and are therefore walked with
   * `BLOG_PAGE_SIZE` instead of `CATALOG_PAGE_SIZE`.
   */
  const ADMIN_TIGHT_PATHS = ["/blogs", "/blog-categories"] as const;

  it("covers every endpoint the admin client actually walks", () => {
    // Not vacuous: if a route is added to the walk and not here, the loop below
    // is silently not checking it. Stated explicitly so the list has to be kept
    // honest by whoever adds a fourth walk.
    expect(ADMIN_WALKED_PATHS.length).toBeGreaterThan(0);
    for (const path of ADMIN_WALKED_PATHS) {
      expect(boundFor(path), `no backend route found for ${path}`).toBeDefined();
    }
  });

  it("never sends a page size larger than the backend caps that path at", () => {
    for (const path of ADMIN_WALKED_PATHS) {
      const le = boundFor(path);
      if (le === undefined) continue;
      expect(CATALOG_PAGE_SIZE, `${path} asks for ${CATALOG_PAGE_SIZE} but the backend caps limit at ${le}`).toBeLessThanOrEqual(le);
    }
  });

  it("does not exceed the tightest cap among the routes it walks", () => {
    const caps = ADMIN_WALKED_PATHS.map((p) => boundFor(p)).filter(
      (le): le is number => le !== undefined,
    );
    expect(caps.length).toBe(ADMIN_WALKED_PATHS.length);
    expect(CATALOG_PAGE_SIZE).toBeLessThanOrEqual(Math.min(...caps));
  });

  it("walks the 50-capped blog routes with a page size inside their own cap", () => {
    // `BLOG_PAGE_SIZE` exists for exactly this: `CATALOG_PAGE_SIZE` is 100, and
    // asking for 100 here is the same 422 that emptied the public article grid.
    for (const path of ADMIN_TIGHT_PATHS) {
      const le = boundFor(path);
      expect(le, `no backend route found for ${path}`).toBeDefined();
      expect(BLOG_PAGE_SIZE, `${path} asks for ${BLOG_PAGE_SIZE} but the backend caps limit at ${le}`).toBeLessThanOrEqual(le!);
    }
  });
});

/**
 * No admin panel may hard-code a `limit` above the cap, whatever the cap is.
 *
 * The four panels this replaced each built their own query string — `?limit=1000`,
 * `?limit=200`, or none at all — and each one failed the same way. Checking the
 * *sections* rather than the walks is the belt to that braces: a panel that
 * reaches for `apiFetch` with a hand-written `limit` is the exact regression this
 * suite exists to catch, and the walks are all `adminApi` methods now, so any
 * remaining literal in a section file is new.
 */
describe("no admin section hand-writes a page size", () => {
  const SECTIONS_DIR = resolve(import.meta.dirname, "../frontend/components/admin/sections");

  /**
   * Strips comments before scanning.
   *
   * Several of these panels document the exact `?limit=1000` they used to send, so
   * a raw text scan fails on the file that fixed the bug. Matching the source
   * *including* its prose would make the check impossible to satisfy without
   * deleting the explanation of what went wrong.
   */
  function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  function sectionSources(): { file: string; source: string }[] {
    return readdirSync(SECTIONS_DIR)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({
        file: f,
        source: withoutComments(readFileSync(join(SECTIONS_DIR, f), "utf8")),
      }));
  }

  it("finds the section files it is checking", () => {
    expect(sectionSources().length).toBeGreaterThan(10);
  });

  it("can actually strip comments, so the scan below is not trivially empty", () => {
    // Guards the guard: if the stripper stopped matching, this file would go on
    // reporting offenders and someone would "fix" it by deleting the notes.
    const stripped = withoutComments('const a = 1; // limit=999\n/* limit=888 */ const b = 2;');
    expect(stripped).not.toContain("limit=");
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const b = 2;");
  });

  it("contains no `limit=` query parameter in any admin section", () => {
    const offenders = sectionSources().filter((f) => /[?&]limit=/.test(f.source));
    expect(
      offenders.map((f) => f.file),
      "an admin panel is building its own page size; use the adminApi walk instead",
    ).toEqual([]);
  });
});

