import { describe, expect, it } from "vitest";

import {
  BETA_HIDDEN_ROUTES,
  BOTTOM_NAV,
  DASHBOARD_NAV,
  FOOTER_COLS,
  MORE_NAV,
  PRIMARY_NAV,
  ROBOTS_DISALLOW,
  SITEMAP_PAGES,
  SITEMAP_SLUG_SECTIONS,
  isBetaHidden,
  leakedManifestHrefs,
  manifestHrefs,
} from "@/lib/nav";

/**
 * Phase 7.4.
 *
 * The point of this file is that the page manifest and the navigation are the
 * same source of truth, so a hidden page *cannot* reappear in a menu without
 * being reclassified. That property is only worth anything if something checks
 * it, because nothing about the types would catch it: `manifestHrefs()` and
 * `isBetaHidden()` are both perfectly well-typed whether or not the answer is
 * empty.
 *
 * Before this existed, `/mock-tests` was advertised from eleven places across
 * the site while its question bank held zero rows, and the dashboard sidebar had
 * already drifted from the header. Both were found by reading, not by testing.
 */
describe("page manifest", () => {
  it("leaks no de-listed route into the navigation or the footer", () => {
    expect(leakedManifestHrefs()).toEqual([]);
  });

  it("publishes at least one link, so the assertion above cannot pass vacuously", () => {
    // A registry that returned nothing would make the leak test trivially true.
    // This is the guard on the guard.
    expect(manifestHrefs().length).toBeGreaterThan(10);
  });

  it.each([
    ["PRIMARY_NAV", PRIMARY_NAV],
    ["MORE_NAV", MORE_NAV],
    ["BOTTOM_NAV", BOTTOM_NAV],
  ])("%s contains no de-listed route", (_name, items) => {
    for (const item of items) {
      expect(isBetaHidden(item.href), `${item.label} -> ${item.href}`).toBe(false);
    }
  });

  it("FOOTER_COLS contains no de-listed route", () => {
    for (const column of FOOTER_COLS) {
      for (const link of column.links) {
        expect(isBetaHidden(link.href), `${column.title} / ${link.label} -> ${link.href}`).toBe(false);
      }
    }
  });

  it("DASHBOARD_NAV is derived from the header arrays, so it cannot drift", () => {
    // The only entry allowed to be its own thing is the tab's own "Overview".
    const self = DASHBOARD_NAV.filter((i) => i.href === "/dashboard");
    expect(self).toHaveLength(1);
    for (const item of DASHBOARD_NAV) {
      if (item.href === "/dashboard") continue;
      const inHeader = [...PRIMARY_NAV, ...MORE_NAV].some((h) => h.href === item.href);
      expect(inHeader, `${item.href} is in the sidebar but not in the header`).toBe(true);
    }
  });
});

describe("isBetaHidden", () => {
  it("pins the beta scope, so a change to it is a deliberate edit here", () => {
    // `/mock-tests` and `/ask-ai` were de-listed in Phase 6.1 and restored the
    // same day (see the note on `BETA_HIDDEN_ROUTES`). They used to be named
    // literally in this block, which left the suite failing after a decision
    // that `lib/nav.ts` had already documented. Asserting the set against the
    // manifest keeps both directions loud: adding or removing a de-listed route
    // fails here, and so does an `isBetaHidden` that stops recognising one.
    expect([...BETA_HIDDEN_ROUTES]).toEqual([
      "/college-predictor",
      "/plan",
      "/dashboard",
    ]);
  });

  it.each([...BETA_HIDDEN_ROUTES])("matches %s exactly", (route) => {
    expect(isBetaHidden(route)).toBe(true);
  });

  it("matches a detail page under a hidden section, not just the index", () => {
    // `/mock-tests/[slug]` is the real shape of this bug: de-listing only the
    // index would leave the whole section reachable by a direct link. None of
    // today's de-listed routes has a dynamic child yet, so this asserts the
    // contract rather than a live route — which is the point, because the first
    // one to gain a child must already be covered.
    for (const route of BETA_HIDDEN_ROUTES) {
      expect(isBetaHidden(`${route}/some-detail-slug`), route).toBe(true);
    }
  });

  it("ignores a trailing slash", () => {
    expect(isBetaHidden(`${BETA_HIDDEN_ROUTES[0]}/`)).toBe(true);
    expect(isBetaHidden("/")).toBe(false);
  });

  it("does not match a different route that merely shares a prefix", () => {
    // `/plan` vs `/planner` is exactly the class of bug a `startsWith` would
    // introduce, and it would hide a page that was never meant to be hidden.
    expect(isBetaHidden("/planner")).toBe(false);
    expect(isBetaHidden("/dashboard-public")).toBe(false);
  });
});

describe("sitemap", () => {
  it("has no de-listed route among its static pages", () => {
    for (const page of SITEMAP_PAGES) {
      expect(isBetaHidden(page.path), page.path).toBe(false);
    }
  });

  it("does not enumerate slugs for any hidden section", () => {
    for (const section of SITEMAP_SLUG_SECTIONS) {
      expect(isBetaHidden(section.pathPrefix), section.pathPrefix).toBe(false);
    }
  });

  it("declares priorities within the 0-1 range the sitemap format expects", () => {
    for (const page of SITEMAP_PAGES) {
      expect(page.priority, page.path).toBeGreaterThanOrEqual(0);
      expect(page.priority, page.path).toBeLessThanOrEqual(1);
    }
  });
});

describe("robots", () => {
  it("disallows every de-listed route", () => {
    for (const route of BETA_HIDDEN_ROUTES) {
      expect(ROBOTS_DISALLOW, route).toContain(route);
    }
  });

  it("disallows the API surface", () => {
    expect(ROBOTS_DISALLOW).toContain("/api");
  });

  it("does not disallow a route that is in the sitemap", () => {
    // A page can be disallowed and listed; it is legal and common. But it is
    // worth a test that the two lists have not been edited into contradiction.
    for (const page of SITEMAP_PAGES) {
      expect(ROBOTS_DISALLOW, page.path).not.toContain(page.path);
    }
  });
});
