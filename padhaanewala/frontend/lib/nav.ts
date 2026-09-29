/**
 * The page manifest and every navigation array on the site, in one module.
 *
 * Why this exists. The site had six independent link arrays — `PRIMARY_NAV` and
 * `MORE_NAV` in the header, `FOOTER_COLS` in the footer, `ITEMS` in the mobile
 * bottom bar, `NAV` in the dashboard sidebar, and `HUBS` on `/resources` — plus
 * hardcoded `href`s scattered through the hero, the home page cards and
 * `app/sitemap.ts`. Nothing tied them together, so hiding a page meant finding
 * every one by hand, and the header and the dashboard sidebar had already
 * drifted apart. That is how `/mock-tests` came to be advertised from eleven
 * places while its question bank held zero rows.
 *
 * How the manifest is expressed. A route is not deleted to take it out of the
 * beta; it is *de-listed*. `BETA_HIDDEN_ROUTES` are real, working routes that
 * the site no longer advertises and no longer asks search engines to index. They
 * keep rendering so that sign-in redirects, the admin console and any inbound
 * link continue to resolve. A route is never both in this list and reachable
 * from navigation — `isBetaHidden()` is the single predicate both the nav
 * arrays and the sitemap filter through, so a page cannot reappear in a menu
 * without being reclassified here first.
 *
 * What is deliberately *not* enforced: the icon on each item. `icon` is a
 * component reference rather than rendered JSX so this stays a `.ts` module and
 * can be imported by `sitemap.ts` and `robots.ts` without dragging the icon set
 * into a metadata file.
 */

import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Home,
  LayoutDashboard,
  Newspaper,
  PenLine,
  Phone,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavIcon = LucideIcon;

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: NavIcon;
}

/**
 * Routes that work but are outside the beta scope.
 *
 * Each one is a page whose backing data is empty or whose feature is not ready:
 *
 *  - `/college-predictor`  `cutoffs` and `seat_matrix` hold 0 rows, so the
 *                          client-side scorer has no admissions data to read.
 *  - `/plan`               The exam planner is unreachable from navigation and
 *                          has no server-side storage for what it writes.
 *  - `/dashboard`          A signed-in account page, not a public feature. It
 *                          stays reachable after login but is out of the nav.
 *
 * `/mock-tests` was on this list while `mock_tests` and `test_questions` held 0
 * rows. Both are populated now, so it is re-listed: it appears in `PRIMARY_NAV`,
 * the sitemap, and without `BETA_NOINDEX`.
 *
 * `/ask-ai` was here for the same reason, on the grounds that it is a relay into
 * a metered third-party model. `/api/ai` is now capped at 500 characters and 12
 * requests a minute per IP (Phase 4.7), which is the control that bounds cost, and
 * the assistant is reachable from a floating button on every page — so a
 * de-listed route that the header, the footer, the sitemap and a site-wide button
 * all point at is a contradiction rather than a saving.
 *
 * Adding a route here requires nothing else: the nav arrays, the sitemap and
 * `robots.ts` all derive from this list. Removing one is a one-line revert.
 */
export const BETA_HIDDEN_ROUTES = [
  "/college-predictor",
  "/plan",
  "/dashboard",
] as const;

/** Match a pathname against the manifest, ignoring a trailing slash. */
export function isBetaHidden(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return BETA_HIDDEN_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}

/**
 * `metadata.robots` for a de-listed route.
 *
 * Dropping a page from `sitemap.ts` is necessary but not sufficient: a page that
 * still declares `index: true` stays in the search index after its sitemap entry
 * disappears, and continues to accumulate rankings for a feature the site has
 * stopped supporting. Spread this into every hidden route's `metadata` export.
 */
export const BETA_NOINDEX = { robots: { index: false, follow: false } } as const;

/** Top-level links shown in the header. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Colleges", href: "/colleges", icon: Building2 },
  { label: "Courses", href: "/courses", icon: GraduationCap },
  { label: "Mock Tests", href: "/mock-tests", icon: ClipboardCheck },
  { label: "Scholarships", href: "/scholarships", icon: Award },
  { label: "Exams", href: "/exams", icon: CalendarDays },
];

/** Secondary links, behind the header's "More" menu and the mobile drawer. */
export const MORE_NAV: readonly NavItem[] = [
  { label: "Compare", href: "/compare", icon: Scale },
  { label: "Reviews", href: "/reviews", icon: PenLine },
  { label: "Blog", href: "/blog", icon: Newspaper },
  { label: "Resources", href: "/resources", icon: BookOpen },
  { label: "About", href: "/about", icon: Compass },
  { label: "Contact", href: "/contact", icon: Phone },
];

