import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every path `lib/api-server.ts` fetches must exist on the backend **and answer
 * GET**.
 *
 * `tests/page-size-contract.test.ts` already holds the frontend's page sizes
 * against the backend's `le=` caps. That covers one axis of the same drift — how
 * *much* is asked for — and not the other two: whether the path exists, and
 * whether the method it is fetched with is one the backend serves.
 *
 * Which is how the college page shipped with an empty rankings section. The
 * fan-out in `getCollegeBundle` reached for
 * `GET /colleges/{ref}/rankings/nirf` and `.../rankings/other` the same way it
 * reached for `/placements`, `/cutoffs`, `/fees`, `/seat-matrix` and
 * `/admissions`. Rankings is the one enrichment resource whose per-type list was
 * never written: the backend had `POST`/`PUT`/`DELETE` under both paths and a
 * merged `GET /{college_ref}/rankings`, so the path matched and the method did
 * not. The answer was **405 Method Not Allowed**, which `serverGet` maps to
 * `null`, which `serverGetAll` maps to `[]`, which `mapRankings` renders as no
 * badges — at HTTP 200.
 *
 * The build log was the only place it was visible, which is why it took a
 * console error to find it. This file makes it a test instead.
 *
 * The check is deliberately textual, like its sibling's: the backend is a
 * separate Python application and a Node test cannot import it. Everything it
 * needs — the `APIRouter(prefix=...)` and the `@router.<verb>("path")` above
 * each handler — is readable from source.
 */

const BACKEND_ROUTERS = resolve(import.meta.dirname, "../../backend/app/routers");
const API_SERVER = resolve(import.meta.dirname, "../lib/api-server.ts");

/** `SERVER_API` is `RAW_BACKEND` plus exactly this suffix. */
const API_PREFIX = "/api/v1";

interface BackendRoute {
  /** Method as FastAPI spells it: `get`, `post`, `put`, `patch`, `delete`. */
  verb: string;
  /** Full path, e.g. `/api/v1/colleges/{college_ref}/rankings/nirf`. */
  path: string;
}

/**
 * Strips comments, so the prose explaining a past failure is not scanned as if it
 * were code. Several of these files quote the exact request that used to break.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readBackendRoutes(): BackendRoute[] {
  let files: string[];
  try {
    files = readdirSync(BACKEND_ROUTERS).filter((f) => f.endsWith(".py"));
  } catch {
    return [];
  }

  const out: BackendRoute[] = [];

  for (const file of files) {
    const source = readFileSync(join(BACKEND_ROUTERS, file), "utf8");

    // Router variable -> prefix. A module can declare more than one
    // (`enrichment.py` has `router` and `catalog_router`).
    const prefixes = new Map<string, string>();
    for (const m of source.matchAll(/(\w+)\s*=\s*APIRouter\(\s*prefix="([^"]*)"/g)) {
      prefixes.set(m[1], m[2]);
    }
    if (prefixes.size === 0) continue;

    // Split on route decorators so each chunk is "one decorator plus the
    // signature it introduces".
    const chunks = source.split(/(?=@\w+\.(?:get|post|put|patch|delete)\()/);
    for (const chunk of chunks) {
      const head = /^@(\w+)\.(get|post|put|patch|delete)\(\s*\n?\s*"([^"]*)"/.exec(chunk);
      if (!head) continue;

      const [, routerVar, verb, subPath] = head;
      const prefix = prefixes.get(routerVar);
      if (prefix === undefined) continue;

      const full = `${prefix}${subPath}`.replace(/\/+$/, "") || prefix;
      out.push({ verb, path: full });
    }
  }

  return out;
}

/**
 * Every API path literal in `lib/api-server.ts`, normalised.
 *
 * - `${encodeURIComponent(slug)}` becomes `{param}`, so a template path can be
 *   compared against FastAPI's `{college_ref}`.
 * - The query string is dropped: `/faqs?entity_type=…` and `/faqs` are the same
 *   route as far as this contract is concerned.
 *
 * Quoted literals only, so the regexes in `RAW_BACKEND`'s normalisation
 * (`/\/api\/v1\/?$/`) cannot be mistaken for a path.
 */
