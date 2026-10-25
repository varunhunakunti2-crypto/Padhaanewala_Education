/**
 * Content resolution layer.
 *
 * Single entry point every server component uses to read catalog content.
 *
 * The resolvers prefer the API and fall back to the curated literals in
 * `lib/data/*` only when the backend is unreachable or returns an empty list —
 * so the public catalogue stays populated during an outage. That is a
 * deliberate trade-off: with the fallback in place, an empty database renders
 * the curated list instead of an honest empty state. `BLOG_POSTS` alone is
 * intentionally empty, so blogs still degrade to an honest empty list.
 *
 * EXCEPTION — mock tests, and the reason has changed. When the runner graded in
 * the browser it never touched the attempt endpoints, so a locally listed paper
 * could produce a detail page that 404'd; hence the fallback below. The runner now
 * starts, saves and submits against the backend (`mockTestsApi`), so a paper's
 * questions, clock and grade are server-owned. The fallback survives for a
 * different reason: `resolveMockTest` feeds the *presentation* fields
 * (`withLocalContent`), and the local catalogue is where the display metadata for
 * the bundled papers lives. It is still scoped to mock tests on purpose — the
 * wider "don't hide an empty database" rule above is in force everywhere else.
 *
 * A paper created through the PDF importer is listed from the API and has no local
 * entry, which is correct: `withLocalContent` returns the API row untouched rather
 * than substituting a different paper's questions.
 */

import type { BlogPost, College, Exam, MockTest, Scholarship } from "@/lib/types";
import type { CourseMeta } from "@/lib/data/courses";
import { COLLEGES } from "@/lib/data/colleges";
import { COURSES } from "@/lib/data/courses";
import { EXAMS } from "@/lib/data/exams";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import { BLOG_POSTS } from "@/lib/data/blog";
import { MOCK_TESTS, getMockTest } from "@/lib/data/mockTests";
import {
  getBlogBySlug,
  getBlogs,
  getCollegeBundle,
  getColleges,
  getCourses,
  getExamBySlug,
  getExams,
  getHeroCards,
  getMockTests,
  getMockTestBySlug,
  getScholarshipBySlug,
  getScholarships,
  getStripBanners,
} from "@/lib/api-server";
import {
  mapBlogPost,
  mapCollege,
  mapCollegeListItem,
  mapCourseMeta,
  mapExam,
  mapMockTest,
  mapScholarship,
} from "@/lib/mappers";

/**
 * `api`   — the backend answered.
 * `local` — the backend had nothing and the local mock-test catalogue was used.
 * `empty` — nothing to show (no rows, or record not found).
 */
export type DataSource = "api" | "local" | "empty";

export interface Resolved<T> {
  data: T;
  source: DataSource;
}

const list = <In, Out>(rows: In[] | null | undefined, mapped: Out[]): Resolved<Out[]> => ({
  data: mapped,
  source: mapped.length ? "api" : "empty",
});

/* ------------------------------- colleges ----------------------------- */

export async function resolveColleges(): Promise<Resolved<College[]>> {
  const rows = await getColleges();
  const mapped = rows.map((r) => mapCollegeListItem(r));
  if (mapped.length) return { data: mapped, source: "api" };
  return { data: COLLEGES, source: COLLEGES.length ? "local" : "empty" };
}

export async function resolveCollege(slug: string): Promise<Resolved<College | undefined>> {
  const bundle = await getCollegeBundle(slug);
  const college = bundle ? mapCollege(bundle) : undefined;
  if (college) return { data: college, source: "api" };
  const local = COLLEGES.find((c) => c.slug === slug);
  return { data: local, source: local ? "local" : "empty" };
}

export async function resolveFeaturedColleges(limit = 9): Promise<Resolved<College[]>> {
  const rows = await getColleges("featured=true&limit=50");
  const mapped = rows.slice(0, limit).map((r) => mapCollegeListItem(r));
  if (mapped.length) return { data: mapped, source: "api" };
  const featured = COLLEGES.filter((c) => c.featured).slice(0, limit);
  const data = featured.length ? featured : COLLEGES.slice(0, limit);
  return { data, source: data.length ? "local" : "empty" };
}

/* -------------------------------- courses ----------------------------- */

export async function resolveCourses(): Promise<Resolved<CourseMeta[]>> {
  const rows = await getCourses();
  const mapped = rows.map((r, i) => mapCourseMeta(r, i));
  if (mapped.length) return { data: mapped, source: "api" };
  return { data: COURSES, source: COURSES.length ? "local" : "empty" };
}

