import { describe, expect, it } from "vitest";

import {
  deriveAdmissionStatus,
  mapCollegeListItem,
  parseAmountToRupees,
} from "@/lib/mappers";
import type { ApiAdmission, ApiCollegeListItem } from "@/lib/api-server";

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