function readFetchedPaths(): string[] {
  const source = withoutComments(readFileSync(API_SERVER, "utf8"));
  const paths = new Set<string>();

  for (const m of source.matchAll(/(['"`])(\/[^'"`\n]*)\1/g)) {
    const normalised = m[2]
      .split("?")[0]
      .replace(/\$\{[^}]*\}/g, "{param}")
      .replace(/\/+$/, "");
    if (normalised && normalised !== "/") paths.add(normalised);
  }

  return [...paths];
}

/** Segment-wise match: a FastAPI `{param}` placeholder accepts any one segment. */
function pathMatches(backendPath: string, frontendPath: string): boolean {
  const a = backendPath.split("/");
  const b = frontendPath.split("/");
  if (a.length !== b.length) return false;
  return a.every((segment, i) => /^\{.*\}$/.test(segment) || segment === b[i]);
}

const backendRoutes = readBackendRoutes();
const fetchedPaths = readFetchedPaths();

/** The backend routes that answer a GET at this frontend path, if any. */
function getRoutesFor(frontendPath: string): BackendRoute[] {
  const full = `${API_PREFIX}${frontendPath}`;
  return backendRoutes.filter((r) => r.verb === "get" && pathMatches(r.path, full));
}

describe("route contract between lib/api-server.ts and the backend", () => {
  it("reads the backend routers, so the assertions below are not vacuous", () => {
    // Same reasoning as the equivalent test in `page-size-contract.test.ts`: a
    // moved directory would otherwise make every lookup return nothing and this
    // file would go green having checked nothing.
    expect(backendRoutes.length).toBeGreaterThan(50);
    expect(backendRoutes.filter((r) => r.verb === "get").length).toBeGreaterThan(30);
  });

  it("finds the paths api-server fetches, so the check below is not vacuous", () => {
    expect(fetchedPaths.length).toBeGreaterThan(15);
    // The college detail fan-out, which is where the 405 lived. Named so a
    // scanner regression cannot quietly reduce the checked set to one endpoint.
    for (const path of [
      "/colleges/{param}",
      "/colleges/{param}/placements",
      "/colleges/{param}/cutoffs",
      "/colleges/{param}/rankings/nirf",
      "/colleges/{param}/rankings/other",
      "/colleges/{param}/fees",
      "/colleges/{param}/seat-matrix",
      "/colleges/{param}/admissions",
    ]) {
      expect(fetchedPaths, `${path} was not scanned out of lib/api-server.ts`).toContain(path);
    }
  });

  it("resolves ${...} to a placeholder the backend's {param} can match", () => {
    // Guards the normalisation: if `${…}` stopped collapsing, every path with a
    // parameter in it would report as missing and this file would be noise.
    expect(fetchedPaths).toContain("/exams/{param}");
    expect(fetchedPaths.some((p) => p.includes("${"))).toBe(false);
  });

  it("serves every path api-server fetches with a GET", () => {
    // The bug, stated as a contract: a path the frontend GETs but the backend
    // does not serve with GET returns 405, and 405 is swallowed into an empty
    // page by `serverGet`.
    const unserved = fetchedPaths.filter((path) => getRoutesFor(path).length === 0);
    expect(
      unserved,
      "no backend GET route for these — the request 404s or 405s and renders as an empty section",
    ).toEqual([]);
  });

  it("distinguishes the method, not just the path", () => {
    // Belt to the braces: a lookup that ignored the verb would have passed while
    // the 405 was live, because the *path* existed. There are paths here that
    // are write-only, and they must not be reported as GET-served.
    const writeOnly = backendRoutes.filter(
      (r) => !backendRoutes.some((o) => o.verb === "get" && o.path === r.path),
    );
    expect(writeOnly.length, "no write-only backend path, so the verb filter is untested").toBeGreaterThan(5);
    for (const route of writeOnly) {
      expect(
        route.verb === "get",
        `${route.path} is served as ${route.verb} only`,
      ).not.toBe("get");
    }
  });

  it("does not let a path parameter swallow an extra segment", () => {
    // `/colleges/{param}` must not satisfy `/colleges/{param}/rankings/nirf`.
    // A prefix match would have passed the whole file while checking nothing.
    expect(getRoutesFor("/colleges/{param}").length).toBeGreaterThan(0);
    expect(pathMatches("/api/v1/colleges/{college_ref}", "/api/v1/colleges/x/rankings/nirf")).toBe(false);
  });

  it("keeps the rankings read routes GET-served", () => {
    // The specific regression, named so the failure message says what broke.
    for (const path of ["/colleges/{param}/rankings/nirf", "/colleges/{param}/rankings/other"]) {
      expect(getRoutesFor(path), `${path} has no backend GET`).not.toEqual([]);
    }
  });
});
