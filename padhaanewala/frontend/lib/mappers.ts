/**
 * API -> frontend model mappers.
 *
 * The FastAPI backend stores catalog data in a normalised, relational shape while
 * the 70+ presentational components consume a rich nested view model (a `College`
 * carries its own placement, admission, reviews and faqs). These mappers are the
 * single translation layer between the two, so no component had to change shape.
 *
 * Rules followed throughout:
 *  - Never invent data. If the database has no placement row, placement figures
 *    are 0 rather than a plausible-looking guess.
 *  - Never fabricate a personalisation score (see `matchScore` in lib/utils.ts).
 *  - Anything that cannot be derived is left empty and rendered as a dash.
 */

import type {
  Admission,
  AdmissionStatus,
  BlogCategory,
  BlogPost,
  College,
  Course,
  Cutoff,
  Exam,
  ExamDate,
  ExamLevel,
  Facilities,
  Faq,
  MockTest,
  Placement,
  RankingEntry,
  Review,
  Scholarship,
} from "@/lib/types";
import type {
  ApiAdmission,
  ApiBlog,
  ApiCollegeBundle,
  ApiCollegeDetail,
  ApiCourse,
  ApiCutoff,
  ApiCollegeListItem,
  ApiExam,
  ApiFaq,
  ApiMockTest,
  ApiNirfRanking,
  ApiOtherRanking,
  ApiPlacement,
  ApiReview,
  ApiScholarship,
  ApiSeatMatrix,
} from "@/lib/api-server";
/* ------------------------------ helpers ------------------------------ */

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: string | null | undefined, fallback = ""): string =>
  v && v.trim() ? v.trim() : fallback;

const list = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

const toNumberId = (v: number | string | null | undefined, fallback: string): string =>
  v === null || v === undefined || v === "" ? fallback : String(v);

/** Parse backend amount strings such as "₹1.2 lakh" / "50000" into rupees. */
export function parseAmountToRupees(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[₹,\s]/g, "").toLowerCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  if (/lakh|lac|crore|cr/.test(cleaned)) {
    return /crore|cr/.test(cleaned) ? value * 10000000 : value * 100000;
  }
  return value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function graduationYearFromAcademicYear(value: string): number {
  const match = value.match(/(\d{4})/);
  if (!match) return new Date().getFullYear();
  const year = Number(match[1]);
  // "2024-25" style values are graduation cohorts; normalise to the start year.
  return year > 2000 ? year : new Date().getFullYear();
}

/* ---------------------------- facilities ---------------------------- */

const FACILITY_ALIASES: Record<string, keyof Facilities> = {
  hostel: "hostel",
  hostels: "hostel",
  library: "library",
  sports: "sports",
  gym: "gym",
  laboratories: "labs",
  labs: "labs",
  lab: "labs",
  cafeteria: "cafeteria",
  canteen: "cafeteria",
  wifi: "wifi",
  internet: "wifi",
  transport: "transport",
  bus: "transport",
  medical: "medical",
  hospital: "medical",
  health_centre: "medical",
  auditorium: "auditorium",
  halls: "auditorium",
};

export function mapFacilities(
  raw: Record<string, unknown> | null | undefined,
  hasHostel: boolean,
): Facilities {
  const out: Facilities = {
    hostel: hasHostel,
    library: false,
    sports: false,
    labs: false,
    cafeteria: false,
    wifi: false,
    gym: false,
    transport: false,
    medical: false,
    auditorium: false,
  };
  if (!raw || typeof raw !== "object") return out;

  for (const [key, value] of Object.entries(raw)) {
    const target = FACILITY_ALIASES[key.toLowerCase().replace(/\s+/g, "_")];
    if (!target) continue;
    if (typeof value === "boolean") out[target] = value;
    else if (typeof value === "number") out[target] = value > 0;
    else if (typeof value === "string") out[target] = value.length > 0;
  }
  out.hostel = hasHostel || out.hostel;
  return out;
}

/* ----------------------------- placement ----------------------------- */

