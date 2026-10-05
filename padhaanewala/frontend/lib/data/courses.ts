import type { College } from "@/lib/types";
import { COLLEGES } from "./colleges";
import { COURSE_DETAILS } from "./courseDetails";
import { matchesTokens, searchTokens } from "./index";

export interface CourseMeta {
  slug: string;
  name: string;
  degree: string;
  level: "UG" | "PG" | "Doctoral" | "Diploma";
  description: string;
  duration: string;
  avgFeeYear: number;
  hot: boolean;
}

export const COURSES: CourseMeta[] = [];

export function collegesOffering(
  courseSlug: string,
  dataset: College[] = COLLEGES,
  catalog: CourseMeta[] = COURSES,
): College[] {
  const meta = catalog.find((c) => c.slug === courseSlug);
  if (!meta) return [];
  return dataset.filter((c) =>
    c.courses.some(
      (course) =>
        course.degree === meta.degree ||
        course.name.toLowerCase().includes(meta.name.toLowerCase().split("(")[0]!.trim()),
    ),
  );
}

function courseHaystack(c: CourseMeta): string {
  // `duration` was missing here, so searching "3 years" or "4 years" — the kind
  // of thing a student types — matched nothing. `level` is kept because it is
  // searchable text ("pg", "diploma") even though it also has its own chips.
  return `${c.name} ${c.degree} ${c.description} ${c.duration} ${c.level}`;
}

/**
 * Filter a course catalogue by query.
 *
 * Tokenised AND matching, shared with `matchesCollege` and `searchExams`. It
 * used to be a single contiguous `includes(q)` over a lowercased string, which
 * meant `"B.Tech Computer Science"` had to appear verbatim and in order: it
 * failed against `"B.Tech Computer Science Engineering"`, while the same query
 * on `/colleges` matched by individual word. Two search boxes over one catalogue
 * disagreeing about the same phrase is the "not properly working" users hit.
 */
export function searchCourses(query: string, catalog: CourseMeta[] = COURSES): CourseMeta[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return catalog;
  return catalog.filter((c) => matchesTokens(courseHaystack(c), tokens));
}

export function getCourseBySlug(slug: string, catalog: CourseMeta[] = COURSES): CourseMeta | undefined {
  return catalog.find((c) => c.slug === slug);
}

export function getRelatedCourses(slug: string, catalog: CourseMeta[] = COURSES): CourseMeta[] {
  const detail = COURSE_DETAILS[slug];
  if (!detail) return catalog.filter((c) => c.slug !== slug).slice(0, 3);
  const related = detail.relatedSlugs
    .map((s) => getCourseBySlug(s, catalog))
    .filter((c): c is CourseMeta => Boolean(c));
  const extra = catalog.filter((c) => c.slug !== slug && !detail.relatedSlugs.includes(c.slug)).slice(0, 3);
  return [...related, ...extra].slice(0, 4);
}

export function getCourseDetail(slug: string) {
  return COURSE_DETAILS[slug];
}