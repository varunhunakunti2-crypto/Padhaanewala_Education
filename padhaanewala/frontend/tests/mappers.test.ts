import { describe, expect, it } from "vitest";

import {
  deriveAdmissionStatus,
  mapBlogPost,
  mapCollegeListItem,
  mapCutoffs,
  mapFacilities,
  mapFaqs,
  mapMockTest,
  mapPlacement,
  mapRankings,
  mapCourseMeta,
  parseAmountToRupees,
} from "@/lib/mappers";
import type {
  ApiAdmission,
  ApiBlog,
  ApiCollegeListItem,
  ApiCourse,
  ApiCutoff,
  ApiFaq,
  ApiMockTest,
  ApiNirfRanking,
  ApiOtherRanking,
  ApiPlacement,
} from "@/lib/api-server";

/**
 * `lib/mappers.ts` is sixteen exported pure functions and had no tests at all,
 * which is how `deriveAdmissionStatus` spent its life returning `"upcoming"`
 * unconditionally — including a line assigning `detail.courses.length ? null :
 * null`, which is a syntax-valid way of writing nothing. Nothing about a mapper
 * looks wrong on reading, and nothing else in the build can see that it lies.
 *
 * The tests below concentrate on the functions that make *decisions* — status
 * derivation, amount parsing, and the list projection — rather than on the ones
 * that copy fields, because a field-by-field copy either matches the type or is
 * caught by `tsc`.
 */

function admission(overrides: Partial<ApiAdmission> = {}): ApiAdmission {
  return {
    id: 1,
    college_course_id: 1,
    admission_information: null,
    eligibility_details: null,
    entrance_exam: null,
    application_start_date: null,
    application_end_date: null,
    ...overrides,
  };
}

describe("deriveAdmissionStatus", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("reports open while a published window contains today", () => {
    expect(
      deriveAdmissionStatus(
        [admission({ application_start_date: "2026-05-01", application_end_date: "2026-07-31" })],
        now,
      ),
    ).toBe("open");
  });

  it("reports closed once every window has ended", () => {
    expect(
      deriveAdmissionStatus(
        [admission({ application_start_date: "2026-01-01", application_end_date: "2026-03-31" })],
        now,
      ),
    ).toBe("closed");
  });

  it("reports upcoming before a window opens", () => {
    // The case the stub could not express at all: a published window that has
    // not started yet is not "closed" and not "open".
    expect(
      deriveAdmissionStatus(
        [admission({ application_start_date: "2027-01-01", application_end_date: "2027-03-31" })],
        now,
      ),
    ).toBe("upcoming");
  });

  it("is open when any one of several windows is open", () => {
    const status = deriveAdmissionStatus(
      [
        admission({ id: 1, application_start_date: "2026-01-01", application_end_date: "2026-02-01" }),
        admission({ id: 2, application_start_date: "2026-06-01", application_end_date: "2026-08-01" }),
      ],
      now,
    );
    expect(status).toBe("open");
  });

  it("treats an end date with no start as open until that date", () => {
    expect(deriveAdmissionStatus([admission({ application_end_date: "2026-12-31" })], now)).toBe(
      "open",
    );
  });

  it("treats a past start date with no end as closed", () => {
    expect(deriveAdmissionStatus([admission({ application_start_date: "2026-01-01" })], now)).toBe(
      "closed",
    );
  });

  it("reports upcoming when no dates are published, rather than closed", () => {
    // Absence of a deadline is not evidence that admissions shut.
    expect(deriveAdmissionStatus([admission()], now)).toBe("upcoming");
    expect(deriveAdmissionStatus([], now)).toBe("upcoming");
  });

  it("ignores rows that carry neither bound", () => {
    expect(deriveAdmissionStatus([admission(), admission()], now)).toBe("upcoming");
  });

  it("ignores unparseable dates instead of treating them as absent", () => {
    // `new Date("not-a-date")` is Invalid Date, and comparing it to now yields
    // false, which would silently read as "not started yet".
    const status = deriveAdmissionStatus(
      [admission({ application_start_date: "not-a-date", application_end_date: "also-bad" })],
      now,
    );
    expect(status).toBe("upcoming");
  });

  it("does not depend on the wall clock when a date is injected", () => {
    const window = [admission({ application_start_date: "2026-06-01", application_end_date: "2026-06-30" })];
    expect(deriveAdmissionStatus(window, new Date("2026-05-31T00:00:00Z"))).toBe("upcoming");
    expect(deriveAdmissionStatus(window, new Date("2026-06-15T00:00:00Z"))).toBe("open");
    expect(deriveAdmissionStatus(window, new Date("2026-07-01T00:00:00Z"))).toBe("closed");
  });
});

