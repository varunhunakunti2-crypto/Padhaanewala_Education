export type Sector = "Government" | "Private";

export interface Course {
  name: string;
  degree: string;
  specialization: string;
  duration: string;
  seats: number;
  feePerYear: number;
  tag?: string;
}

export interface Placement {
  year: number;
  placementRate: number;
  highestPackage: number;
  averagePackage: number;
  medianPackage: number;
  companiesVisited: number;
  topRecruiters: string[];
}

export interface Cutoff {
  program: string;
  category: string;
  value: string;
  year: number;
}

export interface Review {
  id: string;
  author: string;
  initials: string;
  role: "Alumni" | "Student" | "Parent";
  program: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  verified: boolean;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Facilities {
  hostel: boolean;
  library: boolean;
  sports: boolean;
  labs: boolean;
  cafeteria: boolean;
  wifi: boolean;
  gym: boolean;
  transport: boolean;
  medical: boolean;
  auditorium: boolean;
}

export interface Admission {
  process: string;
  eligibility: { program: string; criteria: string }[];
  entranceExams: string[];
  cutoffs: Cutoff[];
  applicationDeadline: string;
  applicationFee: number;
}

export interface RankingEntry {
  agency: string;
  rank: string;
  year: number;
}

export interface College {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  initials: string;
  gradientId: string;
  tagline: string;
  overview: string;
  founded: number;
  type: string;
  sector: Sector;
  accreditation: string[];
  rankings: RankingEntry[];
  city: string;
  district: string;
  state: string;
  university: string;
  admissionStatus: AdmissionStatus;
  pincode: string;
  rating: number;
  reviewCount: number;
  studentCount: number;
  facultyCount: number;
  courses: Course[];
  placement: Placement;
  admission: Admission;
  facilities: Facilities;
  scholarships: string[];
  reviews: Review[];
  faqs: Faq[];
  featured?: boolean;
}

export type SortKey =
  | "relevance"
  | "rating"
  | "fees-asc"
  | "fees-desc"
  | "placement"
  | "reviews"
  | "name";

export interface SearchFilters {
  query: string;
  states: string[];
  cities: string[];
  courseNames: string[];
  sectors: Sector[];
  types: string[];
  exams: string[];
  accreditations: string[];
  hostel: boolean | null;
  placementRate: boolean | null;
  minFee: number | null;
  maxFee: number | null;
  sortBy: SortKey;
  districts: string[];
  universities: string[];
  admissionStatuses: AdmissionStatus[];
  minRating: number | null;
}

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  amount: string;
  eligibility: string;
  deadline: string;
  renewable: boolean;
  tags: string[];
  color: string;
  documents: string[];
  applicationProcess: string[];
  website?: string;
}

export interface SearchSuggestion {
  type: "college" | "course" | "city" | "specialization" | "exam";
  label: string;
  sub?: string;
  value: string;
}

export type AdmissionStatus = "open" | "closed" | "upcoming";

export type ExamLevel = "UG" | "PG" | "School" | "Doctoral";

export interface ExamDate {
  label: string;
  date: string;
  tentative?: boolean;
}

export interface Exam {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  level: ExamLevel;
  conductingBody: string;
  type: string;
  overview: string;
  eligibility: string;
  fees: string;
  pattern: string[];
  questionCount: number;
  duration: string;
  marking: string;
  negativeMarking: string;
  dates: ExamDate[];
  stage: "Registration Open" | "Registration Closed" | "Results Declared" | "Admit Cards Out";
  website: string;
  coursesAccepted: string[];
  collegesAccepting: string[];
  faqs: Faq[];
}

export interface MockTest {
  id: string;
  slug: string;
  title: string;
  exam: string;
  examSlug: string;
  subject: string;
  difficulty: "Easy" | "Medium" | "Hard";
  questionCount: number;
  durationMins: number;
  description: string;
  topics: string[];
  attempts: number;
  /**
   * Marks added per correct answer. Defaults to 3 when absent. Papers that
   * declare their own scheme (JEE Main is +4/−1 for 300 marks) set it here
   * rather than having the score hardcoded in the runner.
   */
  marksPerCorrect?: number;
  /** Marks deducted per incorrect answer. Defaults to 1 when absent. */
  marksPerWrong?: number;
  /**
   * Explicit, ordered question ids. A curated paper must be served verbatim,
   * so a test that lists these ignores `questionCount` for sampling purposes.
   */
  questionIds?: string[];
}

export type MockTestQuestionType = "mcq" | "numeric";

export interface MockTestQuestion {
  id: string;
  text: string;
  /** Defaults to "mcq" when absent. */
  type?: MockTestQuestionType;
  /** Empty for numeric questions. */
  options: string[];
  /** Index of the correct option; -1 for numeric questions. */
  correctIndex: number;
  /** Accepted value for a numeric question. Absent for MCQs. */
  numericAnswer?: number;
  explanation: string;
  topic: string;
  /** Subject this question belongs to, used to build per-subject pools. */
  subject?: string;
}

export interface TopicPerformance {
  correct: number;
  total: number;
}

export interface MockTestResult {
  id: string;
  testId: string;
  testSlug: string;
  testTitle: string;
  exam: string;
  date: string;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeTakenSec: number;
  score: number;
  maxScore: number;
  topicPerformance: Record<string, TopicPerformance>;
}

export type BlogCategory =
  | "Admissions"
  | "NEET"
  | "AYUSH"
  | "Nursing"
  | "Scholarships"
  | "Careers"
  | "Exams"
  | "College Guides"
  | "Education News";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  category: BlogCategory;
  excerpt: string;
  content: string[];
  author: string;
  authorRole: string;
  date: string;
  readTime: string;
  tags: string[];
  featured?: boolean;
  /**
   * Editorial SEO overrides, read from the blog's own `meta_title`,
   * `meta_description` and `canonical_url` columns.
   *
   * These were accepted by `POST/PUT /blogs` and then silently dropped here, so
   * an editor could fill in the SEO fields in the admin panel and see nothing
   * change in the page source. Optional, because a post that has none falls back
   * to its title and excerpt.
   */
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
}

export interface AdmissionEnquiry {
  id: string;
  name: string;
  mobile: string;
  email: string;
  course: string;
  preferredCollege: string;
  state: string;
  city: string;
  qualification: string;
  message: string;
  date: string;
  status: "new" | "contacted" | "converted";
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: "admission" | "exam" | "scholarship" | "general";
}

export interface StudentProfile {
  name: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  education: string[];
  interests: string[];
  preferredState: string;
  preferredCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
}

export interface PredictorInput {
  course: string;
  exam: string;
  rankOrScore: string;
  category: string;
  state: string;
  preferredCity: string;
  budget: string;
  sectorPref: "Any" | "Government" | "Private";
  hostel: boolean | null;
  additional: string[];
}

export interface PredictResult {
  highlySuitable: College[];
  possible: College[];
  reach: College[];
}