export async function resolveCourse(slug: string): Promise<Resolved<CourseMeta | undefined>> {
  const rows = await getCourses();
  const hit = rows.find((c) => c.slug === slug);
  const course = hit ? mapCourseMeta(hit) : undefined;
  if (course) return { data: course, source: "api" };
  const local = COURSES.find((c) => c.slug === slug);
  return { data: local, source: local ? "local" : "empty" };
}

/* --------------------------------- exams ------------------------------ */

export async function resolveExams(): Promise<Resolved<Exam[]>> {
  const rows = await getExams();
  const mapped = rows.map(mapExam);
  if (mapped.length) return { data: mapped, source: "api" };
  return { data: EXAMS, source: EXAMS.length ? "local" : "empty" };
}

export async function resolveExam(slug: string): Promise<Resolved<Exam | undefined>> {
  const exam = await getExamBySlug(slug);
  const mapped = exam ? mapExam(exam) : undefined;
  if (mapped) return { data: mapped, source: "api" };
  const local = EXAMS.find((e) => e.slug === slug);
  return { data: local, source: local ? "local" : "empty" };
}

/* ----------------------------- scholarships --------------------------- */

export async function resolveScholarships(): Promise<Resolved<Scholarship[]>> {
  const rows = await getScholarships();
  const mapped = rows.map(mapScholarship);
  if (mapped.length) return { data: mapped, source: "api" };
  return { data: SCHOLARSHIPS, source: SCHOLARSHIPS.length ? "local" : "empty" };
}

/**
 * Scholarship detail by its catalogue identifier.
 *
 * The backend addresses scholarships by `scholarship_ref` (the record's `id`);
 * there is no `slug` field on a scholarship, contrary to the other catalogues.
 */
export async function resolveScholarship(
  id: string,
): Promise<Resolved<Scholarship | undefined>> {
  const row = await getScholarshipBySlug(id);
  const mapped = row ? mapScholarship(row) : undefined;
  if (mapped) return { data: mapped, source: "api" };
  const local = SCHOLARSHIPS.find((s) => s.id === id);
  return { data: local, source: local ? "local" : "empty" };
}

/* --------------------------------- blogs ------------------------------ */

export async function resolveBlogPosts(): Promise<Resolved<BlogPost[]>> {
  const rows = await getBlogs();
  const mapped = rows.map(mapBlogPost);
  if (mapped.length) return { data: mapped, source: "api" };
  return { data: BLOG_POSTS, source: BLOG_POSTS.length ? "local" : "empty" };
}

export async function resolveBlogPost(slug: string): Promise<Resolved<BlogPost | undefined>> {
  const post = await getBlogBySlug(slug);
  const mapped = post ? mapBlogPost(post) : undefined;
  if (mapped) return { data: mapped, source: "api" };
  const local = BLOG_POSTS.find((p) => p.slug === slug);
  return { data: local, source: local ? "local" : "empty" };
}

/* ------------------------------ mock tests ---------------------------- */

export async function resolveMockTests(): Promise<Resolved<MockTest[]>> {
  const rows = await getMockTests();
  const mapped = rows.map(mapMockTest);
  if (mapped.length) return list(rows, mapped);
  return { data: MOCK_TESTS, source: MOCK_TESTS.length ? "local" : "empty" };
}

/**
 * Reconciles an API paper row with its local catalogue entry.
 *
 * `mapMockTest` translates an `ApiMockTest` faithfully, but the response does not
 * carry everything the setup screen renders:
 *
 *   * `subject` — `text(api.subject, "Mixed")`. A three-subject paper stores NULL
 *     (that is the documented "mixed" signal, see `MockTest.subject`), so it maps
 *     to the string "Mixed", which matches no subject pool.
 *   * `marksPerCorrect` / `marksPerWrong` — absent, so `resolveMarks` would apply
 *     its +3 / −1 default. A JEE Main paper is +4 / −1.
 *   * `description` — read from `instructions`, which is null for this paper, so
 *     the blurb would vanish.
 *
 * So the local catalogue stays the base: it is the curated presentation metadata
 * for the bundled papers. The API row is authoritative for the things only it
 * knows — the database id and how many attempts the policy allows.
 *
 * Two of the reconciler's original reasons no longer apply, and it is worth being
 * explicit about why they are absent rather than leaving a comment that describes a
 * runner this is no longer: `questionIds` and `marksPerCorrect` used to exist
 * because the runner sampled questions locally and graded locally. It does neither
 * now. `ProctoredMockTest` calls `POST /mock-tests/{ref}/start` and takes its
 * questions, marks and clock from the response, and the grade comes from
 * `POST .../submit`. So the local catalogue's `questionIds` are decorative for a
 * student sitting the paper, and `resolveMarks` on the results screen would have
 * contradicted the server's own scoring -- which is why the results screen now
 * reports `total_marks` instead of a per-paper ±rule.
 *
 * A paper with no local entry is returned as mapped, untouched. That is the case
 * that matters for the PDF importer: an imported paper reaches a student through
 * this path, and substituting a bundled paper's metadata here would show them the
 * wrong title, marks and description for questions they are about to sit.
 */