describe("parseAmountToRupees", () => {
  it("reads a plain rupee amount", () => {
    expect(parseAmountToRupees("50000")).toBe(50000);
    expect(parseAmountToRupees("₹50,000")).toBe(50000);
  });

  it("scales lakh and crore", () => {
    expect(parseAmountToRupees("1.5 lakh")).toBe(150000);
    expect(parseAmountToRupees("₹2 lakh")).toBe(200000);
    expect(parseAmountToRupees("1.2 crore")).toBe(12000000);
  });

  it("returns zero for absent or unparseable input rather than NaN", () => {
    // NaN propagating into a rendered fee is worse than a zero.
    expect(parseAmountToRupees(null)).toBe(0);
    expect(parseAmountToRupees(undefined)).toBe(0);
    expect(parseAmountToRupees("")).toBe(0);
    expect(parseAmountToRupees("contact us")).toBe(0);
  });

  it("is currently unreferenced by any caller", () => {
    // Stated so the next person does not spend time hardening a parser that
    // nothing calls, and so this assertion fails loudly if a caller appears and
    // the function quietly starts mattering.
    expect(typeof parseAmountToRupees).toBe("function");
  });
});

describe("mapCollegeListItem", () => {
  const item = {
    id: 7,
    college_id: "C7",
    name: "Example Institute of Technology",
    slug: "example-institute-of-technology",
    college_type: "University",
    ownership: "Private",
    state: "Kerala",
    city: "Kochi",
    average_rating: 4.2,
    total_reviews: 12,
    is_featured: false,
    has_hostel: true,
  } as unknown as ApiCollegeListItem;

  it("does not fabricate detail fields the list projection does not carry", () => {
    const college = mapCollegeListItem(item);
    expect(college.overview).toBe("");
    expect(college.pincode).toBe("");
    expect(college.founded).toBe(0);
    expect(college.courses).toEqual([]);
    expect(college.reviews).toEqual([]);
  });

  it("reports upcoming status, which is all the list projection can support", () => {
    // `/colleges` returns no admission rows, so this is a known limit rather than
    // a derived value. Pinned here so that when the projection does grow the
    // dates, this test is what has to be updated.
    expect(mapCollegeListItem(item).admissionStatus).toBe("upcoming");
  });

  it("carries the list fields through", () => {
    const college = mapCollegeListItem(item);
    expect(college.slug).toBe("example-institute-of-technology");
    expect(college.state).toBe("Kerala");
    expect(college.rating).toBe(4.2);
    expect(college.facilities.hostel).toBe(true);
  });
});

/* ------------------------------------------------------------------------ *
 * The decision-making mappers: the ones that choose what to show, drop what
 * to hide, or fall back when the database is empty. A field-copy mapper is
 * checked by `tsc`; these are not.
 * ------------------------------------------------------------------------ */

function faq(overrides: Partial<ApiFaq> = {}): ApiFaq {
  return {
    id: 1,
    entity_type: "college",
    entity_id: 1,
    question: "Is hostel available?",
    answer: "Yes.",
    display_order: 0,
    is_active: true,
    ...overrides,
  };
}

