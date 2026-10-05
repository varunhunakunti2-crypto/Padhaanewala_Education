import { describe, expect, it } from "vitest";

import {
  applyFilters,
  buildFacets,
  getSuggestions,
  matchesTokens,
  normalizeForSearch,
  searchColleges,
  searchTokens,
  sortColleges,
} from "@/lib/data";
import { searchCourses, type CourseMeta } from "@/lib/data/courses";
import { searchExams } from "@/lib/data/exams";
import { countActiveFilters } from "@/components/college/FiltersPanel";
import { defaultFilters, parseSearchParams, serializeSearch } from "@/lib/searchParams";
import type { College, Exam, SearchFilters } from "@/lib/types";

/**
 * Search, made structural.
 *
 * Every assertion here is a bug that shipped and stayed green, because
 * `tests/search-params.test.ts` only ever exercised the URL codec — never a
 * single filter. The codec round-tripped perfectly while:
 *
 *  - `/exams` ignored the query entirely (`list ?? searchExams(query)`)
 *  - `/colleges?q=Bengaluru` matched nothing but `?q=bengaluru` matched
 *  - `?q=Bengaluru, Karnataka` matched nothing (trailing comma token)
 *  - every max-fee range returned zero colleges (`Math.min(...[]) === Infinity`)
 *  - "B.Tech" matched nothing, because the list projection sent `courses: []`
 *  - fees-asc/desc ordering was undefined (`Infinity - Infinity` → NaN)
 *  - the two "N filters" badges counted different things
 *
 * A passing URL round-trip is not evidence a search works.
 */

function college(over: Partial<College> = {}): College {
  return {
    name: "BMS College of Engineering",
    shortName: "BMSCE",
    initials: "BMS",
    slug: "bms-college-of-engineering",
    city: "Bengaluru",
    state: "Karnataka",
    district: "Bengaluru Urban",
    university: "Bangalore University",
    type: "Private",
    sector: "Engineering",
    tagline: "Best engineering college in Bengaluru",
    rating: 4.2,
    reviewCount: 120,
    admissionStatus: "open",
    isFeatured: false,
    accreditation: ["NAAC A++"],
    rankings: [{ agency: "NIRF", rank: 42 }],
    courses: [],
    admission: { entranceExams: ["JEE Main"], eligibility: [] },
    scholarships: [],
    placement: { placementRate: 92 },
    fees: {},
    facilities: { hostel: true },
    ...over,
  } as College;
}

function filters(over: Partial<SearchFilters> = {}): SearchFilters {
  return { ...defaultFilters(), ...over };
}

const run = (f: SearchFilters, list: College[] = [college()]) =>
  searchColleges(f, 1, list).total;

describe("normalizeForSearch", () => {
  it("lowercases", () => {
    expect(normalizeForSearch("B.Tech")).toBe("b tech");
  });

  it("folds diacritics so Bengaluru matches Bengalūru", () => {
    expect(normalizeForSearch("Bengalūru")).toBe("bengaluru");
  });

  it("turns punctuation into separators, not dropped characters", () => {
    // The comma used to survive into the token list, so "Bengaluru," never
    // matched and every city suggestion returned zero results.
    expect(normalizeForSearch("Bengaluru, Karnataka")).toBe("bengaluru karnataka");
  });

  it("keeps the dot-free form of B.Tech searchable as words", () => {
    expect(searchTokens("B.Tech")).toEqual(["b", "tech"]);
  });

  it("treats whitespace-only input as no query", () => {
    expect(searchTokens("   ")).toEqual([]);
    expect(searchTokens("")).toEqual([]);
  });
});

