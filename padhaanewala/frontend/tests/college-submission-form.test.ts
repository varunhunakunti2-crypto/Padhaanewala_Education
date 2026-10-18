import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import type { CollegeSubmission } from "@/lib/api";
import {
  EMPTY_COLLEGE_SUBMISSION_FORM,
  SUBMISSION_FIELD_MAX,
  SUBMISSION_NAME_MAX,
  SUBMISSION_NAME_MIN,
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABEL,
  buildSubmissionPayload,
  describeSubmissionError,
  isRevisable,
  submissionFormFromRecord,
  type CollegeSubmissionFormValues,
} from "@/lib/college-submission-form";

/**
 * The "suggest a college" form's decisions, tested without a DOM.
 *
 * The three that will bite silently rather than loudly:
 *
 *  1. `CollegeSubmissionCreate` sets `extra="forbid"`, so an unknown key is a
 *     **422**, not a dropped field. The builder must emit exactly the schema's
 *     key set — no form-local helper state, nothing else.
 *  2. A blank box must become `null`, not `""`. The columns are nullable and a
 *     stored empty string reads as "recorded, and empty" rather than "not
 *     recorded".
 *  3. The server validates the website (`http(s)` + host) and the email shape.
 *     A value that fails here would otherwise be a 422 the user cannot map back
 *     to a field.
 */

function values(
  overrides: Partial<CollegeSubmissionFormValues> = {},
): CollegeSubmissionFormValues {
  return {
    ...EMPTY_COLLEGE_SUBMISSION_FORM,
    proposed_name: "Coastal Institute of Technology",
    ...overrides,
  };
}

function build(v: CollegeSubmissionFormValues) {
  const result = buildSubmissionPayload(v);
  if (!result.ok) throw new Error(`expected a payload, got: ${result.error}`);
  return result.payload;
}

function record(overrides: Partial<CollegeSubmission> = {}): CollegeSubmission {
  return {
    id: 12,
    submitted_by: 4,
    submitter_name: "Asha",
    proposed_name: "Coastal Institute of Technology",
    proposed_official_name: "Coastal Institute of Technology, Mangaluru",
    proposed_college_type: "Engineering",
    proposed_ownership: "Private",
    proposed_university_name: "Mangalore University",
    proposed_state_id: 5,
    proposed_state_name: "Karnataka",
    proposed_city: "Mangaluru",
    proposed_address: "NH-66, Mangaluru",
    proposed_website: "https://cit.example.edu.in",
    proposed_email: "office@cit.example.edu.in",
    proposed_phone: "0824-123456",
    proposed_overview: "A coastal engineering college.",
    submitter_notes: "Please add my college.",
    status: "pending",
    reviewer_id: null,
    reviewer_name: null,
    reviewer_notes: null,
    reviewed_at: null,
    college_id: null,
    college_name: null,
    college_slug: null,
    college_is_active: null,
    possible_duplicate_college_id: null,
    possible_duplicate_college_name: null,
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
    ...overrides,
  };
}