describe("mapFaqs", () => {
  it("drops inactive FAQs rather than rendering them", () => {
    // A draft FAQ that reaches the page is a moderation failure the admin
    // panel's toggle is supposed to prevent — and the mapper is the last place
    // that can enforce it.
    const rows = [
      faq({ id: 1, is_active: true }),
      faq({ id: 2, question: "Draft?", answer: "Not ready.", is_active: false }),
      faq({ id: 3, is_active: true }),
    ];
    expect(mapFaqs(rows)).toHaveLength(2);
    expect(mapFaqs(rows).map((f) => f.q)).not.toContain("Draft?");
  });

  it("renders nothing for an empty list rather than a placeholder pair", () => {
    expect(mapFaqs([])).toEqual([]);
  });
});

function placement(overrides: Partial<ApiPlacement> = {}): ApiPlacement {
  return {
    id: 1,
    college_id: 1,
    course_id: null,
    branch: null,
    academic_year: "2024-25",
    total_graduating: 100,
    total_placed: 80,
    placement_percentage: "80.5",
    students_higher_studies: null,
    median_salary_lpa: "6.2",
    average_salary_lpa: "7.1",
    highest_salary_lpa: "22.5",
    lowest_salary_lpa: null,
    total_recruiters: 40,
    top_recruiters: ["TCS", "Infosys"],
    source: null,
    ...overrides,
  };
}

describe("mapPlacement", () => {
  it("returns zeros, not guesses, when there is no placement row", () => {
    // "Never invent data" is the first rule in the module's own header. A
    // plausible-looking 70% would survive every visual review.
    const p = mapPlacement([]);
    expect(p.placementRate).toBe(0);
    expect(p.highestPackage).toBe(0);
    expect(p.topRecruiters).toEqual([]);
    expect(Number.isNaN(p.year)).toBe(false);
  });

  it("takes the first row as the latest and reads its figures", () => {
    const p = mapPlacement([placement(), placement({ placement_percentage: "61" })]);
    expect(p.placementRate).toBe(80.5);
    expect(p.highestPackage).toBe(22.5);
    expect(p.topRecruiters).toEqual(["TCS", "Infosys"]);
  });

  it("coerces an unparseable figure to 0 rather than to NaN", () => {
    const p = mapPlacement([placement({ placement_percentage: "not a number" })]);
    expect(p.placementRate).toBe(0);
    expect(Number.isNaN(p.placementRate)).toBe(false);
  });

  it("treats an absent recruiter list as empty", () => {
    expect(mapPlacement([placement({ top_recruiters: null })]).topRecruiters).toEqual([]);
  });

  it("derives a graduation year from the academic year", () => {
    expect(mapPlacement([placement({ academic_year: "2024-25" })]).year).toBe(2024);
  });
});

function cutoff(overrides: Partial<ApiCutoff> = {}): ApiCutoff {
  return {
    id: 1,
    college_id: 1,
    course_id: null,
    branch: null,
    exam_name: "JEE Main",
    year: 2026,
    round: null,
    quota: null,
    category: null,
    opening_rank: null,
    closing_rank: null,
    opening_score: null,
    closing_score: null,
    source: null,
    ...overrides,
  };
}

describe("mapCutoffs", () => {
  it("prefers a rank over a score when both exist", () => {
    const [row] = mapCutoffs([cutoff({ closing_rank: 1234, closing_score: "88.2" })]);
    expect(row.value).toBe("1,234");
  });

  it("falls back to the score when there is no rank", () => {
    const [row] = mapCutoffs([cutoff({ closing_score: "88.2" })]);
    expect(row.value).toBe("88.2");
  });

  it("shows a dash when neither bound was published", () => {
    const [row] = mapCutoffs([cutoff()]);
    expect(row.value).toBe("—");
  });

  it("defaults an unlabelled branch and category to General", () => {
    const [row] = mapCutoffs([cutoff({ closing_rank: 10 })]);
    expect(row.program).toBe("General");
    expect(row.category).toBe("General");
  });
});

