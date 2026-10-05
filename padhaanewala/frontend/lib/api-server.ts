/**
 * Server-side API client.
 *
 * Talks directly to the FastAPI backend (bypassing the /api/v1 rewrite, which
 * only applies to browser traffic) and adds Next.js ISR caching so catalog data
 * is fetched once per revalidation window rather than on every request.
 *
 * Every helper is failure-tolerant: if the backend is down or returns an error
 * it resolves to `null` / `[]` so callers can fall back to bundled data instead
 * of crashing the page.
 *
 * Failure-tolerant is not the same as failure-silent. A swallowed error is how
 * BUG-05 shipped: the backend answered 422, `!res.ok` returned `null`, `null`
 * became `[]`, and `/blog` served HTTP 200 with an empty article grid. Every
 * non-2xx is therefore logged with its status and path, once per distinct
 * failure, so a silent-empty page is always traceable to a real status code.
 */

import { cache } from "react";

const RAW_BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  // IPv4 loopback, not `localhost` — see next.config.ts for why the name can
  // resolve to a different service on a developer machine.
  "http://127.0.0.1:8000"
).replace(/\/api\/v1\/?$/, "");

export const SERVER_API = `${RAW_BACKEND.replace(/\/+$/, "")}/api/v1`;

/** Revalidation windows (seconds) per resource type. */
export const REVALIDATE = {
  catalogList: 300,
  catalogDetail: 600,
  content: 600,
  stats: 900,
} as const;

const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Statuses already reported, so a persistently broken endpoint produces one log
 * line per distinct failure rather than one per ISR revalidation. Unbounded on
 * purpose in the sense that it is a `Set` of short strings; it only ever holds
 * one entry per (status, path) pair the process has actually seen.
 */
const reportedFailures = new Set<string>();

/**
 * Cache tags, one per catalogue resource.
 *
 * Every cached fetch is tagged by the resource its path belongs to, so an admin
 * write can expire exactly the entries it affected instead of the whole site.
 * `app/api/revalidate/route.ts` holds the matching name → tag map and calls
 * `revalidateTag` on these after a successful mutation; `tests/cache-tag-
 * contract.test.ts` fails the build if the two lists drift apart.
 *
 * Without these, `revalidate: 300` meant a college created in the admin panel was
 * invisible on `/colleges` for five minutes — and behind the never-cleared
 * `pagedCache` below, for as long as the server process lived.
 */
export const CACHE_TAGS = {
  colleges: "catalog:colleges",
  courses: "catalog:courses",
  exams: "catalog:exams",
  scholarships: "catalog:scholarships",
  mockTests: "catalog:mock-tests",
  universities: "catalog:universities",
  locations: "catalog:locations",
  blogs: "content:blogs",
  banners: "content:banners",
} as const;

/** First path segment that names a resource, e.g. `/colleges/abc` → `colleges`. */
function tagsFor(path: string): string[] {
  const base = path.split("?")[0].replace(/^\/+|\/+$/g, "").split("/")[0];
  const known = CACHE_TAGS as Record<string, string>;
  // `mock-tests` and `blog-categories` are hyphenated where the tag keys are
  // camelCase, so normalise before looking up rather than maintaining a second
  // parallel set of keys.
  const camel = base.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const tag = known[base] ?? known[camel];
  return tag ? [tag] : [];
}

function reportFailure(path: string, res: Response): void {
  const key = `${res.status} ${path}`;
  if (reportedFailures.has(key)) return;
  reportedFailures.add(key);
  // The build log is the only place a swallowed backend failure is observable.
  // Silently rendering an empty page is the BUG-05 failure mode.
  console.error(
    `[api-server] ${key} — treating as empty. Body: ${res.statusText || "no status text"}`,
  );
}