describe("college query matching", () => {
  it("matches regardless of capitalisation", () => {
    // The headline bug: a lowercased haystack compared against a raw `?q=`.
    expect(run(filters({ query: "Bengaluru" }))).toBe(1);
    expect(run(filters({ query: "bengaluru" }))).toBe(1);
    expect(run(filters({ query: "BENGALURU" }))).toBe(1);
  });

  it("matches every POPULAR_SEARCHES entry that the data can support", () => {
    // These are the pills on the home page and in the search dropdown. Each
    // navigates to `/colleges?q=<value>` with the capitalisation shown.
    expect(run(filters({ query: "Bengaluru" }))).toBe(1);
    expect(run(filters({ query: "Engineering" }))).toBe(1);
    expect(run(filters({ query: "JEE" }))).toBe(1);
    expect(run(filters({ query: "NIRF" }))).toBe(1);
  });

  it("matches a city facet value verbatim, comma and all", () => {
    // `buildFacets` emits `"Bengaluru, Karnataka"` and clicking a suggestion
    // searches exactly that string.
    const city = buildFacets([college()]).cities[0]!;
    expect(city).toBe("Bengaluru, Karnataka");
    expect(run(filters({ query: city }))).toBe(1);
  });

  it("requires every token but ignores their order", () => {
    expect(run(filters({ query: "bengaluru engineering" }))).toBe(1);
    expect(run(filters({ query: "engineering bengaluru" }))).toBe(1);
    expect(run(filters({ query: "bengaluru mumbai" }))).toBe(0);
  });

  it("treats a whitespace-only query as no filter", () => {
    // `Boolean("   ")` was true, so the chip row and "Clear all" appeared over
    // an unfiltered grid.
    expect(run(filters({ query: "   " }))).toBe(1);
  });

  it("finds a college by its course name", () => {
    // The list projection used to send `courses: []`, so this whole arm of the
    // haystack was permanently empty and every "Find colleges" link on a course
    // card — plus the B.Tech/MBA pills — landed on an empty result page.
    const withCourse = college({
      courses: [
        { name: "Bachelor of Technology", degree: "B.Tech", specialization: "", duration: "4 years", seats: 120, feePerYear: 200000 },
      ],
    });
    expect(run(filters({ query: "B.Tech" }), [withCourse])).toBe(1);
    expect(run(filters({ query: "b.tech" }), [withCourse])).toBe(1);
    expect(run(filters({ query: "Bachelor of Technology" }), [withCourse])).toBe(1);
  });

  it("builds degree facets from the synthesised course rows", () => {
    const withCourse = college({
      courses: [
        { name: "Bachelor of Technology", degree: "B.Tech", specialization: "", duration: "4 years", seats: 120, feePerYear: 200000 },
      ],
    });
    expect(buildFacets([withCourse]).degrees).toEqual(["B.Tech"]);
  });

  it("does not invent a city facet for a college with no city", () => {
    // `uniqSorted` filters empty strings but not the literal ", Karnataka" this
    // used to build.
    const f = buildFacets([college({ city: "" })]);
    expect(f.cities).not.toContain(", Karnataka");
  });

  it("matches diacritic variants", () => {
    expect(run(filters({ query: "Bengalūru" }))).toBe(1);
  });

  it("does not match an absent word", () => {
    expect(run(filters({ query: "Bengaluru Oxford" }))).toBe(0);
  });
});

describe("facets", () => {
  it("exposes district and university, which the panel filters on", () => {
    const f = buildFacets([college()]);
    expect(f.districts).toEqual(["Bengaluru Urban"]);
    expect(f.universities).toEqual(["Bangalore University"]);
  });

  it("builds entrance-exam and accreditation facets from real data", () => {
    const f = buildFacets([college()]);
    expect(f.exams).toEqual(["JEE Main"]);
    expect(f.accreditations).toEqual(["NAAC A++"]);
  });
});

describe("suggestions", () => {
  it("suggests for a capitalised query", () => {
    expect(getSuggestions("Beng", [college()], buildFacets([college()]))).not.toHaveLength(0);
  });

  it("suggests the city facet for a city prefix", () => {
    const s = getSuggestions("Bengaluru", [college()], buildFacets([college()]));
    expect(s.some((x) => x.type === "city")).toBe(true);
  });

  it("returns nothing for whitespace", () => {
    expect(getSuggestions("  ", [college()], buildFacets([college()]))).toEqual([]);
  });
});

