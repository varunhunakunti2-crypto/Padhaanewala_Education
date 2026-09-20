import type { College, SearchFilters, SearchSuggestion, SortKey } from "@/lib/types";
import { COLLEGES, getCollegeBySlug } from "./colleges";

export const PAGE_SIZE = 9;

const EXAM_ALIASES: Record<string, string[]> = {
  "jee": ["JEE Main", "JEE Advanced"],
  "jee main": ["JEE Main"],
  "jee advanced": ["JEE Advanced"],
  "bitsat": ["BITSAT"],
  "gate": ["GATE"],
  "cat": ["CAT"],
  "neet": ["NEET"],
  "met": ["MET"],
  "cruet": [],
  "cuet": ["CUET"],
  "mht cet": ["MHT-CET"],
  "wbjee": ["WBJEE"],
  "keam": ["KEAM"],
  "srmjeee": ["SRMJEEE"],
  "viteee": ["VITEEE"],
  "lpunest": ["LPUNEST"],
  "nimbus": [],
  "clat": ["CLAT"],
  "nata": ["NATA"],
  "national test": [],
  "sat": ["SAT"],
};
void EXAM_ALIASES;

export function expandQuery(q: string): string {
  return q.toLowerCase().trim();
}

function matchesCollege(c: College, q: string): boolean {
  const haystack = [
    c.name,
    c.shortName,
    c.initials,
    c.city,
    c.state,
    c.type,
    c.sector,
    c.tagline,
    ...c.accreditation,
    ...c.rankings.map((r) => `${r.agency} ${r.rank}`),
    ...c.courses.flatMap((course) => [
      course.name,
      course.degree,
      course.specialization,
      course.duration,
    ]),
    ...c.admission.entranceExams,
    ...c.admission.eligibility.flatMap((e) => e.criteria),
    ...c.scholarships,
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export function applyFilters(c: College, f: SearchFilters): boolean {
  if (f.query && !matchesCollege(c, f.query)) return false;
  if (f.states.length && !f.states.includes(c.state)) return false;
  if (f.cities.length && !f.cities.includes(c.city)) return false;
  if (f.districts.length && !f.districts.includes(c.district)) return false;
  if (f.universities.length && !f.universities.includes(c.university)) return false;
  if (f.admissionStatuses.length && !f.admissionStatuses.includes(c.admissionStatus)) return false;
  if (f.minRating !== null && c.rating < f.minRating) return false;

  const courseNames = f.courseNames ?? [];
  if (courseNames.length) {
    const matches = courseNames.some((cn) =>
      c.courses.some(
        (course) =>
          course.degree.toLowerCase().includes(cn.toLowerCase()) ||
          course.specialization.toLowerCase().includes(cn.toLowerCase()) ||
          course.name.toLowerCase().includes(cn.toLowerCase()),
      ),
    );
    if (!matches) return false;
  }

  if (f.sectors.length && !f.sectors.includes(c.sector)) return false;
  if (f.types.length && !f.types.includes(c.type)) return false;

  const exams = f.exams ?? [];
  if (exams.length && !exams.some((e) => c.admission.entranceExams.includes(e))) return false;

  const accreditations = f.accreditations ?? [];
  if (accreditations.length && !accreditations.some((a) => c.accreditation.includes(a))) return false;

  if (f.hostel === true && !c.facilities.hostel) return false;
  if (f.hostel === false && c.facilities.hostel) return false;

  if (f.placementRate === true && c.placement.placementRate < 85) return false;

  const fees = c.courses.map((course) => course.feePerYear);
  const minFee = Math.min(...fees);
  if (f.minFee !== null && minFee < (f.minFee ?? 0)) return false;
  if (f.maxFee !== null && minFee > (f.maxFee ?? 0)) return false;

  return true;
}

export function sortColleges(list: College[], key: SortKey): College[] {
  const arr = [...list];
  switch (key) {
    case "rating":
      return arr.sort((a, b) => b.rating - a.rating);
    case "fees-asc":
      return arr.sort(
        (a, b) => Math.min(...a.courses.map((x) => x.feePerYear)) - Math.min(...b.courses.map((x) => x.feePerYear)),
      );
    case "fees-desc":
      return arr.sort(
        (a, b) => Math.max(...b.courses.map((x) => x.feePerYear)) - Math.max(...a.courses.map((x) => x.feePerYear)),
      );
    case "placement":
      return arr.sort((a, b) => b.placement.placementRate - a.placement.placementRate);
    case "reviews":
      return arr.sort((a, b) => b.reviewCount - a.reviewCount);
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return arr;
  }
}

export interface FilterState {
  filters: SearchFilters;
  page: number;
  total: number;
  colleges: College[];
}

export function searchColleges(filters: SearchFilters, page = 1): FilterState {
  const filtered = COLLEGES.filter((c) => applyFilters(c, filters));
  const sorted = sortColleges(filtered, filters.sortBy);
  const total = sorted.length;
  const start = (page - 1) * PAGE_SIZE;
  const colleges = sorted.slice(start, start + PAGE_SIZE);
  return { filters, page, total, colleges };
}

export const ALL_STATES: string[] = [
  ...Array.from(new Set(COLLEGES.map((c) => c.state))).sort(),
];

export const ALL_CITIES: string[] = [
  ...Array.from(new Set(COLLEGES.map((c) => `${c.city}, ${c.state}`))).sort(),
];

export const ALL_TYPES: string[] = [
  ...Array.from(new Set(COLLEGES.map((c) => c.type))).sort(),
];

export const ALL_DISTRICTS: string[] = [
  ...Array.from(new Set(COLLEGES.map((c) => c.district))).sort(),
];

export const ALL_UNIVERSITIES: string[] = [
  ...Array.from(new Set(COLLEGES.map((c) => c.university))).sort(),
];

export const ALL_ADMISSION_STATUSES = ["open", "closed", "upcoming"] as const;

export const ALL_EXAMS: string[] = [
  ...Array.from(new Set(COLLEGES.flatMap((c) => c.admission.entranceExams))).sort(),
];

export const ALL_ACCREDITATIONS: string[] = [
  ...Array.from(new Set(COLLEGES.flatMap((c) => c.accreditation))).sort(),
];

export const ALL_DEGREES: string[] = [
  ...Array.from(new Set(COLLEGES.flatMap((c) => c.courses.map((x) => x.degree)))).sort(),
];

export const ALL_SPECIALIZATIONS: string[] = [
  ...Array.from(new Set(COLLEGES.flatMap((c) => c.courses.map((x) => x.specialization)))).sort(),
];

export const FEE_RANGES = [
  { label: "Under ₹50K", min: null, max: 50000 },
  { label: "₹50K – ₹1.5L", min: 50000, max: 150000 },
  { label: "₹1.5L – ₹3L", min: 150000, max: 300000 },
  { label: "₹3L – ₹6L", min: 300000, max: 600000 },
  { label: "₹6L+", min: 600000, max: null },
];

export const POPULAR_SEARCHES = [
  "B.Tech",
  "MBA",
  "Computer Science",
  "Bengaluru",
  "Delhi",
  "Mumbai",
  "IIT",
  "NIT",
];

export function getSuggestions(query: string): SearchSuggestion[] {
  const q = expandQuery(query);
  if (!q) return [];
  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const c of COLLEGES) {
    if (c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q)) {
      const label = c.shortName;
      if (!seen.has(label)) {
        seen.add(label);
        suggestions.push({
          type: "college",
          label,
          sub: `${c.city}, ${c.state}`,
          value: c.shortName,
        });
      }
    }
    if (suggestions.length >= 6) break;
  }
  if (suggestions.length < 6) {
    for (const degree of ALL_DEGREES) {
      if (degree.toLowerCase().includes(q) && !seen.has(degree)) {
        seen.add(degree);
        suggestions.push({ type: "course", label: degree, sub: "Degree", value: degree });
      }
      if (suggestions.length >= 8) break;
    }
  }
  if (suggestions.length < 8) {
    for (const spec of ALL_SPECIALIZATIONS) {
      if (spec.toLowerCase().includes(q) && !seen.has(spec)) {
        seen.add(spec);
        suggestions.push({
          type: "specialization",
          label: spec,
          sub: "Specialization",
          value: spec,
        });
      }
      if (suggestions.length >= 8) break;
    }
  }
  if (suggestions.length < 8) {
    for (const city of ALL_CITIES) {
      if (city.toLowerCase().includes(q) && !seen.has(city)) {
        seen.add(city);
        suggestions.push({ type: "city", label: city, sub: "City", value: city });
      }
      if (suggestions.length >= 8) break;
    }
  }
  return suggestions.slice(0, 8);
}

export { getCollegeBySlug };
export { COLLEGES };

export function suggestSlug(label: string): string {
  return getCollegeBySlug(label.toLowerCase().replace(/\s+/g, "-"))
    ? getCollegeBySlug(label.toLowerCase().replace(/\s+/g, "-"))!.slug
    : "";
}