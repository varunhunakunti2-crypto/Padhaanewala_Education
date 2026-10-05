import type { College, SearchFilters, SearchSuggestion, SortKey } from "@/lib/types";
import { COLLEGES, getCollegeBySlug } from "./colleges";

export const PAGE_SIZE = 9;

/**
 * Fold a string for search: lowercase, strip diacritics, collapse punctuation.
 *
 * Every search predicate in this file and in `courses.ts`/`exams.ts` routes its
 * needle through here, because three separate bugs came from not doing so:
 *
 *  1. `matchesCollege` compared a *lowercased* haystack against a **raw** `?q=`,
 *     so `?q=Bengaluru` matched nothing while `?q=bengaluru` matched. That broke
 *     every capitalised entry point — `POPULAR_SEARCHES`, the home page pills,
 *     and each course card's "Find colleges" link.
 *  2. City facet values are `"Bengaluru, Karnataka"`, and `?q=Bengaluru,
 *     Karnataka` tokenised to `["Bengaluru,", "Karnataka"]` — the trailing comma
 *     never appears in the space-joined haystack, so every city suggestion
 *     returned zero results.
 *  3. `"   "` is truthy, so a whitespace-only `?q=` counted as an active filter
 *     and made `hasActiveFilters` lie.
 *
 * Diacritics are stripped as well, so `"Bengalūru"` finds `"Bengaluru"`.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Combining marks left behind by NFKD — this is what turns "ū" into "u".
    .replace(/[̀-ͯ]/g, "")
    // Punctuation → space, so a comma or hyphen separates tokens instead of
    // being glued onto one. `&` becomes a token separator rather than matching.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Normalised search tokens. Empty array means "no query". */
export function searchTokens(q: string): string[] {
  const n = normalizeForSearch(q);
  return n ? n.split(/\s+/) : [];
}

/**
 * True when every token appears somewhere in `haystack`.
 *
 * AND across tokens, `includes` within one — so "bengaluru engineering" finds a
 * college that has both words in any order, anywhere in its record.
 */
export function matchesTokens(haystack: string, tokens: string[]): boolean {
  const h = normalizeForSearch(haystack);
  return tokens.every((t) => h.includes(t));
}

/** @deprecated Kept as the public name callers already use. Now normalises. */
export function expandQuery(q: string): string {
  return normalizeForSearch(q);
}

function matchesCollege(c: College, q: string): boolean {
  const tokens = searchTokens(q);
  if (tokens.length === 0) return true;
  const haystack = [
    c.name,
    c.shortName,
    c.initials,
    c.city,
    c.state,
    c.district,
    c.university,
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
    .join(" ");
  return matchesTokens(haystack, tokens);
}

export function applyFilters(c: College, f: SearchFilters): boolean {
  if (searchTokens(f.query).length && !matchesCollege(c, f.query)) return false;
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
  if (fees.length) {
    const minFee = Math.min(...fees);
    if (f.minFee !== null && minFee < (f.minFee ?? 0)) return false;
    if (f.maxFee !== null && minFee > (f.maxFee ?? 0)) return false;
  }

  return true;
}

/**
 * Cheapest / priciest annual fee for a college, or `null` when it has no course
 * data at all.
 *
 * The list projection (`mapCollegeListItem`) hard-sets `courses: []` to avoid a
 * 9-request fan-out per row, so on `/colleges` this is `null` for every college
 * today. Returning `null` rather than `Infinity`/`-Infinity` is what lets the
 * callers distinguish "no data" from "an actual fee of zero" and sort it last
 * instead of yielding a NaN comparator.
 */
function cheapestFee(c: College): number {
  const fees = c.courses.map((x) => x.feePerYear).filter((f) => f > 0);
  return fees.length ? Math.min(...fees) : Number.POSITIVE_INFINITY;
}

function priciestFee(c: College): number {
  const fees = c.courses.map((x) => x.feePerYear).filter((f) => f > 0);
  return fees.length ? Math.max(...fees) : Number.NEGATIVE_INFINITY;
}

export function sortColleges(list: College[], key: SortKey): College[] {
  const arr = [...list];
  switch (key) {
    case "rating":
      return arr.sort((a, b) => b.rating - a.rating);
    case "fees-asc":
      // `Math.min(...[])` is `Infinity` and `Infinity - Infinity` is `NaN`.
      // `sort` treats a NaN comparator result as "equal", so a list of colleges
      // with no fee data came back in unspecified order under this sort — the
      // one ordering the user explicitly asked for. Colleges without fees sort
      // last in both directions, which is honest: there is no fee to rank by.
      return arr.sort((a, b) => cheapestFee(a) - cheapestFee(b));
    case "fees-desc":
      return arr.sort((a, b) => priciestFee(b) - priciestFee(a));
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

export function searchColleges(
  filters: SearchFilters,
  page = 1,
  dataset: College[] = COLLEGES,
): FilterState {
  const filtered = dataset.filter((c) => applyFilters(c, filters));
  const sorted = sortColleges(filtered, filters.sortBy);
  const total = sorted.length;
  const start = (page - 1) * PAGE_SIZE;
  const colleges = sorted.slice(start, start + PAGE_SIZE);
  return { filters, page, total, colleges };
}

/**
 * Facet values for the filter panel. Derived from whichever dataset is passed in
 * so the panel never offers a filter that would return zero results.
 */
export interface CollegeFacets {
  states: string[];
  cities: string[];
  types: string[];
  districts: string[];
  universities: string[];
  exams: string[];
  accreditations: string[];
  degrees: string[];
  specializations: string[];
}

const uniqSorted = (values: (string | undefined)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim())))).sort();