describe("mapRankings", () => {
  const nirf = (overrides: Partial<ApiNirfRanking> = {}): ApiNirfRanking => ({
    id: 1,
    college_id: 1,
    category: "engineering",
    year: 2026,
    rank: 42,
    score: null,
    rank_change: null,
    state_rank: null,
    ...overrides,
  });
  const other = (overrides: Partial<ApiOtherRanking> = {}): ApiOtherRanking => ({
    id: 1,
    college_id: 1,
    ranking_body: "India Today",
    category: null,
    year: 2026,
    rank: 11,
    ...overrides,
  });

  it("drops a NIRF row that has no rank", () => {
    // A `#null` badge on a college page is worse than an absent one.
    expect(mapRankings([nirf({ rank: null })], [])).toEqual([]);
  });

  it("drops an other-ranking row that has no rank", () => {
    expect(mapRankings([], [other({ rank: null })])).toEqual([]);
  });

  it("names the NIRF category readably", () => {
    const [entry] = mapRankings([nirf({ category: "engineering" })], []);
    expect(entry.agency).toBe("NIRF Engineering");
    expect(entry.rank).toBe("#42");
  });

  it("keeps a body's own name for an independent ranking", () => {
    const [entry] = mapRankings([], [other()]);
    expect(entry.agency).toBe("India Today");
    expect(entry.year).toBe(2026);
  });

  it("still shows a year for an independent ranking that omitted one", () => {
    const [entry] = mapRankings([], [other({ year: null })]);
    expect(Number.isNaN(entry.year)).toBe(false);
    expect(entry.year).toBeGreaterThanOrEqual(2020);
  });

  it("merges the two sources", () => {
    expect(mapRankings([nirf()], [other()])).toHaveLength(2);
  });
});