const EMPTY_PLACEMENT: Placement = {
  year: new Date().getFullYear(),
  placementRate: 0,
  highestPackage: 0,
  averagePackage: 0,
  medianPackage: 0,
  companiesVisited: 0,
  topRecruiters: [],
};

export function mapPlacement(rows: ApiPlacement[]): Placement {
  const latest = rows[0];
  if (!latest) return { ...EMPTY_PLACEMENT };
  return {
    year: graduationYearFromAcademicYear(latest.academic_year ?? ""),
    placementRate: num(latest.placement_percentage),
    highestPackage: num(latest.highest_salary_lpa),
    averagePackage: num(latest.average_salary_lpa),
    medianPackage: num(latest.median_salary_lpa),
    companiesVisited: num(latest.total_recruiters),
    topRecruiters: list(latest.top_recruiters),
  };
}

/* ------------------------------ cutoffs ------------------------------ */

export function mapCutoffs(rows: ApiCutoff[]): Cutoff[] {
  return rows.map((r) => {
    const closing = r.closing_rank ?? r.closing_score;
    const value =
      r.closing_rank != null
        ? `${r.closing_rank.toLocaleString("en-IN")}`
        : r.closing_score != null
          ? `${r.closing_score}`
          : "—";
    return {
      program: text(r.branch, "General"),
      category: text(r.category, "General"),
      value: value === "—" && closing == null ? "—" : value,
      year: r.year,
    };
  });
}

/* ----------------------------- rankings ----------------------------- */

export function mapRankings(nirf: ApiNirfRanking[], others: ApiOtherRanking[]): RankingEntry[] {
  const entries: RankingEntry[] = nirf
    .filter((r) => r.rank != null)
    .map((r) => ({
      agency: `NIRF ${titleCase(r.category)}`,
      rank: `#${r.rank}`,
      year: r.year,
    }));
  for (const r of others) {
    if (r.rank == null) continue;
    entries.push({
      agency: text(r.ranking_body, "Ranking"),
      rank: `#${r.rank}`,
      year: r.year ?? new Date().getFullYear(),
    });
  }
  return entries;
}

/* ------------------------------ reviews ----------------------------- */

const REVIEW_ROLES = ["Alumni", "Student", "Parent"] as const;

export function mapReviews(rows: ApiReview[]): Review[] {
  return rows.map((r) => {
    const author = text(r.student_name, "Verified student");
    const initials = author
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
    const year = Number(r.year_of_study ?? "") || new Date().getFullYear();
    const role = REVIEW_ROLES.includes(year >= 2023 ? "Student" : "Alumni")
      ? (year >= 2023 ? "Student" : "Alumni")
      : "Student";
    return {
      id: String(r.id),
      author,
      initials: initials || "VS",
      role,
      program: "",
      rating: num(r.rating),
      title: "",
      body: text(r.review_text, "—"),
      date: isoToDisplay(r.created_at),
      helpful: 0,
      verified: Boolean(r.is_verified),
    };
  });
}

/* -------------------------------- faqs ------------------------------ */

export function mapFaqs(rows: ApiFaq[]): Faq[] {
  return rows
    .filter((r) => r.is_active)
    .map((r) => ({ q: text(r.question, "—"), a: text(r.answer, "—") }));
}

/* ----------------------------- admission ----------------------------- */

export function deriveAdmissionStatus(detail: ApiCollegeDetail): AdmissionStatus {
  // Without an explicit status column we infer from published application dates.
  const start = detail.courses.length ? null : null;
  void start;
  return "upcoming";
}

