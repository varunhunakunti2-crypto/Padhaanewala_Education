/**
 * Content resolution layer.
 *
 * Single entry point every server component uses to read catalog content.
 * Resolution order:
 *   1. Live FastAPI backend (ISR-cached, see lib/api-server.ts)
 *   2. Bundled literals in lib/data/* — only as a resilience fallback so a
 *      backend outage degrades the page instead of taking it down.
 *
 * `source` is surfaced so the UI can be honest about where data came from, and
 * so operators can tell at a glance whether a page is running on live data.
 */

import { BLOG_POSTS, BLOG_CATEGORIES } from "@/lib/data/blog";
import { COLLEGES, getCollegeBySlug, getFeaturedColleges } from "@/lib/data/colleges";
import { COURSES, getCourseBySlug } from "@/lib/data/courses";
import { EXAMS, getExamBySlug as getBundledExamBySlug } from "@/lib/data/exams";
import { MOCK_TESTS } from "@/lib/data/mockTests";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import type { BlogPost, College, Exam, MockTest, Scholarship } from "@/lib/types";
import type { CourseMeta } from "@/lib/data/courses";
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

export type DataSource = "api" | "bundled";

export interface Resolved<T> {
  data: T;
  source: DataSource;
}

const resolve = <T>(api: T | null | undefined, fallback: T): Resolved<T> => {
  const isEmpty =
    api === null ||
    api === undefined ||
    (Array.isArray(api) && api.length === 0);
  return isEmpty ? { data: fallback, source: "bundled" } : { data: api, source: "api" };
};

/* ------------------------------- colleges ----------------------------- */

export async function resolveColleges(): Promise<Resolved<College[]>> {
  const rows = await getColleges();
  return resolve(
    rows.length ? rows.map((r) => mapCollegeListItem(r)) : null,
    COLLEGES,
  );
}

export async function resolveCollege(slug: string): Promise<Resolved<College | undefined>> {
  const bundle = await getCollegeBundle(slug);
  const apiCollege = bundle ? mapCollege(bundle) : null;
  return resolve(apiCollege, getCollegeBySlug(slug));
}

export async function resolveFeaturedColleges(limit = 9): Promise<Resolved<College[]>> {
  const rows = await getColleges("featured=true&limit=50");
  if (rows.length) {
    return { data: rows.slice(0, limit).map((r) => mapCollegeListItem(r)), source: "api" };
  }
  return { data: getFeaturedColleges().slice(0, limit), source: "bundled" };
}

/* -------------------------------- courses ----------------------------- */

export async function resolveCourses(): Promise<Resolved<CourseMeta[]>> {
  const rows = await getCourses();
  return resolve(
    rows.length ? rows.map((r, i) => mapCourseMeta(r, i)) : null,
    COURSES,
  );
}

export async function resolveCourse(slug: string): Promise<Resolved<CourseMeta | undefined>> {
  const rows = await getCourses();
  const hit = rows.find((c) => c.slug === slug);
  const apiCourse = hit ? mapCourseMeta(hit) : null;
  return resolve(apiCourse, getCourseBySlug(slug));
}

/* --------------------------------- exams ------------------------------ */

export async function resolveExams(): Promise<Resolved<Exam[]>> {
  const rows = await getExams();
  return resolve(rows.length ? rows.map(mapExam) : null, EXAMS);
}

export async function resolveExam(slug: string): Promise<Resolved<Exam | undefined>> {
  const apiExam = await getExamBySlug(slug);
  return resolve(apiExam ? mapExam(apiExam) : null, getBundledExamBySlug(slug));
}

/* ----------------------------- scholarships --------------------------- */

export async function resolveScholarships(): Promise<Resolved<Scholarship[]>> {
  const rows = await getScholarships();
  return resolve(rows.length ? rows.map(mapScholarship) : null, SCHOLARSHIPS);
}

export async function resolveScholarship(
  slug: string,
): Promise<Resolved<Scholarship | undefined>> {
  const apiRow = await getScholarshipBySlug(slug);
  const fallback = SCHOLARSHIPS.find((s) => s.id === slug || slugifyName(s.name) === slug);
  return resolve(apiRow ? mapScholarship(apiRow) : null, fallback);
}

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* --------------------------------- blogs ------------------------------ */

export async function resolveBlogPosts(): Promise<Resolved<BlogPost[]>> {
  const rows = await getBlogs();
  return resolve(rows.length ? rows.map(mapBlogPost) : null, BLOG_POSTS);
}

export async function resolveBlogPost(slug: string): Promise<Resolved<BlogPost | undefined>> {
  const apiPost = await getBlogBySlug(slug);
  const fallback = BLOG_POSTS.find((p) => p.slug === slug);
  return resolve(apiPost ? mapBlogPost(apiPost) : null, fallback);
}

/* ------------------------------ mock tests ---------------------------- */

export async function resolveMockTests(): Promise<Resolved<MockTest[]>> {
  const rows = await getMockTests();
  return resolve(rows.length ? rows.map(mapMockTest) : null, MOCK_TESTS);
}

export async function resolveMockTest(slug: string): Promise<Resolved<MockTest | undefined>> {
  const apiRow = await getMockTestBySlug(slug);
  const fallback = MOCK_TESTS.find((t) => t.slug === slug);
  return resolve(apiRow ? mapMockTest(apiRow) : null, fallback);
}

/* ------------------------------- slugs -------------------------------- */

/** Slug list for generateStaticParams / sitemap, from whichever source is live. */
export async function resolveSlugs(
  kind: "colleges" | "exams" | "courses" | "blogs" | "mock-tests",
): Promise<string[]> {
  switch (kind) {
    case "colleges": {
      const rows = await getColleges();
      return rows.length ? rows.map((r) => r.slug) : COLLEGES.map((c) => c.slug);
    }
    case "exams": {
      const rows = await getExams();
      return rows.length ? rows.map((r) => r.slug) : EXAMS.map((e) => e.slug);
    }
    case "courses": {
      const rows = await getCourses();
      return rows.length ? rows.map((r) => r.slug) : COURSES.map((c) => c.slug);
    }
    case "blogs": {
      const rows = await getBlogs();
      return rows.length ? rows.map((r) => r.slug) : BLOG_POSTS.map((p) => p.slug);
    }
    case "mock-tests": {
      const rows = await getMockTests();
      return rows.length ? rows.map((r) => r.slug) : MOCK_TESTS.map((t) => t.slug);
    }
  }
}

export { BLOG_CATEGORIES };
