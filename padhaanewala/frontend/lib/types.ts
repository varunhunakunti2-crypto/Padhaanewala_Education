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
}

export interface MockTestQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
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
  percentile: number;
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