describe("name validation", () => {
  it("rejects an empty name, which is the one required field", () => {
    for (const name of ["", "   ", "\t\n"]) {
      expect(buildSubmissionPayload(values({ proposed_name: name })).ok).toBe(false);
    }
  });

  it("rejects a name below the backend's own minimum", () => {
    const result = buildSubmissionPayload(
      values({ proposed_name: "A".repeat(SUBMISSION_NAME_MIN - 1) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 2 characters/i);
  });

  it("rejects a name above the backend's own maximum", () => {
    const result = buildSubmissionPayload(
      values({ proposed_name: "A".repeat(SUBMISSION_NAME_MAX + 1) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/longer than 255/i);
  });

  it("trims the name, so surrounding whitespace cannot create a distinct slug", () => {
    expect(build(values({ proposed_name: "  Coastal University  " })).proposed_name).toBe(
      "Coastal University",
    );
  });

  it("rejects a name that clears the length check but slugifies to nothing", () => {
    // `_slugify` keeps only `[a-z0-9]`, so punctuation alone becomes `""` — and
    // approving it writes an empty slug into the unique index. A 500 on the
    // server has to read as a field error here.
    for (const name of ["--", "..", "  ()  ", "\u2013\u2014"]) {
      const result = buildSubmissionPayload(values({ proposed_name: name }));
      expect(result.ok, `${JSON.stringify(name)} should have been refused`).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/letter or number/i);
    }
  });

  it("accepts a punctuation-heavy name as long as one letter or digit survives", () => {
    expect(build(values({ proposed_name: "-- St. Xav-- 2 --" })).proposed_name).toBe(
      "-- St. Xav-- 2 --",
    );
  });

  it("measures the name after control bytes are stripped, like the server does", () => {
    // The server cleans control bytes *before* it measures. A name that is only
    // control bytes is empty there; one that leaves a single character behind is
    // below the minimum. Measuring the raw string would send both.
    const controlOnly = buildSubmissionPayload(values({ proposed_name: "\x01\x01\x02" }));
    expect(controlOnly.ok).toBe(false);
    if (!controlOnly.ok) expect(controlOnly.error).toMatch(/needs a name/i);

    const oneLeft = buildSubmissionPayload(values({ proposed_name: " \x01a " }));
    expect(oneLeft.ok).toBe(false);
    if (!oneLeft.ok) expect(oneLeft.error).toMatch(/at least 2 characters/i);
  });
});

describe("a blank box is absence, not an empty string", () => {
  it("sends null rather than \"\" for every untouched optional field", () => {
    const payload = build(values());
    expect(payload.proposed_official_name).toBeNull();
    expect(payload.proposed_university_name).toBeNull();
    expect(payload.proposed_state_id).toBeNull();
    expect(payload.proposed_city).toBeNull();
    expect(payload.proposed_website).toBeNull();
    expect(payload.proposed_overview).toBeNull();
    expect(payload.submitter_notes).toBeNull();
  });

  it("preserves a value the submitter did type", () => {
    expect(build(values({ proposed_city: "  Kochi " })).proposed_city).toBe("Kochi");
  });

  it("parses a whole-number state id", () => {
    expect(build(values({ proposed_state_id: " 12 " })).proposed_state_id).toBe(12);
  });

  it("refuses a state id that is not a whole number", () => {
    const result = buildSubmissionPayload(values({ proposed_state_id: "Karnataka" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/whole number/i);
  });
});

describe("the server's two value validators are mirrored", () => {
  it.each([
    ["in.example.edu", /http/i],
    ["www.example.edu", /http/i],
    ["javascript:alert(1)", /http/i],
    ["ftp://example.edu", /http/i],
  ])("refuses website %s", (site, pattern) => {
    const result = buildSubmissionPayload(values({ proposed_website: site }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it.each(["https://example.edu.in", "http://example.edu.in/admissions"])(
    "accepts website %s",
    (site) => {
      expect(build(values({ proposed_website: site })).proposed_website).toBe(site);
    },
  );

  it.each([
    ["no-at-sign.example.edu", /valid email/i],
    ["missing@tld", /valid email/i],
    ["two@@example.edu", /valid email/i],
  ])("refuses email %s", (email, pattern) => {
    const result = buildSubmissionPayload(values({ proposed_email: email }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it("accepts a well-shaped email", () => {
    expect(build(values({ proposed_email: "office@cit.example.edu.in" })).proposed_email).toBe(
      "office@cit.example.edu.in",
    );
  });
});

describe("length caps match the columns", () => {
  for (const [field, max] of Object.entries(SUBMISSION_FIELD_MAX)) {
    it(`refuses ${field} longer than ${max}`, () => {
      const result = buildSubmissionPayload(values({ [field]: "A".repeat(max + 1) }));
      expect(result.ok, `${field} should have been refused at ${max + 1}`).toBe(false);
    });
  }

  it("accepts a value exactly at the cap", () => {
    expect(build(values({ proposed_city: "A".repeat(100) })).proposed_city).toHaveLength(100);
  });
});

describe("the payload is exactly the schema's key set", () => {
  // `extra="forbid"`: a stray key is a 422, not a dropped field. This pins the
  // key set so a form-local helper accidentally spread onto the wire fails here.
  const EXPECTED = [
    "proposed_address",
    "proposed_city",
    "proposed_college_type",
    "proposed_email",
    "proposed_name",
    "proposed_official_name",
    "proposed_overview",
    "proposed_ownership",
    "proposed_phone",
    "proposed_state_id",
    "proposed_state_name",
    "proposed_university_name",
    "proposed_website",
    "submitter_notes",
  ];

  it("emits every declared key and nothing else", () => {
    expect(Object.keys(build(values())).sort()).toEqual(EXPECTED);
  });

  it("never sends a server-owned field", () => {
    const payload = build(values()) as unknown as Record<string, unknown>;
    for (const owned of [
      "status",
      "reviewer_id",
      "reviewer_notes",
      "reviewed_at",
      "college_id",
      "submitted_by",
      "possible_duplicate_college_id",
    ]) {
      expect(payload[owned]).toBeUndefined();
    }
  });
});

describe("prefill from the server's own record", () => {
  it("round-trips a populated record back into an identical payload", () => {
    const source = record();
    const payload = build(submissionFormFromRecord(source));
    expect(payload).toMatchObject({
      proposed_name: source.proposed_name,
      proposed_official_name: source.proposed_official_name,
      proposed_college_type: source.proposed_college_type,
      proposed_ownership: source.proposed_ownership,
      proposed_university_name: source.proposed_university_name,
      proposed_state_id: source.proposed_state_id,
      proposed_state_name: source.proposed_state_name,
      proposed_city: source.proposed_city,
      proposed_address: source.proposed_address,
      proposed_website: source.proposed_website,
      proposed_email: source.proposed_email,
      proposed_phone: source.proposed_phone,
      proposed_overview: source.proposed_overview,
      submitter_notes: source.submitter_notes,
    });
  });

  it("does not invent values for fields the record omits", () => {
    const form = submissionFormFromRecord(
      record({ proposed_state_id: null, proposed_city: null, submitter_notes: null }),
    );
    expect(form.proposed_state_id).toBe("");
    expect(form.proposed_city).toBe("");
    expect(form.submitter_notes).toBe("");
  });
});

describe("status helpers", () => {
  it("lists each status exactly once, actionable states first", () => {
    expect([...SUBMISSION_STATUSES]).toEqual([
      "pending",
      "changes_requested",
      "approved",
      "rejected",
    ]);
    expect(new Set(SUBMISSION_STATUSES).size).toBe(SUBMISSION_STATUSES.length);
  });

  it("has a label for every status", () => {
    for (const status of SUBMISSION_STATUSES) {
      expect(SUBMISSION_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("marks only pending and changes_requested as revisable", () => {
    expect(isRevisable("pending")).toBe(true);
    expect(isRevisable("changes_requested")).toBe(true);
    expect(isRevisable("approved")).toBe(false);
    expect(isRevisable("rejected")).toBe(false);
  });
});

describe("error messages a caller can act on", () => {
  it("explains the duplicate-name 409, which is the one the submitter can cause", () => {
    const message = describeSubmissionError(
      new ApiError("A college with this name already exists — check the list.", 409),
    );
    expect(message).toMatch(/already exists/i);
  });

  it("passes through a 409 that is not a duplicate, such as a reviewed row", () => {
    const message = describeSubmissionError(
      new ApiError("This submission has been reviewed and can no longer be edited.", 409),
    );
    expect(message).toMatch(/already been reviewed|no longer be edited/i);
  });

  it("distinguishes a missing permission from a missing record", () => {
    expect(describeSubmissionError(new ApiError("forbidden", 403))).toMatch(/permission/i);
    expect(describeSubmissionError(new ApiError("gone", 404))).toMatch(/no longer exists/i);
  });

  it("surfaces the server's own validation message", () => {
    expect(describeSubmissionError(new ApiError("proposed_name: too short", 422))).toBe(
      "proposed_name: too short",
    );
  });

  it("does not blame the user for a transport failure", () => {
    expect(describeSubmissionError(new ApiError("Request failed (0)", 0))).toMatch(
      /could not reach the api/i,
    );
    expect(describeSubmissionError(new Error("boom"))).toMatch(/could not be sent/i);
  });
});

/* ------------------------------------------------------------------ *
 * Length contract against the backend
 * ------------------------------------------------------------------ */

const SCHEMAS = resolve(import.meta.dirname, "../../backend/app/schemas/submissions.py");
const source = readFileSync(SCHEMAS, "utf8");

/** The body of one class, from its declaration to the next one. */
function classBody(name: string): string {
  const start = source.indexOf(`class ${name}`);
  expect(start, `class ${name} is missing from ${SCHEMAS}`).toBeGreaterThan(-1);
  const end = source.indexOf("\nclass ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

/** `field: str … = Field(…, max_length=N)` → `{ field: N }`. */
function declaredCaps(className: string): Record<string, number> {
  const caps: Record<string, number> = {};
  const body = classBody(className);
  for (const match of body.matchAll(
    /^\s{4}(\w+): str[^=\n]*= Field\([^)\n]*max_length=(\d+)/gm,
  )) {
    caps[match[1]] = Number(match[2]);
  }
  return caps;
}

/** Every `str`-typed field on the class, capped or not. */
function strFields(className: string): string[] {
  return [...classBody(className).matchAll(/^\s{4}(\w+): str/gm)].map((m) => m[1]);
}

const createCaps = declaredCaps("CollegeSubmissionCreate");
const updateCaps = declaredCaps("CollegeSubmissionUpdate");

describe("the submission length contract is not silently empty", () => {
  it("found the declared caps in both request schemas", () => {
    expect(Object.keys(createCaps).length).toBeGreaterThan(5);
    expect(Object.keys(updateCaps).length).toBeGreaterThan(5);
    expect(createCaps.proposed_name).toBe(255);
  });
});

describe("every submission cap the form declares exists on the server", () => {
  for (const [field, width] of Object.entries(SUBMISSION_FIELD_MAX)) {
    it(`${field} is capped at ${width} in CollegeSubmissionCreate`, () => {
      expect(createCaps[field]).toBe(width);
    });
    it(`${field} is capped at ${width} in CollegeSubmissionUpdate`, () => {
      expect(updateCaps[field]).toBe(width);
    });
  }

  it("caps the name identically on both verbs", () => {
    expect(SUBMISSION_NAME_MAX).toBe(255);
    expect(createCaps.proposed_name).toBe(SUBMISSION_NAME_MAX);
    expect(updateCaps.proposed_name).toBe(SUBMISSION_NAME_MAX);
  });
});

describe("no capped submission field is left off the map", () => {
  it("has only the unbounded Text fields uncapped on either schema", () => {
    const noCapNeeded = new Set(["proposed_address", "proposed_overview", "submitter_notes"]);
    const uncapped = (className: string) =>
      strFields(className).filter(
        (field) => !(field in SUBMISSION_FIELD_MAX) && !noCapNeeded.has(field),
      );
    expect(uncapped("CollegeSubmissionCreate")).toEqual(["proposed_name"]);
    expect(uncapped("CollegeSubmissionUpdate")).toEqual(["proposed_name"]);
  });
});
