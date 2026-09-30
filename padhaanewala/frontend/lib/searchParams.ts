import type { SearchFilters, SortKey } from "./types";

export function defaultFilters(): SearchFilters {
  return {
    query: "",
    states: [],
    cities: [],
    courseNames: [],
    sectors: [],
    types: [],
    exams: [],
    accreditations: [],
    hostel: null,
    placementRate: null,
    minFee: null,
    maxFee: null,
    sortBy: "relevance",
    districts: [],
    universities: [],
    admissionStatuses: [],
    minRating: null,
  };
}

export function parseSearchParams(sp: URLSearchParams): { filters: SearchFilters; page: number } {
  const filters = defaultFilters();
  filters.query = sp.get("q") ?? "";
  filters.states = sp.getAll("state");
  filters.cities = sp.getAll("city");
  filters.courseNames = sp.getAll("course");
  filters.sectors = sp.getAll("sector") as SearchFilters["sectors"];
  filters.types = sp.getAll("type");
  filters.exams = sp.getAll("exam");
  filters.accreditations = sp.getAll("acc");
  filters.hostel = sp.get("hostel") === "1" ? true : sp.get("hostel") === "0" ? false : null;
  filters.placementRate = sp.get("placement") === "1" ? true : sp.get("placement") === "0" ? false : null;
  filters.minFee = sp.get("minFee") ? Number(sp.get("minFee")) : null;
  filters.maxFee = sp.get("maxFee") ? Number(sp.get("maxFee")) : null;
  filters.districts = sp.getAll("district");
  filters.universities = sp.getAll("university");
  filters.admissionStatuses = sp.getAll("status") as SearchFilters["admissionStatuses"];
  filters.minRating = sp.get("rating") ? Number(sp.get("rating")) : null;
  const sort = sp.get("sort") as SortKey | null;
  if (sort && ["relevance", "rating", "fees-asc", "fees-desc", "placement", "reviews", "name"].includes(sort)) {
    filters.sortBy = sort;
  }
  const page = Number(sp.get("page"));
  return { filters, page: Number.isFinite(page) && page > 0 ? page : 1 };
}

export function serializeSearch(filters: SearchFilters, page: number): string {
  const sp = new URLSearchParams();
  if (filters.query) sp.set("q", filters.query);
  filters.states.forEach((s) => sp.append("state", s));
  filters.cities.forEach((s) => sp.append("city", s));
  filters.courseNames.forEach((s) => sp.append("course", s));
  filters.sectors.forEach((s) => sp.append("sector", s));
  filters.types.forEach((s) => sp.append("type", s));
  filters.exams.forEach((s) => sp.append("exam", s));
  filters.accreditations.forEach((s) => sp.append("acc", s));
  if (filters.hostel !== null) sp.set("hostel", filters.hostel ? "1" : "0");
  if (filters.placementRate !== null) sp.set("placement", filters.placementRate ? "1" : "0");
  if (filters.minFee !== null) sp.set("minFee", String(filters.minFee));
  if (filters.maxFee !== null) sp.set("maxFee", String(filters.maxFee));
  filters.districts.forEach((s) => sp.append("district", s));
  filters.universities.forEach((s) => sp.append("university", s));
  filters.admissionStatuses.forEach((s) => sp.append("status", s));
  if (filters.minRating !== null) sp.set("rating", String(filters.minRating));
  if (filters.sortBy !== "relevance") sp.set("sort", filters.sortBy);
  if (page > 1) sp.set("page", String(page));
  return sp.toString();
}

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "rating", label: "Highest rated" },
  { value: "fees-asc", label: "Fees: low to high" },
  { value: "fees-desc", label: "Fees: high to low" },
  { value: "placement", label: "Best placement rate" },
  { value: "reviews", label: "Most reviews" },
  { value: "name", label: "Name (A–Z)" },
];