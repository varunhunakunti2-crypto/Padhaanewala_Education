import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/content.ts` — the resolution layer every server component reads through.
 *
 * This file exists because of a specific, shipped failure: the resolvers used
 * to fall back to bundled literals whenever the backend was unreachable *or
 * simply returned an empty list*, so a dead or empty database rendered a fully
 * populated site. The invented colleges, courses, exams and blog posts were
 * removed — but nothing stops the fallback coming back, because a resolver that
 * substitutes a bundled dataset looks exactly like a resolver that renders an
 * empty state, right up until someone reads the page.
 *
 * So the central assertion here is negative: **given an empty or unreachable
 * backend, `resolveColleges` must report `empty` and hand back `[]`.** The
 * one deliberate exception is mock tests, whose runner grades in the browser
 * from the local catalogue — that exception is asserted as an exception, which
 * is the only way to keep it from spreading to the other resolvers.
 *
 * `api-server` memoises paged walks per path for the lifetime of the module,
 * so each scenario imports a fresh module graph (`vi.resetModules`) rather than
 * sharing one cache across tests that need different responses.
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Install a fetch stub that answers by inspecting the request URL. */
function stubFetch(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => handler(String(input))),
  );
}

/** A fresh `content` module, with its `api-server` cache cleared. */
async function freshContent() {
  vi.resetModules();
  return import("@/lib/content");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {
    /* failures are expected in these tests and are asserted on elsewhere */
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

const collegeRow = {
  id: 1,
  college_id: "C1",
  name: "Example Institute",
  slug: "example-institute",
  college_type: "Engineering",
  ownership: "Private",
  state: "Karnataka",
  city: "Bengaluru",
  university_name: null,
  has_hostel: true,
  total_reviews: 4,
  average_rating: "4.1",
  is_featured: false,
};

describe("resolveColleges", () => {
  it("falls back to local bundled dataset when the table is empty", async () => {
    stubFetch(() => json([]));
    const { resolveColleges } = await freshContent();
    const { COLLEGES } = await import("@/lib/data/colleges");

    const result = await resolveColleges();

    expect(result.source).toBe("local");
    expect(result.data).toEqual(COLLEGES);
  });

  it("falls back to local bundled dataset when the backend cannot be reached at all", async () => {
    stubFetch(() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
    });
    const { resolveColleges } = await freshContent();
    const { COLLEGES } = await import("@/lib/data/colleges");

    const result = await resolveColleges();

    expect(result.source).toBe("local");
    expect(result.data).toEqual(COLLEGES);
  });

  it("falls back to local bundled dataset when the backend answers 500", async () => {
    stubFetch(() => json({ detail: "boom" }, 500));
    const { resolveColleges } = await freshContent();
    const { COLLEGES } = await import("@/lib/data/colleges");

    expect((await resolveColleges()).data).toEqual(COLLEGES);
  });

  it("reports `api` and maps the rows it was given", async () => {
    stubFetch(() => json([collegeRow]));
    const { resolveColleges } = await freshContent();

    const result = await resolveColleges();

    expect(result.source).toBe("api");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].slug).toBe("example-institute");
  });
});

describe("resolveCollege", () => {
  it("reports `empty` for a slug neither backend nor local catalogue knows", async () => {
    stubFetch(() => json(null, 404));
    const { resolveCollege } = await freshContent();

    const result = await resolveCollege("no-such-college");

    expect(result.source).toBe("empty");
    expect(result.data).toBeUndefined();
  });
});

describe("resolveFeaturedColleges", () => {
  it("never returns more than the caller asked for", async () => {
    stubFetch(() => json([collegeRow, { ...collegeRow, id: 2, slug: "second" }]));
    const { resolveFeaturedColleges } = await freshContent();

    expect((await resolveFeaturedColleges(1)).data).toHaveLength(1);
  });

  it("falls back to local featured colleges when the backend has nothing", async () => {
    stubFetch(() => json([]));
    const { resolveFeaturedColleges } = await freshContent();

    const result = await resolveFeaturedColleges();
    expect(result.source).toBe("local");
    expect(result.data.length).toBeGreaterThan(0);
  });
});

describe("list resolvers", () => {
  it("resolveExams falls back to local dataset for an empty table", async () => {
    stubFetch(() => json([]));
    const { resolveExams } = await freshContent();
    const { EXAMS } = await import("@/lib/data/exams");

    const result = await resolveExams();
    expect(result.source).toBe("local");
    expect(result.data).toEqual(EXAMS);
  });

  it("resolveScholarships falls back to local dataset for an empty table", async () => {
    stubFetch(() => json([]));
    const { resolveScholarships } = await freshContent();

    expect((await resolveScholarships()).source).toBe("local");
  });

  it("resolveBlogPosts reports empty for an empty table when no local posts exist", async () => {
    stubFetch(() => json([]));
    const { resolveBlogPosts } = await freshContent();

    expect((await resolveBlogPosts()).source).toBe("empty");
  });

  it("resolveCourses falls back to local dataset for an empty table", async () => {
    stubFetch(() => json([]));
    const { resolveCourses } = await freshContent();
    const { COURSES } = await import("@/lib/data/courses");

    const result = await resolveCourses();
    expect(result.source).toBe("local");
    expect(result.data).toEqual(COURSES);
  });

  it("resolveCourse reports empty for a slug it cannot find", async () => {
    stubFetch(() => json([]));
    const { resolveCourse } = await freshContent();

    const result = await resolveCourse("bachelor-of-nothing");
    expect(result.source).toBe("empty");
    expect(result.data).toBeUndefined();
  });
});

/* ----------------------------- hero cards ------------------------------ */

/**
 * `resolveHeroCards` is the one resolver whose fallback is *not* a bundled
 * dataset standing in for an empty table — see the note on
 * `HERO_CARD_DEFAULTS`. So its three outcomes have to be pinned separately,
 * because each means something different to the hero:
 *
 *   `api`   — an admin authored cards; render them.
 *   `empty` — an admin cleared the slot; render nothing (an authored state).
 *   `local` — the backend did not answer; keep the shipped defaults up.
 */
describe("resolveHeroCards", () => {
  const heroCardRow = {
    id: 7,
    title: "JEE Advanced 2027",
    subtitle: "Register now",
    image_url: "https://example.com/jee.png",
    link_url: "/exams/jee-advanced",
    position: "hero_card",
    display_order: 1,
    is_active: true,
  };

  it("reports `api` and maps title, CTA line and link", async () => {
    stubFetch(() => json([heroCardRow]));
    const { resolveHeroCards } = await freshContent();

    const result = await resolveHeroCards();

    expect(result.source).toBe("api");
    expect(result.data).toEqual([
      {
        title: "JEE Advanced 2027",
        action: "Register now",
        href: "/exams/jee-advanced",
        thumb: "https://example.com/jee.png",
      },
    ]);
  });

  it("defaults the CTA line to `Learn more` when an admin left it blank", async () => {
    stubFetch(() => json([{ ...heroCardRow, subtitle: "   " }]));
    const { resolveHeroCards } = await freshContent();

    const [card] = (await resolveHeroCards()).data;
    expect(card.action).toBe("Learn more");
  });

  it("keeps every card, in order — the hero list is unbounded", async () => {
    stubFetch(() =>
      json(
        [1, 2, 3, 4, 5].map((n) => ({
          ...heroCardRow,
          id: n,
          title: `Card ${n}`,
          display_order: n,
        })),
      ),
    );
    const { resolveHeroCards } = await freshContent();

    const result = await resolveHeroCards();
    expect(result.data).toHaveLength(5);
    expect(result.data.map((c) => c.title)).toEqual([
      "Card 1",
      "Card 2",
      "Card 3",
      "Card 4",
      "Card 5",
    ]);
  });

  it("drops a card whose link is a scheme or protocol-relative, keeping the rest", async () => {
    // A row can predate the write-time validation, so the read path re-checks
    // rather than trusting the column.
    stubFetch(() =>
      json([
        { ...heroCardRow, id: 1, title: "Evil", link_url: "javascript:alert(1)" },
        { ...heroCardRow, id: 2, title: "Also evil", link_url: "//evil.example" },
        { ...heroCardRow, id: 3, title: "Fine" },
      ]),
    );
    const { resolveHeroCards } = await freshContent();

    const result = await resolveHeroCards();
    expect(result.data.map((c) => c.title)).toEqual(["Fine"]);
  });

  it("reports `empty` — not `local` — when the backend answers with no cards", async () => {
    // The distinction the other resolvers do not have: an empty slot is an
    // admin's decision, and re-injecting defaults would override it.
    stubFetch(() => json([]));
    const { resolveHeroCards } = await freshContent();

    const result = await resolveHeroCards();

    expect(result.source).toBe("empty");
    expect(result.data).toEqual([]);
  });

  it("falls back to the shipped defaults only when the backend cannot be reached", async () => {
    stubFetch(() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
    });
    const { resolveHeroCards } = await freshContent();

    const result = await resolveHeroCards();

    expect(result.source).toBe("local");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.length).toBeLessThanOrEqual(3);
    // Every default has to be renderable, or the fallback reintroduces the
    // unvalidated-link hazard it is standing in for.
    for (const card of result.data) {
      expect(card.href.startsWith("/")).toBe(true);
    }
  });

  it("falls back to the shipped defaults when the backend answers 500", async () => {
    stubFetch(() => json({ detail: "boom" }, 500));
    const { resolveHeroCards } = await freshContent();

    expect((await resolveHeroCards()).source).toBe("local");
  });
});

describe("isRenderableHref", () => {
  it("accepts an internal path and an absolute http(s) URL", async () => {
    const { isRenderableHref } = await freshContent();
    expect(isRenderableHref("/scholarships")).toBe(true);
    expect(isRenderableHref("https://example.com/x")).toBe(true);
    expect(isRenderableHref("http://example.com/x")).toBe(true);
  });

  it("rejects schemes, protocol-relative links and blanks", async () => {
    const { isRenderableHref } = await freshContent();
    expect(isRenderableHref("javascript:alert(1)")).toBe(false);
    expect(isRenderableHref("data:text/html,<script>")).toBe(false);
    expect(isRenderableHref("//evil.example")).toBe(false);
    expect(isRenderableHref("colleges")).toBe(false);
    expect(isRenderableHref("")).toBe(false);
    expect(isRenderableHref("   ")).toBe(false);
    expect(isRenderableHref(null)).toBe(false);
    expect(isRenderableHref(undefined)).toBe(false);
  });
});

/* --------------------------- the mock-test exception --------------------- */

describe("resolveMockTests", () => {
  it("falls back to the local catalogue when the API has nothing", async () => {
    // The one documented exception: the proctored runner grades in the browser
    // from `lib/data/mockTests.ts`, so a paper listed only locally must still
    // render a card rather than the catalogue going blank.
    stubFetch(() => json([]));
    const { resolveMockTests } = await freshContent();
    const { MOCK_TESTS } = await import("@/lib/data/mockTests");

    const result = await resolveMockTests();

    expect(result.source).toBe("local");
    expect(result.data).toBe(MOCK_TESTS);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("prefers the API when the API has papers", async () => {
    stubFetch(() =>
      json([
        {
          id: 5,
          name: "Paper from the database",
          slug: "paper-from-the-database",
          exam_id: null,
          exam_name: null,
          course_id: null,
          course_name: null,
          subject: "Physics",
          difficulty: "Hard",
          question_type: "mcq",
          duration_minutes: 180,
          total_marks: null,
          negative_marking: true,
          negative_marks_value: null,
          attempts_allowed: 2,
          question_randomization: false,
          option_randomization: false,
          instructions: null,
          result_visibility: null,
          test_type: null,
          question_count: 30,
          is_active: true,
        },
      ]),
    );
    const { resolveMockTests } = await freshContent();

    const result = await resolveMockTests();

    expect(result.source).toBe("api");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Paper from the database");
  });

  it("verifies both mock tests and colleges return local source when API is empty", async () => {
    stubFetch(() => json([]));
    const { resolveColleges, resolveMockTests } = await freshContent();

    expect((await resolveColleges()).source).toBe("local");
    expect((await resolveMockTests()).source).toBe("local");
  });
});

describe("resolveMockTest", () => {
  const apiRow = {
    id: 77,
    name: "API name",
    slug: "jee-main-hardcore-mock-paper-2-2026",
    exam_id: null,
    exam_name: "Joint Entrance Examination Main",
    course_id: null,
    course_name: null,
    subject: null,
    difficulty: "Easy",
    question_type: "mcq",
    duration_minutes: 90,
    total_marks: null,
    negative_marking: true,
    negative_marks_value: null,
    attempts_allowed: 1,
    question_randomization: false,
    option_randomization: false,
    instructions: null,
    result_visibility: null,
    test_type: null,
    question_count: 75,
    is_active: true,
  };

  it("takes the database id and attempt policy from the API, and everything else from the local catalogue", async () => {
    // The reconciliation rule the module documents: `mapMockTest` cannot supply
    // `questionIds`, the marking scheme or a real subject for a three-subject
    // paper, so the local entry stays the base and the API is authoritative
    // only for what only it knows.
    stubFetch(() => json(apiRow));
    const { resolveMockTest } = await freshContent();
    const { getMockTest } = await import("@/lib/data/mockTests");

    const local = getMockTest(apiRow.slug);
    expect(local, "the fixture slug must exist in the local catalogue").toBeDefined();

    const result = await resolveMockTest(apiRow.slug);

    expect(result.source).toBe("api");
    expect(result.data?.id).toBe("77");
    expect(result.data?.attempts).toBe(1);
    // Everything that defines what the paper *contains* comes from local.
    expect(result.data?.difficulty).toBe(local!.difficulty);
    expect(result.data?.questionCount).toBe(local!.questionCount);
    expect(result.data?.topics).toEqual(local!.topics);
  });

  it("returns the API row as mapped when there is no local entry", async () => {
    stubFetch(() => json({ ...apiRow, slug: "a-paper-only-the-database-knows" }));
    const { resolveMockTest } = await freshContent();

    const result = await resolveMockTest("a-paper-only-the-database-knows");

    expect(result.source).toBe("api");
    // No reconciliation happened — it must still be a usable, mapped row.
    expect(result.data?.title).toBe("API name");
    expect(result.data?.id).toBe("77");
  });

  it("falls back to the local catalogue when the API does not know the paper", async () => {
    stubFetch(() => json(null, 404));
    const { resolveMockTest } = await freshContent();

    const result = await resolveMockTest("jee-main-hardcore-mock-paper-2-2026");

    expect(result.source).toBe("local");
    expect(result.data).toBeDefined();
  });

  it("reports `empty` only when neither side has the paper", async () => {
    stubFetch(() => json(null, 404));
    const { resolveMockTest } = await freshContent();

    const result = await resolveMockTest("a-paper-nothing-has");

    expect(result.source).toBe("empty");
    expect(result.data).toBeUndefined();
  });
});

/* ---------------------------------- slugs -------------------------------- */

describe("resolveSlugs", () => {
  it("caps the list when a limit is given", async () => {
    stubFetch(() =>
      json([
        { ...collegeRow, slug: "one" },
        { ...collegeRow, id: 2, slug: "two" },
        { ...collegeRow, id: 3, slug: "three" },
      ]),
    );
    const { resolveSlugs } = await freshContent();

    expect(await resolveSlugs("colleges", 2)).toEqual(["one", "two"]);
  });

  it("returns everything when no limit is given", async () => {
    stubFetch(() =>
      json([
        { ...collegeRow, slug: "one" },
        { ...collegeRow, id: 2, slug: "two" },
      ]),
    );
    const { resolveSlugs } = await freshContent();

    expect(await resolveSlugs("colleges")).toEqual(["one", "two"]);
  });

  it("falls back to local slugs for an empty API response", async () => {
    stubFetch(() => json([]));
    const { resolveSlugs } = await freshContent();
    const { EXAMS } = await import("@/lib/data/exams");
    const { COURSES } = await import("@/lib/data/courses");

    expect(await resolveSlugs("exams")).toEqual(EXAMS.map((e) => e.slug));
    expect(await resolveSlugs("courses")).toEqual(COURSES.map((c) => c.slug));
    expect(await resolveSlugs("blogs")).toEqual([]);
  });

  it("uses the local catalogue for mock-test slugs when the API is empty", async () => {
    stubFetch(() => json([]));
    const { resolveSlugs } = await freshContent();
    const { MOCK_TESTS } = await import("@/lib/data/mockTests");

    const slugs = await resolveSlugs("mock-tests");

    expect(slugs).toEqual(MOCK_TESTS.map((t) => t.slug));
    expect(slugs.length).toBeGreaterThan(0);
  });

  it("caps the local mock-test fallback too", async () => {
    stubFetch(() => json([]));
    const { resolveSlugs } = await freshContent();

    expect(await resolveSlugs("mock-tests", 1)).toHaveLength(1);
  });
});