function withLocalContent(api: MockTest, slug: string): MockTest {
  const local = getMockTest(slug);
  if (!local) return api;
  return {
    ...local,
    id: api.id,
    attempts: api.attempts,
  };
}

export async function resolveMockTest(slug: string): Promise<Resolved<MockTest | undefined>> {
  const row = await getMockTestBySlug(slug);
  if (row) return { data: withLocalContent(mapMockTest(row), slug), source: "api" };
  const local = getMockTest(slug);
  return { data: local, source: local ? "local" : "empty" };
}

/* ------------------------------ hero cards ---------------------------- */

/**
 * A floating card beside the hero search, in the shape the hero renders.
 *
 * Deliberately not `ApiBanner`: the panel needs a guaranteed non-null `href`
 * and a resolved CTA string, and it must not care whether a row came from the
 * database or from `HERO_CARD_DEFAULTS`. Keeping this the presentation type
 * means `HeroVisualPanel` never branches on a data source.
 */
export interface HeroCard {
  title: string;
  /** CTA line under the title ("Find opportunities"). Never empty. */
  action: string;
  /** Always a renderable path or absolute URL; null links are dropped. */
  href: string;
  /** Thumbnail URL, or null when the row has no image. */
  thumb: string | null;
}

/**
 * The three cards the hero shipped with before they were admin-editable.
 *
 * This is the one place a fallback is still warranted, and it differs from the
 * catalog resolvers above in a way worth naming: those fall back because a
 * cold database would render an empty catalogue, which reads as a broken site.
 * Here an empty `hero_card` slot is not a failure — it is the admin having
 * chosen to show nothing. So this fallback is only for the *unreachable*
 * case (backend down), where the hero would otherwise render a bare headline
 * with no cards at all. An empty-but-healthy database renders no cards, and
 * that is correct; `resolveHeroCards` reports `empty` for it.
 *
 * These are seeded into the database by migration `a3f8d21c9b47`, so in
 * practice this literal is a cold-start safety net rather than the usual path.
 */
const HERO_CARD_DEFAULTS: readonly HeroCard[] = [
  {
    title: "Top Engineering Colleges in India",
    action: "Explore now",
    href: "/colleges?stream=engineering",
    thumb:
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    title: "Scholarships for Your Goals",
    action: "Find opportunities",
    href: "/scholarships",
    thumb:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    title: "Compare Colleges Side by Side",
    action: "Make smarter choices",
    href: "/compare",
    thumb:
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=160&h=160&q=80",
  },
];

/** The default CTA for a row saved without a subtitle. */
const HERO_CARD_DEFAULT_ACTION = "Learn more";

/**
 * Admin-authored links only — the same rule `app/schemas/content.py` enforces
 * on write, re-checked here because a row can predate that validation or be
 * inserted straight into the table. `//evil.example` is the case that looks
 * like a path but resolves to another origin, so it is excluded alongside the
 * `javascript:`/`data:` schemes.
 */
export function isRenderableHref(href: string | null | undefined): href is string {
  if (!href) return false;
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("//")) return false;
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

/**
 * The hero cards, in `display_order`, unbounded.
 *
 * Three outcomes, and the distinction is the point:
 *   * `api`    — at least one card came back; the panel renders those.
 *   * `empty`  — the backend answered with no cards (an admin cleared the
 *                slot). The panel renders nothing, which is the honest state.
 *   * `local`  — the backend did not answer, so the shipped defaults stand in
 *                and the hero keeps its three cards through an outage.
 *
 * No cap: the panel scrolls, so truncating here would silently drop the fourth
 * announcement an admin added.
 */
