/**
 * Content resolution layer.
 *
 * Single entry point every server component uses to read catalog content.
 *
 * Resolution is API-only. These resolvers used to fall back to hardcoded
 * literals in `lib/data/*` whenever the backend was unreachable or returned an
 * empty list, which meant the site kept serving invented colleges, courses,
 * exams, scholarships, blog posts and an 83-question mock-test bank during a
 * backend outage — and quietly hid a dead or empty database behind a page that
 * looked populated.
 *
 * Those literal datasets are now empty (see the comments in `lib/data/*`). The
 * resolvers therefore return whatever the API actually holds: an empty list when
 * the table is empty, `undefined` when a record does not exist. Rendering an
 * honest empty state is the correct behaviour when there is no data.
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
import { MOCK_TESTS, getMockTest } from "@/lib/data/mockTests";
import {
  getBlogBySlug,
  getBlogs,
  getCollegeBundle,
  getColleges,
  getCourses,
  getExamBySlug,
  getExams,
  getMockTests,
  getMockTestBySlug,
  getScholarshipBySlug,
  getScholarships,
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
  return list(rows, rows.map((r) => mapCollegeListItem(r)));
}

export async function resolveCollege(slug: string): Promise<Resolved<College | undefined>> {
  const bundle = await getCollegeBundle(slug);
  const college = bundle ? mapCollege(bundle) : undefined;
  return { data: college, source: college ? "api" : "empty" };
}

export async function resolveFeaturedColleges(limit = 9): Promise<Resolved<College[]>> {
  const rows = await getColleges("featured=true&limit=50");
  return list(rows, rows.slice(0, limit).map((r) => mapCollegeListItem(r)));
}

/* -------------------------------- courses ----------------------------- */

export async function resolveCourses(): Promise<Resolved<CourseMeta[]>> {
  const rows = await getCourses();
  return list(rows, rows.map((r, i) => mapCourseMeta(r, i)));
}

export async function resolveCourse(slug: string): Promise<Resolved<CourseMeta | undefined>> {
  const rows = await getCourses();
  const hit = rows.find((c) => c.slug === slug);
  const course = hit ? mapCourseMeta(hit) : undefined;
  return { data: course, source: course ? "api" : "empty" };
}

/* --------------------------------- exams ------------------------------ */

export async function resolveExams(): Promise<Resolved<Exam[]>> {
  const rows = await getExams();
  return list(rows, rows.map(mapExam));
}

export async function resolveExam(slug: string): Promise<Resolved<Exam | undefined>> {
  const exam = await getExamBySlug(slug);
  const mapped = exam ? mapExam(exam) : undefined;
  return { data: mapped, source: mapped ? "api" : "empty" };
}

/* ----------------------------- scholarships --------------------------- */

export async function resolveScholarships(): Promise<Resolved<Scholarship[]>> {
  const rows = await getScholarships();
  return list(rows, rows.map(mapScholarship));
}

export async function resolveScholarship(
  slug: string,
): Promise<Resolved<Scholarship | undefined>> {
  const row = await getScholarshipBySlug(slug);
  const mapped = row ? mapScholarship(row) : undefined;
  return { data: mapped, source: mapped ? "api" : "empty" };
}

/* --------------------------------- blogs ------------------------------ */

export async function resolveBlogPosts(): Promise<Resolved<BlogPost[]>> {
  const rows = await getBlogs();
  return list(rows, rows.map(mapBlogPost));
}

export async function resolveBlogPost(slug: string): Promise<Resolved<BlogPost | undefined>> {
  const post = await getBlogBySlug(slug);
  const mapped = post ? mapBlogPost(post) : undefined;
  return { data: mapped, source: mapped ? "api" : "empty" };
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
      return cap(rows.map((r) => r.slug));
    }
    case "exams": {
      const rows = await getExams();
      return cap(rows.map((r) => r.slug));
    }
    case "courses": {
      const rows = await getCourses();
      return cap(rows.map((r) => r.slug));
    }
    case "blogs": {
      const rows = await getBlogs();
      return cap(rows.map((r) => r.slug));
    }
    case "mock-tests": {
      const rows = await getMockTests();
      if (rows.length) return cap(rows.map((r) => r.slug));
      // `cap` applies here too. This branch used to return the whole local
      // catalogue regardless of `limit`, so a caller that capped the list to
      // keep `generateStaticParams` inside the build budget — which is the
      // entire reason `limit` exists — got an uncapped one whenever the API
      // was empty. Found by `tests/content.test.ts`, which is exactly the case
      // a limit is written for.
      return cap(MOCK_TESTS.map((t) => t.slug));
    }
  }
}