describe("fee filters", () => {
  it("does not drop every college when maxFee is set", () => {
    // `Math.min(...[]) === Infinity`, and `Infinity > 50000` is true, so every
    // college failed every bounded fee range — including the ones with no fee
    // data at all.
    expect(run(filters({ maxFee: 50000 }))).toBe(1);
  });

  it("still filters colleges that do have fees", () => {
    const withFees = college({
      courses: [
        { name: "B.Tech", degree: "B.Tech", specialization: "", duration: "4 years", seats: 120, feePerYear: 200000 },
      ],
    });
    expect(run(filters({ maxFee: 50000 }), [withFees])).toBe(0);
    expect(run(filters({ maxFee: 300000 }), [withFees])).toBe(1);
    expect(run(filters({ minFee: 100000 }), [withFees])).toBe(1);
    expect(run(filters({ minFee: 400000 }), [withFees])).toBe(0);
  });
});

describe("fee sorting", () => {
  it("does not produce a NaN comparator when no college has fee data", () => {
    // `Infinity - Infinity` is NaN, and `Array.sort` reads a NaN comparator as
    // "equal", so the result was whatever the engine's partition happened to
    // leave — a different order for different inputs, with no way to predict it.
    //
    // With every key equal a correct sort is *stable*, so the assertion is that
    // input order survives intact rather than that two inputs converge. What
    // matters is that no college moves for a reason that is not a fee.
    const list = [college({ slug: "a" }), college({ slug: "b" }), college({ slug: "c" })];
    for (const key of ["fees-asc", "fees-desc"] as const) {
      expect(sortColleges(list, key).map((c) => c.slug)).toEqual(["a", "b", "c"]);
      // And it is genuinely stable rather than accidentally so: reversing the
      // input reverses the output, which is what a working comparator gives here.
      expect(sortColleges([...list].reverse(), key).map((c) => c.slug)).toEqual(["c", "b", "a"]);
    }
  });

  it("orders known fees and puts unknown-fee colleges last", () => {
    const withFee = (slug: string, fee: number) =>
      college({
        slug,
        courses: [
          { name: "B.Tech", degree: "B.Tech", specialization: "", duration: "4 years", seats: 60, feePerYear: fee },
        ],
      });
    const asc = sortColleges(
      [college({ slug: "unknown" }), withFee("expensive", 900000), withFee("cheap", 100000)],
      "fees-asc",
    ).map((c) => c.slug);
    expect(asc).toEqual(["cheap", "expensive", "unknown"]);
  });
});

describe("course search", () => {
  const course = (over: Partial<CourseMeta> = {}): CourseMeta => ({
    slug: "b-tech",
    name: "Bachelor of Technology",
    degree: "B.Tech",
    level: "UG",
    description: "Engineering degree",
    duration: "4 years",
    avgFeeYear: 200000,
    hot: false,
    ...over,
  });

  it("matches multi-word queries in any order", () => {
    // Was one contiguous `includes(q)`, so "B.Tech Computer Science" could never
    // match "B.Tech Computer Science Engineering" while the same query on
    // /colleges matched by word.
    const cse = course({
      slug: "b-tech-cse",
      name: "B.Tech Computer Science Engineering",
      degree: "B.Tech",
      description: "Computer science and engineering",
    });
    expect(searchCourses("b.tech computer science", [cse])).toHaveLength(1);
    expect(searchCourses("computer science b.tech", [cse])).toHaveLength(1);
  });

  it("still rejects a token the record does not contain", () => {
    expect(searchCourses("b.tech computer science", [course()])).toHaveLength(0);
  });

  it("searches duration, which was missing from the haystack", () => {
    expect(searchCourses("4 years", [course()])).toHaveLength(1);
  });

  it("is case-insensitive and diacritic-insensitive", () => {
    expect(searchCourses("BACHELOR OF TECHNOLOGY", [course()])).toHaveLength(1);
  });

  it("returns the whole catalogue for an empty or whitespace query", () => {
    const list = [course(), course({ slug: "mba", name: "Master of Business Administration", degree: "MBA" })];
    expect(searchCourses("", list)).toHaveLength(2);
    expect(searchCourses("   ", list)).toHaveLength(2);
  });
});