async function serverGet<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      next: { revalidate, tags: tagsFor(path) },
    });
    if (!res.ok) {
      reportFailure(path, res);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Transport failure (DNS, connection refused, timeout, abort) is
    // distinguishable from an HTTP error status, and the two need different
    // responses: a 422 means the request is wrong, a timeout means the backend
    // is unreachable. Both used to collapse into the same `null`.
    const key = `TRANSPORT ${path}`;
    if (!reportedFailures.has(key)) {
      reportedFailures.add(key);
      console.error(
        `[api-server] ${key} — treating as empty: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return null;
  }
}

async function serverGetAll<T>(path: string, revalidate: number): Promise<T[]> {
  const data = await serverGet<T[]>(path, revalidate);
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch every row of a list endpoint by following `limit`/`offset` pages.
 *
 * The backend caps `limit` (an uncapped `?limit=1000000` was a full table
 * dump), so asking for `?limit=1000` silently returns one page instead of
 * erroring — which is worse than a 422, because the caller gets a short
 * dataset with no indication anything was dropped. The catalogue here is
 * 341 colleges against a 100-row cap, so this is a real truncation today, not
 * a hypothetical.
 *
 * Pages are requested sequentially. The walk is de-duplicated per request (see
 * `dedupePaged`) so a page that renders 300 colleges still issues one walk rather
 * than 300, while cross-request caching is left entirely to the Next data cache
 * and its tags.
 *
 * ## Why the old module-level `Map` had to go
 *
 * This used to be `const pagedCache = new Map<string, Promise<unknown[]>>()`
 * keyed on `(path, revalidate, pageSize)`, with no expiry and no way to clear it.
 * That made it strictly stronger than the ISR window it was layered on: a
 * college created in `/admin` stayed off `/colleges` for five minutes *if the
 * server restarted often enough*, and otherwise until the process was recycled.
 * `revalidateTag` cannot fix that, because a hand-rolled map is invisible to the
 * data cache — the tag was marked stale and nothing looked at it. Deleting the
 * entry was the only cure, and nothing outside this module could do that.
 *
 * Per-request de-duplication is the correct scope for this: it removes the N+1
 * walk within a render, and leaves "may a later request reuse this response" to
 * the one layer that can be invalidated.
 */
const dedupePaged = cache(async <T,>(key: string, walk: () => Promise<T[]>) => walk());

/** Hard ceiling on rows so a runaway endpoint cannot exhaust memory. */
const MAX_PAGED_ROWS = 5000;

/**
 * The page size used by a paged walk, per endpoint.
 *
 * **This cannot be one constant.** The backend caps `limit` per router
 * (`Query(..., le=N)`) and those caps differ: `/colleges`, `/courses`, `/exams`,
 * `/scholarships` and `/mock-tests` allow 100, while `/blogs` allows **50** and
 * `/exams/upcoming` allows **50**. A single `PAGE_SIZE = 100` therefore issued
 * `GET /blogs?limit=100`, got a 422, and — because the failure was swallowed —
 * rendered `/blog` as an empty page with a 200. That is BUG-05.
 *
 * The default is 50 rather than 100 on purpose: it is safe against *every*
 * capped endpoint in the API today, so a newly added call site cannot be the
 * thing that re-arms this. An endpoint opts up to 100 by naming itself here, and
 * `tests/page-size-contract.test.ts` fails the build if a declared size ever
 * exceeds the `le=` bound the backend actually declares for that path — so the
 * two cannot drift apart silently again.
 */
export const DEFAULT_PAGE_SIZE = 50;

export const ENDPOINT_PAGE_SIZES: Readonly<Record<string, number>> = {
  "/colleges": 100,
  "/courses": 100,
  "/exams": 100,
  "/mock-tests": 100,
  "/scholarships": 100,
  "/universities": 100,
  // Declared explicitly even though it is the default: 50 is the backend's own
  // cap here, and naming it documents that the walk is not free to grow.
  "/blogs": 50,
  "/blog-categories": 50,
};

export function pageSizeFor(path: string): number {
  const base = path.split("?")[0];
  return ENDPOINT_PAGE_SIZES[base] ?? DEFAULT_PAGE_SIZE;
}

async function serverGetAllPaged<T>(
  path: string,
  revalidate: number,
): Promise<T[]> {
  const pageSize = pageSizeFor(path);
  // The key is an argument so React's per-request memo sees different walks as
  // different entries; without it every caller would share the first one's rows.
  const cacheKey = `${path}|${revalidate}|${pageSize}`;

  return dedupePaged(cacheKey, async () => {
    const rows: T[] = [];
    const separator = path.includes("?") ? "&" : "?";
    for (;;) {
      const page = await serverGet<T[]>(
        `${path}${separator}limit=${pageSize}&offset=${rows.length}`,
        revalidate,
      );
      if (!Array.isArray(page) || page.length === 0) break;
      rows.push(...page);
      // A short page means we have reached the end.
      if (page.length < pageSize) break;
      if (rows.length >= MAX_PAGED_ROWS) break;
    }
    return rows;
  });
}

/* ------------------------------------------------------------------ *
 * Response types — mirror the FastAPI Pydantic schemas exactly.
 * ------------------------------------------------------------------ */

export interface ApiState {
  id: number;
  name: string;
  code: string;
  is_union_territory: boolean;
}

export interface ApiDistrict {
  id: number;
  name: string;
  state_id: number;
}

export interface ApiCity {
  id: number;
  name: string;
  district_id: number;
  is_metropolitan: boolean;
}

export interface ApiUniversity {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  type: string | null;
  is_deemed: boolean;
  website: string | null;
  state_id: number | null;
}

export interface ApiCourse {
  id: number;
  name: string;
  slug: string;
  degree: string | null;
  duration: string | null;
  category: string | null;
  overview: string | null;
  eligibility: string | null;
  career_information: string | null;
  is_active: boolean;
}

export interface ApiCollegeListItem {
  id: number;
  college_id: string;
  name: string;
  slug: string;
  college_type: string | null;
  ownership: string | null;
  city: string | null;
  state: string | null;
  university_name: string | null;
  has_hostel: boolean | null;
  total_reviews: number;
  average_rating: string;
  is_featured: boolean;
  /** Trimmed application windows — the shape of `AdmissionWindowResponse`.
   * `/colleges` sends these so a list row can derive its admission status;
   * the full `ApiAdmission` rows still come from the detail fan-out. */
  admissions?: ApiAdmissionWindow[];
  /**
   * Distinct names of this college's active courses.
   *
   * Search input, not render input. `mapCollegeListItem` used to synthesise
   * `courses: []` here to avoid a fan-out per row, which left the course arm of
   * every college haystack permanently empty — so `/colleges?q=B.Tech`, the link
   * on every course card, matched nothing. The backend sends names only; fee,
   * duration and specialisation stay detail-only.
   */
  course_names?: string[];
}

export interface ApiAdmissionWindow {
  application_start_date: string | null;
  application_end_date: string | null;
  entrance_exam: string | null;
}

export interface ApiCollegeCourse {
  id: number;
  course_id: number;
  course_name: string;
  annual_fee: string | null;
  total_fee: string | null;
  intake_seats: number | null;
  admission_mode: string | null;
  entrance_exam: string | null;
}

export interface ApiCollegeDetail extends ApiCollegeListItem {
  official_name: string | null;
  address: string | null;
  pincode: string | null;
  lat: string | null;
  lng: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  established_year: number | null;
  accreditation_naac: string | null;
  /** `bool | None` in `CollegeDetailResponse`. Typed as a string here until the
   *  2026-09-29 college CRUD pass, which made `false` a type error rather than
   *  letting it through — the column is `Boolean`, not text. */
  accreditation_nba: boolean | null;
  overview: string | null;
  facilities: Record<string, unknown> | null;
  state_id: number | null;
  district_id: number | null;
  university_id: number | null;
  courses: ApiCollegeCourse[];
}

export interface ApiPlacement {
  id: number;
  college_id: number;
  course_id: number | null;
  branch: string | null;
  academic_year: string;
  total_graduating: number | null;
  total_placed: number | null;
  placement_percentage: string | null;
  students_higher_studies: number | null;
  median_salary_lpa: string | null;
  average_salary_lpa: string | null;
  highest_salary_lpa: string | null;
  lowest_salary_lpa: string | null;
  total_recruiters: number | null;
  top_recruiters: string[] | null;
  source: string | null;
}

export interface ApiCutoff {
  id: number;
  college_id: number;
  course_id: number | null;
  branch: string | null;
  exam_name: string;
  year: number;
  round: string | null;
  quota: string | null;
  category: string | null;
  opening_rank: number | null;
  closing_rank: number | null;
  opening_score: string | null;
  closing_score: string | null;
  source: string | null;
}

export interface ApiNirfRanking {
  id: number;
  college_id: number;
  category: string;
  year: number;
  rank: number | null;
  score: string | null;
  rank_change: number | null;
  state_rank: number | null;
}

export interface ApiOtherRanking {
  id: number;
  college_id: number;
  ranking_body: string;
  category: string | null;
  year: number | null;
  rank: number | null;
}

export interface ApiFee {
  id: number;
  college_course_id: number;
  tuition_fee: string | null;
  hostel_fee: string | null;
  examination_fee: string | null;
  other_charges: string | null;
  total_approximate: string | null;
  fee_period: string | null;
  academic_year: string;
  is_approximate: boolean;
}

export interface ApiSeatMatrix {
  id: number;
  college_id: number;
  course_id: number | null;
  branch: string | null;
  exam: string | null;
  total_seats: number | null;
  general_seats: number | null;
  obc_seats: number | null;
  sc_seats: number | null;
  st_seats: number | null;
  ews_seats: number | null;
  pwd_seats: number | null;
  female_supernumerary: number | null;
  home_state_quota: number | null;
  all_india_quota: number | null;
  management_quota: number | null;
  year: number | null;
}

export interface ApiAdmission {
  id: number;
  college_course_id: number;
  admission_information: string | null;
  eligibility_details: string | null;
  entrance_exam: string | null;
  application_start_date: string | null;
  application_end_date: string | null;
}

export interface ApiReview {
  id: number;
  college_id: number;
  course_id: number | null;
  student_id: number;
  rating: number;
  review_text: string | null;
  year_of_study: string | null;
  images: string[] | null;
  status: string;
  is_verified: boolean;
  created_at: string;
  student_name: string | null;
}

export interface ApiFaq {
  id: number;
  entity_type: string;
  entity_id: number;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

export interface ApiExam {
  id: number;
  name: string;
  slug: string;
  conducting_authority: string | null;
  exam_type: string | null;
  eligibility: string | null;
  application_start_date: string | null;
  application_deadline: string | null;
  exam_date: string | null;
  admit_card_date: string | null;
  result_date: string | null;
  official_website: string | null;
  official_notification: string | null;
  syllabus: string[] | null;
  faqs: { question: string; answer: string }[] | null;
  is_active: boolean;
}

export interface ApiScholarship {
  id: number;
  name: string;
  slug: string;
  provider: string | null;
  ownership: string | null;
  eligibility: string | null;
  state_id: number | null;
  state_name: string | null;
  course: string | null;
  category: string | null;
  income_criteria: string | null;
  amount: string | null;
  application_deadline: string | null;
  documents_required: string[] | null;
  application_procedure: string | null;
  official_website: string | null;
  verification_status: string | null;
  is_active: boolean;
}

export interface ApiBlog {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  author_id: number | null;
  author_name: string | null;
  status: string;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  is_featured: boolean;
  view_count: number;
  created_at: string;
}

export interface ApiBlogCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface ApiMockTest {
  id: number;
  name: string;
  slug: string;
  exam_id: number | null;
  exam_name: string | null;
  course_id: number | null;
  course_name: string | null;
  subject: string | null;
  difficulty: string | null;
  question_type: string | null;
  duration_minutes: number | null;
  total_marks: string | null;
  negative_marking: boolean;
  negative_marks_value: string | null;
  attempts_allowed: number | null;
  question_randomization: boolean;
  option_randomization: boolean;
  instructions: string | null;
  result_visibility: string | null;
  test_type: string | null;
  question_count: number;
  is_active: boolean;
}

export interface ApiBanner {
  id: number;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  display_order: number;
  is_active: boolean;
}

/* ------------------------------------------------------------------ *
 * Resource fetchers
 * ------------------------------------------------------------------ */

export const getStates = () =>
  serverGetAll<ApiState>("/locations/states", REVALIDATE.catalogList);

export const getDistricts = (stateId: number) =>
  serverGetAll<ApiDistrict>(`/locations/states/${stateId}/districts`, REVALIDATE.catalogList);

export const getUniversities = () =>
  serverGetAllPaged<ApiUniversity>("/universities", REVALIDATE.catalogList);

export const getCourses = () =>
  serverGetAllPaged<ApiCourse>("/courses", REVALIDATE.catalogList);

export const getColleges = (query = "") =>
  serverGetAllPaged<ApiCollegeListItem>(
    query ? `/colleges?${query}` : "/colleges",
    REVALIDATE.catalogList,
  );

export const getCollegeBySlug = (slug: string) =>
  serverGet<ApiCollegeDetail>(`/colleges/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getPlacements = (slug: string) =>
  serverGetAll<ApiPlacement>(`/colleges/${encodeURIComponent(slug)}/placements`, REVALIDATE.catalogDetail);

export const getCutoffs = (slug: string) =>
  serverGetAll<ApiCutoff>(`/colleges/${encodeURIComponent(slug)}/cutoffs`, REVALIDATE.catalogDetail);

export const getNirfRankings = (slug: string) =>
  serverGetAll<ApiNirfRanking>(`/colleges/${encodeURIComponent(slug)}/rankings/nirf`, REVALIDATE.catalogDetail);

export const getOtherRankings = (slug: string) =>
  serverGetAll<ApiOtherRanking>(`/colleges/${encodeURIComponent(slug)}/rankings/other`, REVALIDATE.catalogDetail);

export const getFees = (slug: string) =>
  serverGetAll<ApiFee>(`/colleges/${encodeURIComponent(slug)}/fees`, REVALIDATE.catalogDetail);

export const getSeatMatrix = (slug: string) =>
  serverGetAll<ApiSeatMatrix>(`/colleges/${encodeURIComponent(slug)}/seat-matrix`, REVALIDATE.catalogDetail);

export const getAdmissions = (slug: string) =>
  serverGetAll<ApiAdmission>(`/colleges/${encodeURIComponent(slug)}/admissions`, REVALIDATE.catalogDetail);

export const getCollegeReviews = (slug: string) =>
  serverGetAll<ApiReview>(`/reviews/college/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getFaqs = (entityType: string, entityId: number) =>
  serverGetAllPaged<ApiFaq>(
    `/faqs?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}`,
    REVALIDATE.catalogDetail,
  );

export const getExams = () => serverGetAllPaged<ApiExam>("/exams", REVALIDATE.catalogList);

export const getExamBySlug = (slug: string) =>
  serverGet<ApiExam>(`/exams/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getScholarships = (query = "") =>
  serverGetAllPaged<ApiScholarship>(
    query ? `/scholarships?${query}` : "/scholarships",
    REVALIDATE.catalogList,
  );

export const getScholarshipBySlug = (slug: string) =>
  serverGet<ApiScholarship>(`/scholarships/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getBlogs = (query = "status=published") =>
  serverGetAllPaged<ApiBlog>(`/blogs?${query}`, REVALIDATE.content);

export const getBlogBySlug = (slug: string) =>
  serverGet<ApiBlog>(`/blogs/${encodeURIComponent(slug)}`, REVALIDATE.content);

export const getBlogCategories = () =>
  serverGetAll<ApiBlogCategory>("/blog-categories", REVALIDATE.content);

export const getMockTests = (query = "") =>
  serverGetAllPaged<ApiMockTest>(
    query ? `/mock-tests?${query}` : "/mock-tests",
    REVALIDATE.catalogList,
  );

export const getMockTestBySlug = (slug: string) =>
  serverGet<ApiMockTest>(`/mock-tests/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getBanners = () => serverGetAll<ApiBanner>("/banners?limit=50", REVALIDATE.content);

export interface ApiCollegeBundle {
  detail: ApiCollegeDetail;
  placements: ApiPlacement[];
  cutoffs: ApiCutoff[];
  nirf: ApiNirfRanking[];
  others: ApiOtherRanking[];
  reviews: ApiReview[];
  fees: ApiFee[];
  seats: ApiSeatMatrix[];
  admissions: ApiAdmission[];
  faqs: ApiFaq[];
}

/** Parallel fan-out used by the college detail page. */
export async function getCollegeBundle(slug: string): Promise<ApiCollegeBundle | null> {
  const detail = await getCollegeBySlug(slug);
  if (!detail) return null;

  const [placements, cutoffs, nirf, others, reviews, fees, seats, admissions, faqs] =
    await Promise.all([
      getPlacements(slug),
      getCutoffs(slug),
      getNirfRankings(slug),
      getOtherRankings(slug),
      getCollegeReviews(slug),
      getFees(slug),
      getSeatMatrix(slug),
      getAdmissions(slug),
      detail.id ? getFaqs("college", detail.id) : Promise.resolve([]),
    ]);

  return { detail, placements, cutoffs, nirf, others, reviews, fees, seats, admissions, faqs };
}