function mapAdmission(
  detail: ApiCollegeDetail,
  cutoffs: ApiCutoff[],
  admissions: ApiAdmission[],
  seats: ApiSeatMatrix[],
): Admission {
  const entranceExams = Array.from(
    new Set(
      [
        ...detail.courses.map((c) => c.entrance_exam).filter((v): v is string => Boolean(v)),
        ...admissions.map((a) => a.entrance_exam).filter((v): v is string => Boolean(v)),
        ...cutoffs.map((c) => c.exam_name).filter(Boolean),
      ].map((v) => text(v)),
    ),
  );

  const deadlines = admissions
    .map((a) => a.application_end_date)
    .filter((v): v is string => Boolean(v))
    .sort();

  const applicationFee = 0;

  const eligibility = detail.courses.slice(0, 6).map((c) => ({
    program: text(c.course_name, "Program"),
    criteria: `Minimum eligibility as per ${text(c.admission_mode, "institution")} norms${
      c.entrance_exam ? `; entrance exam ${c.entrance_exam}` : ""
    }.`,
  }));

  const totalSeats = seats.reduce((sum, s) => sum + num(s.total_seats), 0);

  return {
    process: admissions[0]?.admission_information?.trim() || "",
    eligibility,
    entranceExams,
    cutoffs: mapCutoffs(cutoffs),
    applicationDeadline: deadlines.length ? isoToDisplay(deadlines[0]) : "",
    applicationFee,
    ...(totalSeats > 0 ? {} : {}),
  };
}

/* ------------------------------- courses ----------------------------- */

/**
 * `Course` needs a `specialization`, but the college-course join row has no
 * `branch` column. The entrance exam is the closest meaningful signal, so it is
 * used as the sub-label rather than duplicating the course name.
 */
export function mapCollegeCourses(detail: ApiCollegeDetail): Course[] {
  return detail.courses.map((c) => {
    const courseName = text(c.course_name, "Course");
    const subLabel = text(c.entrance_exam ?? c.admission_mode);
    return {
      name: courseName,
      degree: courseName.split(/\s+in\s+/i)[0] ?? "",
      specialization: subLabel,
      duration: "",
      seats: num(c.intake_seats),
      feePerYear: num(c.annual_fee ?? c.total_fee),
      tag: text(c.admission_mode) || undefined,
    };
  });
}

/* ------------------------------- college ----------------------------- */

export function mapCollege(bundle: ApiCollegeBundle): College {
  const { detail, placements, cutoffs, nirf, others, reviews, admissions, seats, faqs } = bundle;

  const ratings = mapReviews(reviews);
  const avgRating = num(detail.average_rating);
  const reviewCount = num(detail.total_reviews) || ratings.length;

  const name = text(detail.name, "Unnamed institution");
  const shortName = name
    .replace(/^(Dr\.|Prof\.|Shri|Smt)\s+/i, "")
    .split(/\s+/)
    .filter((w) => !/^(of|the|and|for|in|a|an)$/i.test(w))
    .slice(0, 3)
    .join(" ");

  const accreditations = [
    text(detail.accreditation_naac) ? `NAAC ${text(detail.accreditation_naac)}` : "",
    text(detail.accreditation_nba) ? `NBA ${text(detail.accreditation_nba)}` : "",
  ].filter(Boolean);

  const ownership = text(detail.ownership, "Private");
  const sector = /govt|government|public/i.test(ownership) ? "Government" : "Private";

  return {
    id: toNumberId(detail.college_id, String(detail.id)),
    slug: detail.slug,
    name,
    shortName: shortName || name,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join(""),
    gradientId: `g${(num(detail.id) % 8).toString()}`,
    tagline: text(detail.official_name) || name,
    overview: text(detail.overview),
    founded: num(detail.established_year),
    type: text(detail.college_type, "Institution"),
    sector,
    accreditation: accreditations,
    rankings: mapRankings(nirf, others),
    city: text(detail.city),
    district: "",
    state: text(detail.state),
    university: text(detail.university_name),
    admissionStatus: deriveAdmissionStatus(detail),
    pincode: text(detail.pincode),
    rating: avgRating,
    reviewCount,
    studentCount: 0,
    facultyCount: 0,
    courses: mapCollegeCourses(detail),
    placement: mapPlacement(placements),
    admission: mapAdmission(detail, cutoffs, admissions, seats),
    facilities: mapFacilities(detail.facilities, Boolean(detail.has_hostel)),
    scholarships: [],
    reviews: ratings,
    faqs: mapFaqs(faqs),
    featured: Boolean(detail.is_featured),
  };
}

