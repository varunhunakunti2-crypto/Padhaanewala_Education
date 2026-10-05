import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CACHE_TAGS } from "@/lib/api-server";

/**
 * The catalogue cache, made structural.
 *
 * A college created in `/admin` did not appear on `/colleges`. The cause was
 * not the ISR window itself but two layers that outlived it:
 *
 *   1. Nothing invalidated the cache after an admin write, so the 300s
 *      `REVALIDATE.catalogList` window was the *fastest* a new college could
 *      appear.
 *   2. A module-level `pagedCache` Map memoised paginated walks with no expiry,
 *      so `revalidateTag` could not help even once it existed — a hand-rolled
 *      map is invisible to the Next data cache, and nothing outside the module
 *      could clear it.
 *
 * The fix is `CACHE_TAGS` on every cached fetch plus `revalidateTag` from
 * `app/api/revalidate/route.ts`. That route holds its own name → tag map, and
 * this file is what stops the two from drifting: a resource added to one and
 * forgotten in the other would silently re-open the exact bug this describes,
 * with no type error and no failing test anywhere else.
 */
const ROUTE_FILE = resolve(import.meta.dirname, "../app/api/revalidate/route.ts");
/**
 * Remove comments so text assertions read code, not prose.
 *
 * Block comments first, on a single pass, so a `//` inside a `/** ... *\/` block
 * cannot cut the source short. Line comments are stripped separately for the
 * remainder.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const routeSource = readFileSync(ROUTE_FILE, "utf8");
const apiServerSource = readFileSync(
  resolve(import.meta.dirname, "../lib/api-server.ts"),
  "utf8",
);

/** The `RESOURCE_TAGS` object literal in the route, as raw text. */
function declaredRouteTags(): Map<string, string> {
  const start = routeSource.indexOf("const RESOURCE_TAGS");
  expect(start, "RESOURCE_TAGS not found in the revalidate route").toBeGreaterThan(-1);
  const open = routeSource.indexOf("{", start);
  const close = routeSource.indexOf("};", open);
  expect(close, "unterminated RESOURCE_TAGS literal").toBeGreaterThan(open);

  const body = stripComments(routeSource.slice(open + 1, close));
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    // Strip comments before matching, or the doc comment above each key would be
    // read as the key.
    const code = line.replace(/\/\/.*$/, "").trim();
    const m = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]+)"/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/** The `CACHE_TAGS` object literal in `lib/api-server.ts`, as raw text. */
function declaredServerTags(): Map<string, string> {
  const start = apiServerSource.indexOf("export const CACHE_TAGS");
  expect(start, "CACHE_TAGS not exported from lib/api-server").toBeGreaterThan(-1);
  const open = apiServerSource.indexOf("{", start);
  const close = apiServerSource.indexOf("} as const", open);
  expect(close, "unterminated CACHE_TAGS literal").toBeGreaterThan(open);

  const body = stripComments(apiServerSource.slice(open + 1, close));
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    const code = line.replace(/\/\/.*$/, "").trim();
    const m = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]+)"/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

describe("cache tag contract", () => {
  const server = declaredServerTags();
  const route = declaredRouteTags();

  it("imports a non-empty CACHE_TAGS map at runtime", () => {
    // Proves the text parsing above is checking the real object and not an empty
    // string that happens to satisfy every `toEqual` below.
    expect(Object.keys(CACHE_TAGS).length).toBeGreaterThan(0);
  });

  it("declares the same tag values in both places", () => {
    const serverValues = [...server.values()].sort();
    const routeValues = [...route.values()].sort();
    expect(routeValues).toEqual(serverValues);
  });

  it("covers every resource the admin panel can write", () => {
    // The two that caused the reported bug, plus the neighbours that share the
    // same cache and would fail the same way.
    for (const resource of ["colleges", "courses", "exams", "scholarships"]) {
      expect(server.has(resource), `CACHE_TAGS missing "${resource}"`).toBe(true);
      expect(route.has(resource), `RESOURCE_TAGS missing "${resource}"`).toBe(true);
    }
  });

  it("tags cached fetches by path segment", () => {
    // Without `tags` on the fetch, `revalidateTag` has nothing to act on and
    // revalidating is a silent no-op that still returns 200.
    expect(stripComments(apiServerSource)).toMatch(
      /next:\s*\{\s*revalidate,\s*tags:\s*tagsFor\(path\)/,
    );
  });

  it("has no process-lifetime cache for paginated walks", () => {
    // The regression that made the tag mechanism insufficient. A module-level
    // Map keyed on path is not reachable by `revalidateTag`, so it must not come
    // back.
    //
    // Matched against code with comments stripped: the explanatory comment in
    // `lib/api-server.ts` necessarily *names* the pattern it removed, and a raw
    // text search would fail on its own documentation.
    expect(stripComments(apiServerSource)).not.toMatch(/const pagedCache\s*=/);
    expect(stripComments(apiServerSource)).not.toMatch(/new Map<string,\s*Promise/);
  });

  it("publishes admin writes through the revalidate route", () => {
    // `apiWrite` without the publish step is the original bug with new names.
    const api = readFileSync(resolve(import.meta.dirname, "../lib/api.ts"), "utf8");
    for (const fn of [
      "createCollege",
      "updateCollege",
      "deleteCollege",
      "createCourse",
      "updateCourse",
      "deleteCourse",
    ]) {
      const at = api.indexOf(`${fn}:`);
      expect(at, `adminApi.${fn} not found`).toBeGreaterThan(-1);
      const body = api.slice(at, at + 300);
      expect(body, `adminApi.${fn} bypasses adminWrite`).toContain("adminWrite");
    }
  });
});