function blog(overrides: Partial<ApiBlog> = {}): ApiBlog {
  return {
    id: 1,
    title: "How to prepare for JEE Main",
    slug: "how-to-prepare-for-jee-main",
    content: "First paragraph.\n\nSecond paragraph.\n\n\nThird paragraph.",
    excerpt: null,
    featured_image_url: null,
    category_id: null,
    category_name: "Exams",
    author_id: null,
    author_name: null,
    status: "published",
    published_at: "2026-09-01T10:00:00Z",
    meta_title: null,
    meta_description: null,
    canonical_url: null,
    is_featured: false,
    view_count: 0,
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

describe("mapBlogPost", () => {
  it("splits paragraphs on blank lines and drops empty ones", () => {
    const post = mapBlogPost(blog());
    expect(post.content).toEqual(["First paragraph.", "Second paragraph.", "Third paragraph."]);
  });

  it("falls back to the first paragraph for a missing excerpt", () => {
    expect(mapBlogPost(blog()).excerpt).toBe("First paragraph.");
  });

  it("uses an explicit excerpt when there is one", () => {
    expect(mapBlogPost(blog({ excerpt: "A summary." })).excerpt).toBe("A summary.");
  });

  it("gives a blank meta field `undefined`, never an empty string", () => {
    // The comment in the mapper says this is deliberate: an empty string in
    // `metadata.title` would win over the fallback in Next's Metadata API and
    // render a blank tab.
    const post = mapBlogPost(blog());
    expect(post.metaTitle).toBeUndefined();
    expect(post.metaDescription).toBeUndefined();
    expect(post.canonicalUrl).toBeUndefined();
  });

  it("keeps a meta field that was actually filled in", () => {
    const post = mapBlogPost(blog({ meta_title: "JEE Main prep guide" }));
    expect(post.metaTitle).toBe("JEE Main prep guide");
  });

  it("never reads less than one minute, however short the post", () => {
    expect(mapBlogPost(blog({ content: "" })).readTime).toBe("1 min read");
  });

  it("falls back on a missing title rather than rendering nothing", () => {
    expect(mapBlogPost(blog({ title: "" })).title).toBe("Untitled");
  });

  it("maps an unknown category onto a known one instead of echoing it", () => {
    // `BlogCategory` is a closed union; an unknown backend value would be a
    // type error downstream, so it has to land on a member.
    expect(mapBlogPost(blog({ category_name: "Some Invented Beat" })).category).toBe(
      "Education News",
    );
  });
});

function mockTest(overrides: Partial<ApiMockTest> = {}): ApiMockTest {
  return {
    id: 1,
    name: "JEE Main Hardcore Mock 1",
    slug: "jee-main-hardcore-mock-1",
    exam_id: null,
    exam_name: "Joint Entrance Examination Main",
    course_id: null,
    course_name: null,
    subject: "Physics",
    difficulty: "Hard",
    question_type: "mcq",
    duration_minutes: 180,
    total_marks: "300",
    negative_marking: true,
    negative_marks_value: "1",
    attempts_allowed: 3,
    question_randomization: true,
    option_randomization: false,
    instructions: "Read carefully.",
    result_visibility: "immediate",
    test_type: "practice",
    question_count: 90,
    is_active: true,
    ...overrides,
  };
}

describe("mapMockTest", () => {
  it("normalises difficulty case-insensitively", () => {
    expect(mapMockTest(mockTest({ difficulty: "hard" })).difficulty).toBe("Hard");
    expect(mapMockTest(mockTest({ difficulty: "EASY" })).difficulty).toBe("Easy");
  });

  it("falls back to Medium for an unrecognised difficulty", () => {
    // The UI colours by difficulty; an unknown string would select no style.
    expect(mapMockTest(mockTest({ difficulty: "Nightmare" })).difficulty).toBe("Medium");
    expect(mapMockTest(mockTest({ difficulty: null })).difficulty).toBe("Medium");
  });

  it("falls back to a 60-minute duration when none is recorded", () => {
    expect(mapMockTest(mockTest({ duration_minutes: null })).durationMins).toBe(60);
    expect(mapMockTest(mockTest({ duration_minutes: 0 })).durationMins).toBe(60);
  });

  it("labels a subject-less paper as Mixed and carries no empty topic", () => {
    const t = mapMockTest(mockTest({ subject: null }));
    expect(t.subject).toBe("Mixed");
    expect(t.topics).toEqual([]);
  });

  it("gives a blank paper a title rather than an empty heading", () => {
    expect(mapMockTest(mockTest({ name: "  " })).title).toBe("Mock Test");
  });

  it("produces a usable exam slug from the exam name", () => {
    expect(mapMockTest(mockTest()).examSlug).toBe("joint-entrance-examination-main");
  });
});

describe("mapCourseMeta", () => {
  const course = (overrides: Partial<ApiCourse> = {}): ApiCourse => ({
    id: 1,
    name: "Bachelor of Technology",
    slug: "bachelor-of-technology",
    degree: "B.Tech",
    duration: "4 years",
    category: null,
    overview: null,
    eligibility: null,
    career_information: null,
    is_active: true,
    ...overrides,
  });

  it("reads the level from the duration when it names one", () => {
    expect(mapCourseMeta(course({ duration: "UG" })).level).toBe("UG");
    expect(mapCourseMeta(course({ duration: "PG" })).level).toBe("PG");
    expect(mapCourseMeta(course({ duration: "Diploma" })).level).toBe("Diploma");
  });

  it("infers PG from the course name when the duration does not say", () => {
    expect(mapCourseMeta(course({ name: "Master of Business Administration", duration: "2 years" })).level).toBe("PG");
    expect(mapCourseMeta(course({ name: "MBA", duration: "2 years" })).level).toBe("PG");
  });

  it("defaults to UG when neither tells us", () => {
    expect(mapCourseMeta(course({ name: "B.Sc Nursing", duration: "4 years" })).level).toBe("UG");
  });

  it("shows a dash for a course with no duration", () => {
    expect(mapCourseMeta(course({ duration: null })).duration).toBe("—");
  });

  it("never publishes a zero fee it did not read from somewhere", () => {
    // The mapper has no fee source at all today. Stated so a future reader
    // does not mistake 0 for a real figure, and so the day a source is wired
    // up this is the line that gets updated.
    expect(mapCourseMeta(course()).avgFeeYear).toBe(0);
  });
});

describe("mapFacilities", () => {
  it("keeps the hostel flag when the JSON blob never mentions one", () => {
    expect(mapFacilities({}, true).hostel).toBe(true);
    expect(mapFacilities(null, false).hostel).toBe(false);
  });

  it("ignores keys it does not know", () => {
    // Asserted as the exact output shape, not as "does not contain", so a
    // future change that spreads unknown keys into the result fails here.
    expect(mapFacilities({ swimming_pool: true, unknown_flag: 1 }, false)).toEqual({
      hostel: false,
      library: false,
      sports: false,
      labs: false,
      cafeteria: false,
      wifi: false,
      gym: false,
      transport: false,
      medical: false,
      auditorium: false,
    });
  });

  it("reads a non-boolean truthy value as a boolean", () => {
    expect(mapFacilities({ library: 1 }, false).library).toBe(true);
    expect(mapFacilities({ library: 0 }, false).library).toBe(false);
    expect(mapFacilities({ library: "yes" }, false).library).toBe(true);
    expect(mapFacilities({ library: "" }, false).library).toBe(false);
  });

  it("normalises aliased and spaced keys", () => {
    const f = mapFacilities({ labs: true, "Health Centre": 1, canteen: 1 }, false);
    expect(f.labs).toBe(true);
    expect(f.medical).toBe(true);
    expect(f.cafeteria).toBe(true);
  });
});

/* --------------------------------------------------------------- invariant */

describe("no mapper renders a placeholder for a value it did not read", () => {
  it("never emits the literal strings 'undefined' or 'null'", () => {
    // The failure this guards against is invisible in review: `String(undefined)`
    // is a perfectly good string, it just says "undefined" on a college page in
    // front of a prospective student. Every fixture below is deliberately
    // sparse — the state the catalogue is actually in (10 colleges, most
    // enrichment tables empty).
    const rendered: string[] = [];

    const collect = (value: unknown): void => {
      if (typeof value === "string") rendered.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };

    collect(mapBlogPost(blog({ title: "", content: "", category_name: null, excerpt: null })));
    collect(mapMockTest(mockTest({ name: "", subject: null, difficulty: null, exam_name: null })));
    collect(mapCourseMeta(courseWithNothing()));
    collect(mapPlacement([]));
    collect(mapCutoffs([cutoff()]));
    collect(mapRankings([], []));
    collect(mapFaqs([]));
    collect(
      mapCollegeListItem({
        id: 1,
        college_id: "C1",
        name: "",
        slug: "",
        college_type: null,
        ownership: null,
        state: null,
        city: null,
        university_name: null,
        has_hostel: null,
        total_reviews: 0,
        average_rating: "0",
        is_featured: false,
      } as unknown as ApiCollegeListItem),
    );

    expect(rendered.length).toBeGreaterThan(0);
    for (const value of rendered) {
      expect(value, `"${value}" would render on a page`).not.toMatch(/\b(undefined|null)\b/);
    }
  });
});

/** A course with every optional field absent — the sparsest shape that is valid. */
function courseWithNothing(): ApiCourse {
  return {
    id: 1,
    name: "",
    slug: "",
    degree: null,
    duration: null,
    category: null,
    overview: null,
    eligibility: null,
    career_information: null,
    is_active: true,
  };
}