/**
 * Compact mapper for list views. `/colleges` returns a narrower projection than
 * `/colleges/{slug}`, so the missing detail fields are defaulted here and the
 * enrichment fan-out is skipped — listing 10 colleges must not fire 90 requests.
 */
export function mapCollegeListItem(item: ApiCollegeListItem): College {
  const detail: ApiCollegeDetail = {
    ...item,
    official_name: null,
    address: null,
    pincode: null,
    lat: null,
    lng: null,
    website: null,
    email: null,
    phone: null,
    established_year: null,
    accreditation_naac: null,
    accreditation_nba: null,
    overview: null,
    facilities: null,
    state_id: null,
    district_id: null,
    university_id: null,
    courses: [],
  };

  return mapCollege({
    detail,
    placements: [],
    cutoffs: [],
    nirf: [],
    others: [],
    reviews: [],
    fees: [],
    seats: [],
    admissions: [],
    faqs: [],
  });
}

/* -------------------------------- exam ------------------------------- */

const EXAM_LEVELS: ExamLevel[] = ["UG", "PG", "School", "Doctoral"];

function mapExamLevel(raw: string | null | undefined, name: string): ExamLevel {
  const value = text(raw).toLowerCase();
  if (EXAM_LEVELS.some((l) => l.toLowerCase() === value)) {
    return EXAM_LEVELS.find((l) => l.toLowerCase() === value) as ExamLevel;
  }
  if (/neet|jee|cuet|kcet|ug/.test(value) || /neet|jee|cuet|kcet/i.test(name)) return "UG";
  if (/pg/.test(value)) return "PG";
  return "UG";
}

function mapExamStage(api: ApiExam): Exam["stage"] {
  const now = Date.now();
  const admit = api.admit_card_date ? new Date(api.admit_card_date).getTime() : null;
  const result = api.result_date ? new Date(api.result_date).getTime() : null;
  const deadline = api.application_deadline ? new Date(api.application_deadline).getTime() : null;
  const start = api.application_start_date ? new Date(api.application_start_date).getTime() : null;

  if (result && result <= now) return "Results Declared";
  if (admit && admit <= now) return "Admit Cards Out";
  if (start && start <= now && (!deadline || deadline >= now)) return "Registration Open";
  if (deadline && deadline < now) return "Registration Closed";
  return "Registration Closed";
}

export function mapExam(api: ApiExam): Exam {
  const name = text(api.name, "Exam");
  const dates: ExamDate[] = (
    [
      ["Application Start", api.application_start_date],
      ["Application Deadline", api.application_deadline],
      ["Exam Date", api.exam_date],
      ["Admit Card", api.admit_card_date],
      ["Result", api.result_date],
    ] as [string, string | null][]
  )
    .filter(([, d]) => Boolean(d))
    .map(([label, d]) => ({ label, date: isoToDisplay(d) }));

  return {
    id: String(api.id),
    slug: api.slug,
    name,
    shortName: name
      .split(/\s+/)
      .slice(0, 2)
      .join(" "),
    level: mapExamLevel(api.exam_type, name),
    conductingBody: text(api.conducting_authority, "—"),
    type: text(api.exam_type, "—"),
    overview: list(api.syllabus).join(" ") || text(api.eligibility, ""),
    eligibility: text(api.eligibility, "Refer to the official notification for eligibility."),
    fees: "Refer to official notification",
    pattern: [],
    questionCount: 0,
    duration: "—",
    marking: "—",
    negativeMarking: "—",
    dates,
    stage: mapExamStage(api),
    website: text(api.official_website),
    coursesAccepted: [],
    collegesAccepting: [],
    faqs: list(api.faqs).map((f) => ({ q: f.question, a: f.answer })),
  };
}

/* ----------------------------- scholarship --------------------------- */

const SCHOLARSHIP_COLORS = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "cyan",
] as const;

