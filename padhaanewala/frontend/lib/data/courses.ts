import type { College } from "@/lib/types";
import { COLLEGES } from "./colleges";
import { COURSE_DETAILS } from "./courseDetails";

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

export function searchCourses(query: string, catalog: CourseMeta[] = COURSES): CourseMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return catalog;
  return catalog.filter((c) =>
    `${c.name} ${c.degree} ${c.description} ${c.level}`.toLowerCase().includes(q),
  );
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