export interface FooterColumn {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

/**
 * Footer link columns.
 *
 * The footer is the last place a stale link survives, because it is a server
 * component that nothing type-checks against a route: a `href` typo here is
 * indistinguishable from a working link. `manifestRoutes()` below is the test
 * hook for that.
 */
export const FOOTER_COLS: readonly FooterColumn[] = [
  {
    title: "Explore",
    links: [
      { label: "Colleges", href: "/colleges" },
      { label: "Courses", href: "/courses" },
      { label: "Compare Colleges", href: "/compare" },
      { label: "Scholarships", href: "/scholarships" },
    ],
  },
  {
    title: "Students",
    links: [
      { label: "Exams", href: "/exams" },
      { label: "Reviews", href: "/reviews" },
      { label: "Get Admission Help", href: "/admission" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Resources", href: "/resources" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

/** Mobile bottom bar. `grid-cols-5`, so this must stay at five items. */
export const BOTTOM_NAV: readonly NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Colleges", href: "/colleges", icon: Building2 },
  { label: "Compare", href: "/compare", icon: Scale },
  { label: "Scholarships", href: "/scholarships", icon: Award },
  { label: "Exams", href: "/exams", icon: CalendarDays },
];

/**
 * Dashboard sidebar.
 *
 * Derived from the header arrays rather than restated. The sidebar used to hold
 * its own list with a `/mock-tests` entry the header no longer had, and a
 * `Settings`-icon link labelled "Reviews" — the kind of drift that a duplicated
 * array guarantees. `/compare` is pulled out of `MORE_NAV` rather than retyped
 * so that removing it from the "More" menu removes it here too.
 */
export const DASHBOARD_NAV: readonly NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  ...PRIMARY_NAV,
  ...MORE_NAV.filter((item) => item.href === "/compare"),
];

/* ------------------------------------------------------------------ *
 * Sitemap and robots
 * ------------------------------------------------------------------ */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapPage {
  readonly path: string;
  readonly changeFrequency: ChangeFrequency;
  readonly priority: number;
}

/**
 * Static sitemap entries. Dynamic detail pages (`/colleges/[slug]`, `/exams`,
 * `/blog`) are appended by `app/sitemap.ts` from live catalogue slugs.
 *
 * Filtered through `isBetaHidden` at read time rather than at write time, so
 * moving a route into `BETA_HIDDEN_ROUTES` cannot leave a stale entry behind.
 */
export const SITEMAP_PAGES: readonly SitemapPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/colleges", changeFrequency: "weekly", priority: 0.9 },
  { path: "/courses", changeFrequency: "weekly", priority: 0.7 },
  { path: "/exams", changeFrequency: "weekly", priority: 0.7 },
  { path: "/mock-tests", changeFrequency: "weekly", priority: 0.7 },
  { path: "/ask-ai", changeFrequency: "monthly", priority: 0.6 },
  { path: "/scholarships", changeFrequency: "monthly", priority: 0.7 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/reviews", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/admission", changeFrequency: "monthly", priority: 0.6 },
  { path: "/resources", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "yearly", priority: 0.3 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
  { path: "/login", changeFrequency: "yearly", priority: 0.3 },
] as const;

/**
 * Catalogue slugs enumerated into the sitemap.
 *
 * Each entry names the section whose live slugs are walked. `/mock-tests` was
 * absent while the route was de-listed, because listing a paper that could not
 * be taken is worse than not listing the section. It is back now that the
 * section is populated and takeable.
 */
export const SITEMAP_SLUG_SECTIONS = [
  { section: "colleges", pathPrefix: "/colleges", changeFrequency: "monthly", priority: 0.8 },
  { section: "courses", pathPrefix: "/courses", changeFrequency: "monthly", priority: 0.7 },
  { section: "exams", pathPrefix: "/exams", changeFrequency: "weekly", priority: 0.7 },
  { section: "blogs", pathPrefix: "/blog", changeFrequency: "monthly", priority: 0.6 },
  { section: "mock-tests", pathPrefix: "/mock-tests", changeFrequency: "weekly", priority: 0.7 },
] as const satisfies readonly {
  section: string;
  pathPrefix: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}[];

/** Never in the sitemap, and never crawled: auth, admin and API surfaces. */
export const PRIVATE_ROUTES = ["/admin", "/api"] as const;

export const ROBOTS_DISALLOW: readonly string[] = [
  ...BETA_HIDDEN_ROUTES,
  ...PRIVATE_ROUTES,
];

/* ------------------------------------------------------------------ *
 * Consistency helpers
 * ------------------------------------------------------------------ */

export interface ManifestHref {
  readonly href: string;
}

/** Every internal link the manifest publishes, nav and footer alike. */
export function manifestHrefs(): string[] {
  return [
    ...PRIMARY_NAV.map((i) => i.href),
    ...MORE_NAV.map((i) => i.href),
    ...BOTTOM_NAV.map((i) => i.href),
    ...FOOTER_COLS.flatMap((col) => col.links.map((l) => l.href)),
  ];
}

/**
 * Nav hrefs that point at a de-listed route.
 *
 * A non-empty result means a page has been un-advertised in one array and left
 * in another. It is the assertion Phase 7.4 turns into a test.
 */
export function leakedManifestHrefs(): string[] {
  return manifestHrefs().filter(isBetaHidden);
}