describe("exam search", () => {
  const exam = (over: Partial<Exam> = {}): Exam =>
    ({
      id: "1",
      slug: "jee-main",
      name: "JEE Main",
      shortName: "JEE Main",
      level: "UG",
      conductingBody: "NTA",
      type: "National Entrance",
      overview: "Engineering entrance",
      eligibility: "12th pass",
      stage: "Registration Open",
      dates: [],
      faqs: [],
      pattern: [],
      coursesAccepted: [],
      collegesAccepting: [],
      ...over,
    }) as unknown as Exam;

  it("filters the list it is given", () => {
    // `/exams` passed `list` and the old call was `list ?? searchExams(query)`,
    // so the query never ran and the box did nothing.
    const neet = exam({
      id: "2",
      slug: "neet",
      name: "NEET UG",
      shortName: "NEET",
      conductingBody: "NTA",
      type: "Medical Entrance",
    });
    const jee = exam();
    const list = [jee, neet];
    expect(searchExams("jee", list)).toHaveLength(1);
    expect(searchExams("neet", list)).toHaveLength(1);
    // Both are run by NTA, so this is the query that actually narrows.
    expect(searchExams("nta", list)).toHaveLength(2);
    expect(searchExams("medical", list)).toHaveLength(1);
    expect(searchExams("", list)).toHaveLength(2);
  });

  it("is case-insensitive and order-independent", () => {
    const list = [exam()];
    expect(searchExams("NTA", list)).toHaveLength(1);
    expect(searchExams("nta engineering", list)).toHaveLength(1);
    expect(searchExams("engineering nta", list)).toHaveLength(1);
  });

  it("returns nothing for a non-matching query", () => {
    expect(searchExams("cat", [exam()])).toHaveLength(0);
  });
});

describe("matchesTokens", () => {
  it("is AND across tokens, substring within one", () => {
    expect(matchesTokens("Bengaluru Karnataka", ["bengaluru", "kar"])).toBe(true);
    expect(matchesTokens("Bengaluru Karnataka", ["bengaluru", "mumbai"])).toBe(false);
  });

  it("matches everything when there are no tokens", () => {
    expect(matchesTokens("anything", [])).toBe(true);
  });
});

describe("active filter count", () => {
  it("counts the same terms the panel shows", () => {
    // Two hand-written counters disagreed: the SortBar badge said 2 where the
    // panel header said 5.
    const f = filters({
      states: ["Karnataka"],
      districts: ["Bengaluru Urban"],
      universities: ["Bangalore University"],
      admissionStatuses: ["open"],
      minRating: 4,
    });
    expect(countActiveFilters(f)).toBe(5);
  });

  it("counts a fee range once whether or not both ends are set", () => {
    expect(countActiveFilters(filters({ maxFee: 50000 }))).toBe(1);
    expect(countActiveFilters(filters({ minFee: 10000, maxFee: 50000 }))).toBe(1);
    expect(countActiveFilters(filters({}))).toBe(0);
  });
});

describe("query survives the URL codec", () => {
  it("round-trips a capitalised multi-word query", () => {
    const f = filters({ query: "B.Tech Computer Science", states: ["Karnataka"] });
    const back = parseSearchParams(new URLSearchParams(serializeSearch(f, 1)));
    expect(back.filters.query).toBe("B.Tech Computer Science");
    expect(back.filters.states).toEqual(["Karnataka"]);
  });

  it("still applies a parsed capitalised query", () => {
    // The codec was never the bug, but this is the actual user path: a pill on
    // the home page produces this URL.
    const parsed = parseSearchParams(new URLSearchParams("q=Bengaluru"));
    expect(run(parsed.filters)).toBe(1);
  });
});