export async function resolveHeroCards(): Promise<Resolved<HeroCard[]>> {
  const rows = await getHeroCards();

  // `null` is "the backend did not answer" — the only case that falls back.
  // This must be checked before mapping, because the distinction between
  // "answered with nothing" and "did not answer" is exactly what `null`
  // encodes; folding it into `[]` here would reintroduce the bug.
  if (rows === null) return { data: [...HERO_CARD_DEFAULTS], source: "local" };

  const mapped: HeroCard[] = rows
    .filter((r) => isRenderableHref(r.link_url))
    .map((r) => ({
      title: r.title,
      action: r.subtitle?.trim() || HERO_CARD_DEFAULT_ACTION,
      href: r.link_url as string,
      thumb: r.image_url,
    }));

  if (mapped.length) return { data: mapped, source: "api" };
  // Answered, but every row was unusable or the slot is empty. Both are an
  // honest "no cards": the admin cleared it, or authored links we refuse to
  // render. Showing the shipped defaults here would resurrect content the
  // admin deliberately removed.
  return { data: [], source: "empty" };
}

/* ------------------------------ home strip ---------------------------- */

/**
 * One promotional banner in the homepage strip (`position='home_top'`).
 *
 * Unlike `HeroCard`, the link is optional: the admin schema allows a banner
 * with no `link_url`, and a promo can be informational ("Admissions close on
 * 30 June") without sending the visitor anywhere. A row whose authored link is
 * not renderable keeps the banner and drops the link rather than disappearing —
 * the same reading `resolveHeroCards` gives a bad row, except that the strip has
 * a non-link state to fall back to.
 */
export interface StripBanner {
  id: number;
  title: string;
  /** Supporting line under the title, or null when the row has none. */
  subtitle: string | null;
  /** A renderable path or absolute URL, or null when there is nowhere to go. */
  href: string | null;
  /** Background image URL, or null when the row has no image. */
  image: string | null;
}

/**
 * The homepage strip, in `display_order`, unbounded.
 *
 * No shipped fallback, deliberately. A hero without its three shipped cards is
 * a bare headline, but a strip without banners is simply a site with no
 * promotion running — and inventing one would put words in the operator's
 * mouth. So an unreachable backend and an emptied slot both resolve to
 * `empty`, and `PromoStrip` renders nothing for either.
 */
export async function resolveHomeStrip(): Promise<Resolved<StripBanner[]>> {
  const rows = await getStripBanners();
  if (rows === null) return { data: [], source: "empty" };

  const mapped: StripBanner[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle?.trim() || null,
    href: isRenderableHref(r.link_url) ? r.link_url : null,
    image: r.image_url?.trim() || null,
  }));

  return { data: mapped, source: mapped.length ? "api" : "empty" };
}

/* ------------------------------- slugs -------------------------------- */

/**
 * Slug list for generateStaticParams / sitemap, taken from the API.
 *
 * `limit` caps how many slugs are returned. `generateStaticParams` uses a cap
 * because prerendering every catalogue page at build time does not scale: the
 * college page fans out to `getCollegeBundle` (9 requests) plus the college
 * list, so 341 colleges meant ~4000 build-time requests and the build began
 * timing out at 60s per page and failing outright. Unlisted params are still
 * generated on first request and then cached by ISR (`dynamicParams`
 * defaults to true), and `app/sitemap.ts` calls this without a limit so every
 * page stays discoverable — seeding the build and enumerating the catalogue
 * are different jobs and should not share one number.
 */
export async function resolveSlugs(
  kind: "colleges" | "exams" | "courses" | "blogs" | "mock-tests",
  limit?: number,
): Promise<string[]> {
  const cap = (slugs: string[]) => (limit ? slugs.slice(0, limit) : slugs);
  switch (kind) {
    case "colleges": {
      const rows = await getColleges();
      if (rows.length) return cap(rows.map((r) => r.slug));
      return cap(COLLEGES.map((c) => c.slug));
    }
    case "exams": {
      const rows = await getExams();
      if (rows.length) return cap(rows.map((r) => r.slug));
      return cap(EXAMS.map((e) => e.slug));
    }
    case "courses": {
      const rows = await getCourses();
      if (rows.length) return cap(rows.map((r) => r.slug));
      return cap(COURSES.map((c) => c.slug));
    }
    case "blogs": {
      const rows = await getBlogs();
      if (rows.length) return cap(rows.map((r) => r.slug));
      return cap(BLOG_POSTS.map((b) => b.slug));
    }
    case "mock-tests": {
      const rows = await getMockTests();
      if (rows.length) return cap(rows.map((r) => r.slug));
      return cap(MOCK_TESTS.map((t) => t.slug));
    }
  }
}
