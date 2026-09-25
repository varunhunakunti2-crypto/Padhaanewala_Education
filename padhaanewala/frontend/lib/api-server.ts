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
 */

const RAW_BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
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

async function serverGet<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function serverGetAll<T>(path: string, revalidate: number): Promise<T[]> {
  const data = await serverGet<T[]>(path, revalidate);
  return Array.isArray(data) ? data : [];
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
  has_hostel: boolean;
  total_reviews: number;
  average_rating: string;
  is_featured: boolean;
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
  accreditation_nba: string | null;
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
  serverGetAll<ApiUniversity>("/universities?limit=500", REVALIDATE.catalogList);

export const getCourses = () =>
  serverGetAll<ApiCourse>("/courses?limit=1000", REVALIDATE.catalogList);

export const getColleges = (query = "limit=1000") =>
  serverGetAll<ApiCollegeListItem>(`/colleges?${query}`, REVALIDATE.catalogList);

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
  serverGetAll<ApiFaq>(
    `/faqs?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}`,
    REVALIDATE.catalogDetail,
  );

export const getExams = () => serverGetAll<ApiExam>("/exams?limit=200", REVALIDATE.catalogList);

export const getExamBySlug = (slug: string) =>
  serverGet<ApiExam>(`/exams/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getScholarships = (query = "limit=200") =>
  serverGetAll<ApiScholarship>(`/scholarships?${query}`, REVALIDATE.catalogList);

export const getScholarshipBySlug = (slug: string) =>
  serverGet<ApiScholarship>(`/scholarships/${encodeURIComponent(slug)}`, REVALIDATE.catalogDetail);

export const getBlogs = (query = "status=published&limit=100") =>
  serverGetAll<ApiBlog>(`/blogs?${query}`, REVALIDATE.content);

export const getBlogBySlug = (slug: string) =>
  serverGet<ApiBlog>(`/blogs/${encodeURIComponent(slug)}`, REVALIDATE.content);

export const getBlogCategories = () =>
  serverGetAll<ApiBlogCategory>("/blog-categories?limit=100", REVALIDATE.content);

export const getMockTests = (query = "limit=200") =>
  serverGetAll<ApiMockTest>(`/mock-tests?${query}`, REVALIDATE.catalogList);

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
