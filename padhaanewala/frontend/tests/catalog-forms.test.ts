import { describe, expect, it } from "vitest";

import {
  EMPTY_COURSE_FORM,
  buildCoursePayload,
  courseFormFromDetail,
  type CourseFormValues,
} from "@/lib/course-form";
import {
  EMPTY_EXAM_FORM,
  buildExamPayload,
  examFormFromDetail,
  type ExamFormValues,
} from "@/lib/exam-form";
import {
  EMPTY_SCHOLARSHIP_FORM,
  SCHOLARSHIP_OWNERSHIP_DEFAULT,
  SCHOLARSHIP_VERIFICATION_DEFAULT,
  buildScholarshipPayload,
  scholarshipFormFromDetail,
  type ScholarshipFormValues,
} from "@/lib/scholarship-form";
import {
  EMPTY_BLOG_FORM,
  buildBlogPayload,
  blogFormFromRow,
  type BlogFormValues,
} from "@/lib/blog-form";
import {
  EMPTY_FAQ_FORM,
  buildFaqPayload,
  faqFormFromDetail,
  type FaqFormValues,
} from "@/lib/faq-form";
import { CATALOG_DELETE_ROLES, CATALOG_WRITE_ROLES, hasAnyRole } from "@/lib/form-parts";

/**
 * The five catalogue payload builders.
 *
 * Every test here is about a failure that produces **no error at all**. That is
 * the whole class of bug this layer exists for, and it is why a suite of
 * ordinary "valid input round-trips" tests would have caught none of them:
 *
 *  - A key sent as `null` clears a column. A key *omitted* leaves it alone. So the
 *    omissions below are the assertions that matter — `is_active` on four
 *    entities, `slug` on a blog update, the entity pair on an FAQ update.
 *  - `JSON.stringify({ n: NaN })` is `{"n":null}`, not a 422. A typo in a numeric
 *    field writes a deliberate clear and reports success.
 *  - Pydantic ignores unknown keys, so sending a field the update schema does not
 *    declare gets a 200 and changes nothing.
 */

/** Narrowing helper: the builders return a union, and the tests want the value. */
function ok<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`expected a valid payload, got: ${result.error}`);
  return result.value;
}

function err(result: { ok: true; value: unknown } | { ok: false; error: string }): string {
  if (result.ok) throw new Error("expected a validation error, got a payload");
  return result.error;
}

/* ------------------------------------------------------------------ *
 * Role gates
 * ------------------------------------------------------------------ */