export function buildFacets(dataset: College[] = COLLEGES): CollegeFacets {
  return {
    states: uniqSorted(dataset.map((c) => c.state)),
    // A comma-joined city/state pair, kept because it is what `getSuggestions`
    // emits and what the city checkbox shows — but built defensively. With a
    // missing city this produced the literal `", Karnataka"`, which then showed
    // up as a selectable city option and as a suggestion labelled "City".
    cities: uniqSorted(dataset.map((c) => (c.city ? `${c.city}, ${c.state}` : c.state))),
    types: uniqSorted(dataset.map((c) => c.type)),
    districts: uniqSorted(dataset.map((c) => c.district)),
    universities: uniqSorted(dataset.map((c) => c.university)),
    exams: uniqSorted(dataset.flatMap((c) => c.admission.entranceExams)),
    accreditations: uniqSorted(dataset.flatMap((c) => c.accreditation)),
    degrees: uniqSorted(dataset.flatMap((c) => c.courses.map((x) => x.degree))),
    specializations: uniqSorted(dataset.flatMap((c) => c.courses.map((x) => x.specialization))),
  };
}

const BUNDLED_FACETS = buildFacets(COLLEGES);

export const ALL_STATES: string[] = BUNDLED_FACETS.states;
export const ALL_CITIES: string[] = BUNDLED_FACETS.cities;
export const ALL_TYPES: string[] = BUNDLED_FACETS.types;
export const ALL_DISTRICTS: string[] = BUNDLED_FACETS.districts;
export const ALL_UNIVERSITIES: string[] = BUNDLED_FACETS.universities;
export const ALL_EXAMS: string[] = BUNDLED_FACETS.exams;
export const ALL_ACCREDITATIONS: string[] = BUNDLED_FACETS.accreditations;
export const ALL_DEGREES: string[] = BUNDLED_FACETS.degrees;
export const ALL_SPECIALIZATIONS: string[] = BUNDLED_FACETS.specializations;

export const ALL_ADMISSION_STATUSES = ["open", "closed", "upcoming"] as const;

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

export function getSuggestions(
  query: string,
  dataset: College[] = COLLEGES,
  facets: CollegeFacets = BUNDLED_FACETS,
): SearchSuggestion[] {
  // `expandQuery` now folds diacritics and turns punctuation into separators, so a
  // single `.includes(q)` against a folded facet value cannot match a folded
  // needle containing a space. Token-AND it, like every other search here.
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const contains = (value: string) => matchesTokens(value, tokens);
  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const c of dataset) {
    if (contains(c.name) || contains(c.shortName) || contains(c.initials)) {
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
    for (const degree of facets.degrees) {
      if (contains(degree) && !seen.has(degree)) {
        seen.add(degree);
        suggestions.push({ type: "course", label: degree, sub: "Degree", value: degree });
      }
      if (suggestions.length >= 8) break;
    }
  }
  if (suggestions.length < 8) {
    for (const spec of facets.specializations) {
      if (contains(spec) && !seen.has(spec)) {
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
    for (const city of facets.cities) {
      if (contains(city) && !seen.has(city)) {
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

export function suggestSlug(label: string, dataset: College[] = COLLEGES): string {
  const needle = label.toLowerCase().replace(/\s+/g, "-");
  const hit =
    dataset.find((c) => c.slug === needle) ??
    dataset.find((c) => c.name.toLowerCase() === label.toLowerCase()) ??
    getCollegeBySlug(needle);
  return hit?.slug ?? "";
}