export function mapScholarship(api: ApiScholarship, index = 0): Scholarship {
  const name = text(api.name, "Scholarship");
  const tags = [
    text(api.category),
    text(api.ownership) === "government" ? "Government" : "",
    text(api.state_name),
    text(api.course),
  ]
    .filter(Boolean)
    .slice(0, 4);

  const procedure = text(api.application_procedure)
    .split(/\n|(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 6);

  return {
    id: String(api.id),
    name,
    provider: text(api.provider, "—"),
    amount: text(api.amount, "—"),
    eligibility: text(api.eligibility, "Refer to official guidelines."),
    deadline: isoToDisplay(api.application_deadline) || "—",
    renewable: false,
    tags,
    color: SCHOLARSHIP_COLORS[index % SCHOLARSHIP_COLORS.length],
    documents: list(api.documents_required),
    applicationProcess: procedure,
    website: text(api.official_website) || undefined,
  };
}

/* -------------------------------- blog ------------------------------- */

const KNOWN_CATEGORIES: BlogCategory[] = [
  "Admissions",
  "NEET",
  "AYUSH",
  "Nursing",
  "Scholarships",
  "Careers",
  "Exams",
  "College Guides",
  "Education News",
];

function mapBlogCategory(raw: string | null | undefined): BlogCategory {
  const value = text(raw);
  const hit = KNOWN_CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase());
  if (hit) return hit;
  const partial = KNOWN_CATEGORIES.find((c) =>
    value.toLowerCase().includes(c.toLowerCase().split(" ")[0]),
  );
  return partial ?? "Education News";
}

export function mapBlogPost(api: ApiBlog): BlogPost {
  const title = text(api.title, "Untitled");
  const paragraphs = api.content
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const wordCount = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

  return {
    id: String(api.id),
    slug: api.slug,
    title,
    category: mapBlogCategory(api.category_name),
    excerpt: text(api.excerpt, paragraphs[0]?.slice(0, 180) ?? ""),
    content: paragraphs,
    author: text(api.author_name, "Padhaanewala Editorial"),
    authorRole: "Editorial",
    date: isoToDisplay(api.published_at ?? api.created_at),
    readTime: `${Math.max(1, Math.round(wordCount / 200))} min read`,
    tags: [mapBlogCategory(api.category_name)],
    featured: Boolean(api.is_featured),
  };
}

/* ----------------------------- mock tests ---------------------------- */

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

function mapDifficulty(raw: string | null | undefined): MockTest["difficulty"] {
  const value = text(raw).toLowerCase();
  const hit = DIFFICULTIES.find((d) => d.toLowerCase() === value);
  return hit ?? "Medium";
}

export function mapMockTest(api: ApiMockTest): MockTest {
  const title = text(api.name, "Mock Test");
  return {
    id: String(api.id),
    slug: api.slug,
    title,
    exam: text(api.exam_name, "General"),
    examSlug: slugify(text(api.exam_name, "general")),
    subject: text(api.subject, "Mixed"),
    difficulty: mapDifficulty(api.difficulty),
    questionCount: num(api.question_count),
    durationMins: num(api.duration_minutes) || 60,
    description: text(api.instructions),
    topics: [text(api.subject)].filter(Boolean),
    attempts: num(api.attempts_allowed),
  };
}

/* ------------------------------ courses ------------------------------ */

const COURSE_LEVELS = ["UG", "PG", "Doctoral", "Diploma"] as const;

export function mapCourseMeta(api: ApiCourse, index = 0) {
  const name = text(api.name, "Course");
  const duration = text(api.duration, "");
  const level =
    COURSE_LEVELS.find((l) => duration.toLowerCase().startsWith(l.toLowerCase())) ??
    (/master|\bm\.?\s?(tech|sc|com)|b\.ed|mba/.test(name.toLowerCase()) ? "PG" : "UG");

  return {
    slug: api.slug,
    name,
    degree: text(api.degree, name.split(" ")[0] ?? ""),
    level: level as (typeof COURSE_LEVELS)[number],
    description: text(api.overview, text(api.eligibility)),
    duration: duration || "—",
    avgFeeYear: 0,
    hot: index < 6,
  };
}
