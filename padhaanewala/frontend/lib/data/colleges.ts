import type { College } from "@/lib/types";

/**
 * Bundled college dataset — intentionally empty.
 *
 * These records used to be 16 hand-written institutions with invented fees,
 * placement rates, ratings, reviews, accreditations and rankings. None of it was
 * real, and because `lib/content.ts` silently preferred these literals whenever
 * the API returned nothing, they were what the site actually served.
 *
 * College data now comes exclusively from the FastAPI backend
 * (`/api/v1/colleges`), which holds the verified Karnataka records loaded by
 * `backend/scripts/seed_colleges_courses.py` from `data/*.xlsx`.
 *
 * The lookup helpers below are kept because callers still pass a `dataset`
 * argument; with the default they simply resolve to nothing, which is the honest
 * result. Every consumer that needs colleges should read them from the API.
 */
export const COLLEGES: College[] = [];

export function getCollegeBySlug(slug: string): College | undefined {
  return COLLEGES.find((c) => c.slug === slug);
}

export function getCollegeById(id: string): College | undefined {
  return COLLEGES.find((c) => c.id === id);
}

export function getCollegesByIds(ids: string[], dataset: College[] = COLLEGES): College[] {
  const map = new Map(dataset.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is College => Boolean(c));
}

export function getFeaturedColleges(dataset: College[] = COLLEGES): College[] {
  const featured = dataset.filter((c) => c.featured);
  return featured.length ? featured : [...dataset].sort((a, b) => b.rating - a.rating);
}

export function getSimilarColleges(
  college: College,
  limit = 3,
  dataset: College[] = COLLEGES,
): College[] {
  const sameState = dataset.filter(
    (c) => c.state === college.state && c.id !== college.id,
  );
  const sameCourses = dataset.filter(
    (c) =>
      c.id !== college.id &&
      c.courses.some((course) =>
        college.courses.some((cc) => cc.degree === course.degree),
      ),
  );
  const merged = [...sameState, ...sameCourses].filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
  );
  return merged.slice(0, limit);
}

export function getRecommendedColleges(
  recentIds: string[],
  limit = 4,
  dataset: College[] = COLLEGES,
): College[] {
  const fallbackIds = dataset.slice(0, 4).map((c) => c.id);
  if (recentIds.length === 0) return getCollegesByIds(fallbackIds, dataset);
  const recent = getCollegesByIds(recentIds, dataset);
  if (recent.length === 0) return getCollegesByIds(fallbackIds, dataset);
  const states = new Set(recent.map((c) => c.state));
  const tags = new Set(recent.flatMap((c) => c.courses.map((x) => x.degree)));
  const recs = dataset.filter(
    (c) =>
      !recentIds.includes(c.id) &&
      (states.has(c.state) ||
        c.courses.some((x) => tags.has(x.degree)) ||
        c.rating >= 4.3),
  )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
  if (recs.length < limit) {
    const extra = COLLEGES.filter((c) => !recentIds.includes(c.id) && !recs.includes(c)).slice(
      0,
      limit - recs.length,
    );
    return [...recs, ...extra];
  }
  return recs;
}

export function getRecommendationReason(recent: College[]): string {
  if (recent.length === 0) return "Top-rated colleges picked for you";
  const state = recent[0]!.state;
  const degree = recent[0]!.courses[0]?.degree ?? "Engineering";
  return `Because you viewed ${degree.toLowerCase()} colleges in ${state}`;
}

export function compareToReason(a: College, b: College): string {
  if (a.state === b.state) return `Both located in ${a.state}`;
  const commonDegrees = a.courses
    .map((x) => x.degree)
    .filter((deg) => b.courses.some((y) => y.degree === deg));
  if (commonDegrees.length > 0) return `Both offer ${commonDegrees.slice(0, 2).join(" & ")}`;
  return "Similar rating and profile";
}