describe("role gates", () => {
  const SUPER_ADMIN = ["super_admin"];
  const ADMIN = ["admin"];
  const CONTENT_MANAGER = ["content_manager"];

  it("spells each delete gate as the full role list the backend requires", () => {
    // Transcribed from ADMIN_ROLES / CONTENT_ROLES in backend/app/roles.py. A
    // scalar here is the original bug: see the hasAnyRole note below.
    expect(CATALOG_DELETE_ROLES).toEqual({
      course: ["super_admin", "admin"],
      scholarship: ["super_admin", "admin"],
      exam: ["super_admin", "admin"],
      blog: ["super_admin", "admin"],
      faq: ["super_admin", "admin", "content_manager"],
    });
  });

  it("grants a super-admin-only user the delete button the API would accept", () => {
    // The regression. `roles` for a super admin is `["super_admin"]` and nothing
    // else — rank does not imply membership — so the old
    // `roles.includes(CATALOG_DELETE_ROLES[entity])` against the minimum role
    // "admin" returned false and hid a working Delete on four of five panels.
    for (const entity of ["course", "scholarship", "exam", "blog", "faq"] as const) {
      expect(hasAnyRole(SUPER_ADMIN, CATALOG_DELETE_ROLES[entity]), entity).toBe(true);
    }
  });

  it("still denies delete to a content manager on the four admin-gated routers", () => {
    for (const entity of ["course", "scholarship", "exam", "blog"] as const) {
      expect(hasAnyRole(CONTENT_MANAGER, CATALOG_DELETE_ROLES[entity]), entity).toBe(false);
    }
  });

  it("grants a content manager delete on FAQs, which is the one CONTENT_ROLES gate", () => {
    expect(hasAnyRole(CONTENT_MANAGER, CATALOG_DELETE_ROLES.faq)).toBe(true);
  });

  it("grants every role in CONTENT_ROLES the write gate, and no one else", () => {
    for (const roles of [SUPER_ADMIN, ADMIN, CONTENT_MANAGER]) {
      expect(hasAnyRole(roles, CATALOG_WRITE_ROLES), roles.join()).toBe(true);
    }
    for (const roles of [[], ["student"], ["author"], ["seo_manager"]]) {
      expect(hasAnyRole(roles, CATALOG_WRITE_ROLES), roles.join() || "(none)").toBe(false);
    }
  });

  it("denies a bare admin the college-only delete, which is SUPER_ADMIN_ROLES", () => {
    // Mirrors CollegesSection's own hand-rolled gate: T1 in backend/app/roles.py
    // is `super_admin` alone, and no shared constant covers it because colleges
    // is not one of the five catalogue tables.
    expect(hasAnyRole(SUPER_ADMIN, ["super_admin"])).toBe(true);
    expect(hasAnyRole(ADMIN, ["super_admin"])).toBe(false);
  });

  it("does not treat an unrelated role as satisfying a gate", () => {
    expect(hasAnyRole(["admin", "student"], ["super_admin"])).toBe(false);
    expect(hasAnyRole(["superadmin"], ["super_admin"])).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Courses
 * ------------------------------------------------------------------ */

const FILLED_COURSE: CourseFormValues = {
  ...EMPTY_COURSE_FORM,
  name: "B.Tech Computer Science",
  degree: "Undergraduate",
  duration: "4 years",
  category: "Engineering",
  overview: "A four-year programme.",
  eligibility: "Class 12 with PCM.",
  career_information: "Software roles.",
};

describe("buildCoursePayload", () => {
  it("carries every declared field in both modes", () => {
    // `CourseCreate` and `CourseUpdate` declare identical keys, so the two modes
    // must produce identical payloads. If a future divergence appears, this is
    // where it should break loudly.
    expect(ok(buildCoursePayload(FILLED_COURSE, "create"))).toEqual(
      ok(buildCoursePayload(FILLED_COURSE, "update")),
    );
  });

  it("never sends is_active, in either mode", () => {
    // The one-way door. `list_courses` and `get_course` both filter
    // `where(Course.is_active)`, so sending it removes the course from every
    // screen with no way back.
    for (const mode of ["create", "update"] as const) {
      expect(ok(buildCoursePayload(FILLED_COURSE, mode))).not.toHaveProperty("is_active");
    }
  });

  it("requires a name and bounds it", () => {
    expect(err(buildCoursePayload({ ...FILLED_COURSE, name: "" }, "create"))).toMatch(/required/i);
    expect(err(buildCoursePayload({ ...FILLED_COURSE, name: "B" }, "create"))).toMatch(/at least 2/);
  });

  it("sends an empty optional box as null, never as an empty string", () => {
    // A blank string is a different thing from a blank column, and these columns
    // are nullable.
    const payload = ok(buildCoursePayload({ ...FILLED_COURSE, overview: "   " }, "create"));
    expect(payload.overview).toBeNull();
  });

  it("refuses an over-long degree rather than truncating it", () => {
    expect(err(buildCoursePayload({ ...FILLED_COURSE, degree: "x".repeat(101) }, "create"))).toMatch(
      /100 characters/,
    );
  });
});

describe("courseFormFromDetail", () => {
  it("round-trips nulls as empty boxes rather than the string 'null'", () => {
    expect(
      courseFormFromDetail({
        id: 1,
        name: "BSc",
        degree: null,
        duration: null,
        category: null,
        overview: null,
        eligibility: null,
        career_information: null,
      }),
    ).toEqual({ ...EMPTY_COURSE_FORM, name: "BSc" });
  });
});

/* ------------------------------------------------------------------ *
 * Scholarships
 * ------------------------------------------------------------------ */

const FILLED_SCHOLARSHIP: ScholarshipFormValues = {
  ...EMPTY_SCHOLARSHIP_FORM,
  name: "Merit Scholarship",
  provider: "Ministry of Education",
  eligibility: "80% in Class 12",
  state_id: "7",
  amount: "up to ₹2,00,000",
  application_deadline: "2026-04-30",
  official_website: "https://example.gov.in",
  last_verified_date: "2026-01-15",
  next_verification_date: "2027-01-15",
};

describe("buildScholarshipPayload", () => {
  it("keeps the amount as text rather than coercing it to a number", () => {
    // `amount` is `String(255)`. "up to ₹2,00,000" and "50% of tuition fee" are
    // real values; `Number()` would reject or destroy both.
    const payload = ok(buildScholarshipPayload(FILLED_SCHOLARSHIP, "create"));
    expect(payload.amount).toBe("up to ₹2,00,000");
    expect(typeof payload.amount).toBe("string");
  });

  it("never sends is_active or documents_required", () => {
    // `is_active` is the one-way door; `documents_required` is a `list` column
    // that a textarea would 422 on. Both omitted.
    const payload = ok(buildScholarshipPayload(FILLED_SCHOLARSHIP, "update"));
    expect(payload).not.toHaveProperty("is_active");
    expect(payload).not.toHaveProperty("documents_required");
  });

  it("prefills ownership and verification so a create does not store empty strings", () => {
    const payload = ok(
      buildScholarshipPayload(
        {
          ...FILLED_SCHOLARSHIP,
          ownership: "",
          verification_status: "",
        },
        "create",
      ),
    );
    expect(payload.ownership).toBe(SCHOLARSHIP_OWNERSHIP_DEFAULT);
    expect(payload.verification_status).toBe(SCHOLARSHIP_VERIFICATION_DEFAULT);
  });

  it("keeps an unusual ownership value rather than snapping it to a known one", () => {
    // There is no enum on the column, so a `<select>` of invented values would
    // silently overwrite whatever the database already held.
    const payload = ok(
      buildScholarshipPayload({ ...FILLED_SCHOLARSHIP, ownership: "trust-ministry" }, "create"),
    );
    expect(payload.ownership).toBe("trust-ministry");
  });

  it("rejects a state id of zero rather than writing an unjoinable 0", () => {
    expect(err(buildScholarshipPayload({ ...FILLED_SCHOLARSHIP, state_id: "0" }, "create"))).toMatch(
      /less than 1/,
    );
  });

  it("rejects a non-numeric state id instead of storing null", () => {
    // The `NaN` trap: a typo here would otherwise become a silent clear.
    expect(err(buildScholarshipPayload({ ...FILLED_SCHOLARSHIP, state_id: "seven" }, "create"))).toMatch(
      /whole number/,
    );
  });

  it("leaves state_id null when the box is empty", () => {
    const payload = ok(buildScholarshipPayload({ ...FILLED_SCHOLARSHIP, state_id: "" }, "create"));
    expect(payload.state_id).toBeNull();
  });

  it("refuses a next verification date at or before the last verified date", () => {
    expect(
      err(
        buildScholarshipPayload(
          { ...FILLED_SCHOLARSHIP, last_verified_date: "2026-01-15", next_verification_date: "2026-01-15" },
          "update",
        ),
      ),
    ).toMatch(/after the last verified/);
  });

  it("rejects a date that is not real, rather than letting JavaScript roll it over", () => {
    // `new Date("2026-02-31")` is 2 March, not an error.
    expect(
      err(buildScholarshipPayload({ ...FILLED_SCHOLARSHIP, application_deadline: "2026-02-31" }, "create")),
    ).toMatch(/not a real date/);
  });

  it("truncates a full timestamp to the date the column expects", () => {
    const values = scholarshipFormFromDetail({
      id: 1,
      name: "Merit",
      provider: "Govt",
      ownership: "government",
      verification_status: "verified",
      eligibility: null,
      state_id: 3,
      course: null,
      category: null,
      income_criteria: null,
      amount: null,
      application_deadline: "2026-04-30T00:00:00",
      application_procedure: null,
      official_website: null,
      last_verified_date: null,
      next_verification_date: null,
    });
    expect(values.application_deadline).toBe("2026-04-30");
    expect(values.state_id).toBe("3");
  });
});

/* ------------------------------------------------------------------ *
 * Exams
 * ------------------------------------------------------------------ */

const FILLED_EXAM: ExamFormValues = {
  ...EMPTY_EXAM_FORM,
  name: "JEE Main",
  conducting_authority: "NTA",
  exam_type: "national",
  application_start_date: "2026-01-01",
  application_deadline: "2026-03-15",
  exam_date: "2026-04-20",
  result_date: "2026-06-30",
};

describe("buildExamPayload", () => {
  it("maps result_date from the validated date, not from an unbound variable", () => {
    // This is a real regression: the builder read `resultDate`, which does not
    // exist, so `result_date` was `undefined` and the column was never written.
    const payload = ok(buildExamPayload(FILLED_EXAM, "create"));
    expect(payload.result_date).toBe("2026-06-30");
  });

  it("never sends syllabus, faqs or is_active", () => {
    // `syllabus` is a `dict` and `faqs` a `list` — a textarea would 422. And
    // `is_active` is the one-way door.
    const payload = ok(buildExamPayload(FILLED_EXAM, "update"));
    expect(payload).not.toHaveProperty("syllabus");
    expect(payload).not.toHaveProperty("faqs");
    expect(payload).not.toHaveProperty("is_active");
  });

  it("refuses an application deadline after the exam date", () => {
    expect(
      err(buildExamPayload({ ...FILLED_EXAM, application_deadline: "2026-05-01" }, "create")),
    ).toMatch(/deadline cannot be after the exam date/);
  });

  it("allows a deadline on the day of the exam", () => {
    const payload = ok(
      buildExamPayload({ ...FILLED_EXAM, application_deadline: "2026-04-20" }, "create"),
    );
    expect(payload.application_deadline).toBe("2026-04-20");
  });

  it("requires the conducting authority even on update", () => {
    // `ExamUpdate` makes it optional where `ExamCreate` requires it, and a blank
    // here would store "" against a column the create schema insists on.
    expect(err(buildExamPayload({ ...FILLED_EXAM, conducting_authority: "" }, "update"))).toMatch(
      /required/,
    );
  });

  it("falls back to the declared exam type rather than to null", () => {
    const payload = ok(buildExamPayload({ ...FILLED_EXAM, exam_type: "" }, "create"));
    expect(payload.exam_type).toBe("national");
  });

  it("requires a body-bearing name and keeps every other box optional", () => {
    const sparse = ok(
      buildExamPayload({ ...EMPTY_EXAM_FORM, name: "Xyz Exam", conducting_authority: "Board" }, "create"),
    );
    expect(sparse.eligibility).toBeNull();
    expect(sparse.exam_date).toBeNull();
  });
});

describe("examFormFromDetail", () => {
  it("returns the date portion of a timestamp, so the input is a valid date", () => {
    const values = examFormFromDetail({
      id: 1,
      name: "JEE Main",
      conducting_authority: "NTA",
      exam_type: "national",
      eligibility: null,
      application_start_date: null,
      application_deadline: "2026-03-15T00:00:00",
      exam_date: null,
      admit_card_date: null,
      result_date: null,
      official_website: null,
      official_notification: null,
    });
    expect(values.application_deadline).toBe("2026-03-15");
  });
});

/* ------------------------------------------------------------------ *
 * Blogs
 * ------------------------------------------------------------------ */

const FILLED_BLOG: BlogFormValues = {
  ...EMPTY_BLOG_FORM,
  title: "Choosing a college",
  slug: "choosing-a-college",
  content: "The body of the article.",
  excerpt: "A short summary.",
  category_id: "4",
  status: "published",
  meta_title: "Choosing a college",
  meta_description: "How to pick.",
  canonical_url: "https://example.com/original",
  is_featured: true,
};

describe("buildBlogPayload", () => {
  it("sends the slug on create and never on update", () => {
    // `BlogUpdate` has no `slug`. Sending it gets a 200 and changes nothing.
    expect(ok(buildBlogPayload(FILLED_BLOG, "create")).slug).toBe("choosing-a-college");
    expect(ok(buildBlogPayload(FILLED_BLOG, "update"))).not.toHaveProperty("slug");
  });

  it("accepts a relative featured image path, which is what the media library writes", () => {
    const payload = ok(
      buildBlogPayload(
        { ...FILLED_BLOG, featured_image_url: "/api/v1/media/files/12" },
        "create",
      ),
    );
    expect(payload.featured_image_url).toBe("/api/v1/media/files/12");
  });

  it("rejects a featured image value that is neither http(s) nor a path", () => {
    expect(
      err(buildBlogPayload({ ...FILLED_BLOG, featured_image_url: "campus.png" }, "create")),
    ).toMatch(/http\(s\) address or a path/);
  });

  it("requires the canonical URL to be absolute, unlike the featured image", () => {
    expect(err(buildBlogPayload({ ...FILLED_BLOG, canonical_url: "/relative" }, "create"))).toMatch(
      /http\(s\) address/,
    );
  });

  it("refuses a blank body, which the schema would happily publish", () => {
    expect(err(buildBlogPayload({ ...FILLED_BLOG, content: "   " }, "create"))).toMatch(/required/i);
  });

  it("rejects a slug the server would silently rewrite", () => {
    // `_slugify` is `re.sub(r"[^a-z0-9]+", "-", ...).strip("-")`, so "Hello World"
    // becomes "hello-world" regardless of what was typed.
    expect(err(buildBlogPayload({ ...FILLED_BLOG, slug: "Hello World" }, "create"))).toMatch(
      /lowercase letters/,
    );
  });

  it("defaults a new article to a draft rather than publishing it on save", () => {
    expect(EMPTY_BLOG_FORM.status).toBe("draft");
  });

  it("round-trips a row into a payload without losing is_featured or status", () => {
    const values = blogFormFromRow({
      id: 9,
      title: "A published article",
      slug: "a-published-article",
      content: "body",
      excerpt: null,
      featured_image_url: null,
      category_id: null,
      status: "published",
      meta_title: null,
      meta_description: null,
      canonical_url: null,
      is_featured: true,
    });
    const payload = ok(buildBlogPayload(values, "update"));
    expect(payload.is_featured).toBe(true);
    expect(payload.status).toBe("published");
    expect(payload.category_id).toBeNull();
  });

  it("falls back to draft for a status value outside the two the schema allows", () => {
    // `BlogResponse.status` is a plain `str`; opening such a row and saving must
    // not be able to publish it.
    const values = blogFormFromRow({
      id: 9,
      title: "An archived article",
      slug: "an-archived-article",
      content: "body",
      excerpt: null,
      featured_image_url: null,
      category_id: null,
      status: "archived",
      meta_title: null,
      meta_description: null,
      canonical_url: null,
      is_featured: false,
    });
    expect(values.status).toBe("draft");
  });
});

/* ------------------------------------------------------------------ *
 * FAQs
 * ------------------------------------------------------------------ */

const FILLED_FAQ: FaqFormValues = {
  ...EMPTY_FAQ_FORM,
  question: "What is the deadline?",
  answer: "30 April.",
  entity_type: "college",
  entity_id: "12",
  display_order: "3",
};

describe("buildFaqPayload", () => {
  it("sends the entity pair on create and never on update", () => {
    // `FAQUpdate` has no `entity_type` or `entity_id`. A form that sent them on
    // edit would get 200, show "FAQ updated", and change nothing.
    const created = ok(buildFaqPayload(FILLED_FAQ, "create"));
    expect(created.entity_type).toBe("college");
    expect(created.entity_id).toBe(12);

    const updated = ok(buildFaqPayload(FILLED_FAQ, "update"));
    expect(updated).not.toHaveProperty("entity_type");
    expect(updated).not.toHaveProperty("entity_id");
  });

  it("never sends is_active", () => {
    // `list_faqs` and `get_faq` both filter on it, so a toggle would remove the
    // row with no route back. Also `FAQCreate` has no such field at all.
    expect(ok(buildFaqPayload(FILLED_FAQ, "create"))).not.toHaveProperty("is_active");
    expect(ok(buildFaqPayload(FILLED_FAQ, "update"))).not.toHaveProperty("is_active");
  });

  it("requires an entity id on create, and rejects zero", () => {
    expect(err(buildFaqPayload({ ...FILLED_FAQ, entity_id: "" }, "create"))).toMatch(/required/);
    expect(err(buildFaqPayload({ ...FILLED_FAQ, entity_id: "0" }, "create"))).toMatch(/less than 1/);
  });

  it("does not require an entity id on update, because it cannot be changed", () => {
    // The picker is absent from the edit dialog; the field is still prefilled for
    // display, and the builder must not insist on it.
    const payload = ok(buildFaqPayload({ ...FILLED_FAQ, entity_id: "" }, "update"));
    expect(payload).not.toHaveProperty("entity_id");
  });

  it("requires the question but not the answer", () => {
    expect(err(buildFaqPayload({ ...FILLED_FAQ, question: "" }, "create"))).toMatch(/required/);
    expect(ok(buildFaqPayload({ ...FILLED_FAQ, answer: "" }, "create")).answer).toBeNull();
  });

  it("defaults a blank display order to 0 rather than sending null into an int column", () => {
    const payload = ok(buildFaqPayload({ ...FILLED_FAQ, display_order: "" }, "create"));
    expect(payload.display_order).toBe(0);
  });

  it("rejects a negative display order instead of storing it", () => {
    expect(err(buildFaqPayload({ ...FILLED_FAQ, display_order: "-1" }, "create"))).toMatch(
      /less than 0/,
    );
  });

  it("prefills a null answer as an empty box", () => {
    expect(
      faqFormFromDetail({
        id: 1,
        question: "Q",
        answer: null,
        entity_type: "college",
        entity_id: 12,
        display_order: 0,
      }),
    ).toEqual({ question: "Q", answer: "", entity_type: "college", entity_id: "12", display_order: "0" });
  });
});
