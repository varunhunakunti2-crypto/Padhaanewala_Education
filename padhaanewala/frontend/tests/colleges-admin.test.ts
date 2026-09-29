import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import {
  COLLEGE_NAME_MAX,
  COLLEGE_NAME_MIN,
  EMPTY_COLLEGE_FORM,
  buildCollegePayload,
  collegeFormFromDetail,
  collegeRefFor,
  describeCollegeError,
  type CollegeFormValues,
} from "@/lib/college-form";
import type { ApiCollegeDetail, ApiCollegeListItem } from "@/lib/api-server";

/**
 * The college admin form's decisions, tested without a DOM.
 *
 * The read-only college table shipped for months with three defects that no
 * build, lint or type check could see, and two of them are exactly what these
 * assertions are about:
 *
 *  - It requested `?limit=1000` against an endpoint that caps `limit` at 100.
 *    The 422 looked like a dead backend, so the panel showed a connection error
 *    on every load and nobody read it as a query bug. (The page-size contract
 *    test now holds that number; see `page-size-contract.test.ts`.)
 *  - Every row's Edit and Delete buttons were `showToast` calls. An affordance
 *    that claims an action and performs none is a success signal with nothing
 *    behind it — the same shape as BUG-01 and BUG-05.
 *
 * The three behaviours below are the ones that will bite silently rather than
 * loudly, which is why they are worth pinning:
 *
 *  1. `POST` and `PUT` accept different schemas. Pydantic ignores unknown keys,
 *     so sending a field the endpoint does not declare is a **successful
 *     response and a discarded change**.
 *  2. `PUT` uses `model_dump(exclude_unset=True)`, so an explicit `null` clears a
 *     column and an absent key does not. A form that sends `""` for every
 *     untouched field stores empty strings, and one that sends `null` wipes
 *     them.
 *  3. `JSON.stringify({ y: NaN })` is `{"y":null}`. A typo in a numeric field
 *     therefore writes a *successful* null instead of producing a 422.
 */

function detail(overrides: Partial<ApiCollegeDetail> = {}): ApiCollegeDetail {
  return {
    id: 7,
    college_id: "COLLEGE000007",
    name: "Anna University",
    slug: "anna-university",
    college_type: "University",
    ownership: "Public",
    city: "Chennai",
    state: "Tamil Nadu",
    university_name: null,
    has_hostel: true,
    total_reviews: 0,
    average_rating: "0.00",
    is_featured: true,
    official_name: "Anna University",
    address: "SASTRA Tower, Thanjavur",
    pincode: "613005",
    lat: "10.7867000",
    lng: "79.1372000",
    website: "https://annauniv.edu",
    email: "registrar@annauniv.edu",
    phone: "044-27453000",
    established_year: 1978,
    accreditation_naac: "A+",
    accreditation_nba: false,
    overview: "A public technical university.",
    facilities: { library: true },
    state_id: 32,
    district_id: 604,
    university_id: null,
    courses: [],
    ...overrides,
  };
}

function values(overrides: Partial<CollegeFormValues> = {}): CollegeFormValues {
  return { ...EMPTY_COLLEGE_FORM, name: "Regional Engineering College", ...overrides };
}

function build(v: CollegeFormValues, mode: "create" | "update") {
  const result = buildCollegePayload(v, mode);
  if (!result.ok) throw new Error(`expected a payload, got: ${result.error}`);
  return result.payload;
}

describe("college name validation", () => {
  it("rejects an empty name, which is the one required field", () => {
    for (const name of ["", "   ", "\t\n"]) {
      const result = buildCollegePayload(values({ name }), "create");
      expect(result.ok, `expected ${JSON.stringify(name)} to be rejected`).toBe(false);
    }
  });

  it("rejects a name below the backend's own minimum rather than letting it 422", () => {
    // `CollegeCreate.name` is `Field(min_length=2)`. Catching it here turns a
    // server round-trip into an instant message.
    const result = buildCollegePayload(values({ name: "A".repeat(COLLEGE_NAME_MIN - 1) }), "create");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 2 characters/i);
  });

  it("rejects a name above the backend's own maximum", () => {
    const result = buildCollegePayload(values({ name: "A".repeat(COLLEGE_NAME_MAX + 1) }), "create");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/longer than 255/i);
  });

  it("trims the name, so surrounding whitespace cannot create a distinct slug", () => {
    // `_slugify` lowercases and collapses to dashes, so " X " and "X" collide on
    // the unique slug column. Trimming client-side keeps the 400 for a genuine
    // duplicate rather than for a typo.
    expect(build(values({ name: "  Anna University  " }), "create").name).toBe("Anna University");
  });
});

describe("blank values are absence, not empty strings", () => {
  it("sends null rather than \"\" for every untouched optional field", () => {
    const payload = build(values(), "create");
    // The distinction matters: `""` is stored, `null` means "not recorded".
    expect(payload.official_name).toBeNull();
    expect(payload.address).toBeNull();
    expect(payload.pincode).toBeNull();
    expect(payload.website).toBeNull();
    expect(payload.overview).toBeNull();
    expect(payload.city).toBeNull();
  });

  it("preserves a value the admin did type", () => {
    expect(build(values({ city: " Kochi " }), "create").city).toBe("Kochi");
  });

  it("keeps a tri-state 'not recorded' as null rather than collapsing it to false", () => {
    // `accreditation_nba` and `has_hostel` are nullable booleans. Sending false
    // for "I did not record this" turns an unknown into a claim.
    const v = values({ has_hostel: "unknown", accreditation_nba: "unknown" });
    expect(build(v, "create").has_hostel).toBeNull();
    expect(build(v, "create").accreditation_nba).toBeNull();
    expect(build(v, "update").accreditation_nba).toBeNull();
  });

  it("maps each tri-state to its real column value", () => {
    expect(build(values({ has_hostel: "yes" }), "create").has_hostel).toBe(true);
    expect(build(values({ has_hostel: "no" }), "create").has_hostel).toBe(false);
  });
});

describe("a numeric typo is rejected, not written as a null", () => {
  // The dangerous case in this whole feature. `JSON.stringify({ x: NaN })`
  // produces `{"x":null}`, the backend accepts it, the response is 200, and the
  // column is cleared. A green tick for a destroyed value.
  it.each([
    ["established_year", "19o59", /whole number/i],
    ["established_year", "1959.5", /whole number/i],
    ["lat", "12.99.3", /must be a number/i],
    ["lng", "east", /must be a number/i],
    ["university_id", "twelve", /whole number/i],
    ["state_id", "-", /whole number/i],
  ] as const)("refuses %s = %s", (field, value, pattern) => {
    const result = buildCollegePayload(values({ [field]: value }), "create");
    expect(result.ok, `${field}=${value} should not produce a payload`).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it("refuses an established year outside a plausible range", () => {
    // Read at call time in the implementation, so these cases do not expire.
    expect(buildCollegePayload(values({ established_year: "99" }), "create").ok).toBe(false);
    expect(buildCollegePayload(values({ established_year: "9999" }), "create").ok).toBe(false);
    expect(buildCollegePayload(values({ established_year: "1959" }), "create").ok).toBe(true);
  });

  it("accepts a decimal latitude, which is the column's real type", () => {
    // `Numeric(10, 7)`. Rejecting a decimal here would be its own bug.
    expect(build(values({ lat: "12.9925000", lng: "80.2345000" }), "create").lat).toBe("12.9925000");
  });

  it("sends null for a blank number rather than NaN", () => {
    const payload = build(values(), "create");
    expect(payload.established_year).toBeNull();
    expect(payload.lat).toBeNull();
    // The literal check: nothing in a built payload may be NaN, because
    // JSON.stringify would turn it into null on the wire.
    expect(JSON.stringify(payload)).not.toContain("null,null,null,null");
  });
});

describe("create and update take different schemas", () => {
  it("sends courses on create, which is the only schema that accepts them", () => {
    const payload = build(
      values({
        courses: [
          { course_id: "3", annual_fee: "125000", total_fee: "", intake_seats: "60", admission_mode: "Entrance", entrance_exam: "" },
        ],
      }),
      "create",
    );
    expect(payload.courses).toEqual([
      {
        course_id: 3,
        annual_fee: "125000",
        total_fee: null,
        intake_seats: 60,
        admission_mode: "Entrance",
        entrance_exam: null,
      },
    ]);
  });

  it("never sends courses on update, because CollegeUpdate has no courses key", () => {
    const payload = build(
      values({
        courses: [{ course_id: "3", annual_fee: "", total_fee: "", intake_seats: "", admission_mode: "", entrance_exam: "" }],
      }),
      "update",
    );
    expect(payload.courses).toBeUndefined();
  });

  it("sends is_featured only on update, and accreditation_nba on both", () => {
    const v = values({ is_featured: true, accreditation_nba: "yes" });
    const created = build(v, "create");
    // `CollegeCreate` declares no featured flag: Pydantic drops it, so the
    // admin would see "created" and find nothing featured.
    expect(created.is_featured).toBeUndefined();
    // `accreditation_nba` was added to both schemas on 2026-09-29. It was
    // missing from `CollegeUpdate` while this form offered the control, so the
    // PUT answered 200 and the value never changed.
    expect(created.accreditation_nba).toBe(true);

    const updated = build(v, "update");
    expect(updated.is_featured).toBe(true);
    expect(updated.accreditation_nba).toBe(true);
  });

  it("never sends is_active, which would hide the row it just edited", () => {
    // `GET /colleges` filters `is_active`, and there is no `include_inactive`
    // on this route. Deactivating from this screen would remove the college
    // from the list with no way to bring it back from the admin panel.
    for (const mode of ["create", "update"] as const) {
      expect(build(values(), mode).is_active).toBeUndefined();
    }
  });

  it("never sends fields the form does not model", () => {
    // `facilities` is a free-form JSON column. Sending `null` for it through
    // `exclude_unset` would clear a record's facilities.
    for (const mode of ["create", "update"] as const) {
      const payload = build(values(), mode);
      expect(payload.facilities).toBeUndefined();
      expect(payload.slug).toBeUndefined();
      expect(payload.college_id).toBeUndefined();
      expect(payload.verification_status).toBeUndefined();
    }
  });
});

describe("course rows", () => {
  const row = {
    course_id: "3",
    annual_fee: "",
    total_fee: "",
    intake_seats: "",
    admission_mode: "",
    entrance_exam: "",
  };

  it("skips a row the admin started but never chose a course for", () => {
    expect(build(values({ courses: [{ ...row, course_id: "" }] }), "create").courses).toEqual([]);
  });

  it("refuses the same course twice rather than sending a duplicate pair", () => {
    const result = buildCollegePayload(values({ courses: [row, { ...row }] }), "create");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than once/i);
  });

  it("refuses a negative seat count", () => {
    const result = buildCollegePayload(
      values({ courses: [{ ...row, intake_seats: "-5" }] }),
      "create",
    );
    expect(result.ok).toBe(false);
  });
});

describe("collegeRefFor picks a key the router accepts", () => {
  // `colleges.py` resolves `college_ref` as `int(ref)` when the segment is all
  // digits, and as a slug otherwise. The `COLLEGE000007` code displayed in the
  // table is neither, so it falls through to a slug lookup that cannot match.
  const row: Pick<ApiCollegeListItem, "id" | "slug"> = { id: 7, slug: "anna-university" };

  it("uses the numeric primary key", () => {
    expect(collegeRefFor(row)).toBe("7");
  });

  it("resolves to a segment _find_college will read as an integer", () => {
    // Python's `ref.isdigit()` is the branch the router takes.
    expect(/^\d+$/.test(collegeRefFor(row))).toBe(true);
  });
});

describe("prefill from the server's own record", () => {
  it("round-trips a populated record back into an identical payload", () => {
    const record = detail();
    const payload = build(collegeFormFromDetail(record), "update");
    expect(payload).toMatchObject({
      name: record.name,
      official_name: record.official_name,
      city: record.city,
      pincode: record.pincode,
      lat: record.lat,
      lng: record.lng,
      website: record.website,
      email: record.email,
      phone: record.phone,
      established_year: record.established_year,
      accreditation_naac: record.accreditation_naac,
      accreditation_nba: record.accreditation_nba,
      has_hostel: record.has_hostel,
      is_featured: record.is_featured,
      state_id: record.state_id,
      district_id: record.district_id,
      university_id: record.university_id,
    });
  });

  it("does not invent values for fields the detail response omits", () => {
    const form = collegeFormFromDetail(detail({ has_hostel: null, accreditation_nba: null }));
    expect(form.has_hostel).toBe("unknown");
    expect(form.accreditation_nba).toBe("unknown");
  });

  it("leaves the course repeater empty when editing", () => {
    expect(collegeFormFromDetail(detail()).courses).toEqual([]);
  });
});

describe("error messages an admin can act on", () => {
  it("explains a duplicate name, which the backend reports as a 400 not a 409", () => {
    // A client that special-cases 409 reports this as an unexplained failure.
    const message = describeCollegeError(new ApiError("College with this name exists", 400));
    expect(message).toMatch(/already exists/i);
  });

  it("distinguishes a missing permission from a missing record", () => {
    expect(describeCollegeError(new ApiError("Insufficient permissions", 403))).toMatch(/permission/i);
    expect(describeCollegeError(new ApiError("College not found", 404))).toMatch(/no longer exists/i);
  });

  it("surfaces the server's own validation message", () => {
    const message = describeCollegeError(new ApiError("name: too short", 422));
    expect(message).toBe("name: too short");
  });

  it("does not blame the user for a transport failure", () => {
    const message = describeCollegeError(new ApiError("Request failed (0)", 0));
    expect(message).toMatch(/could not reach the api/i);
  });

  it("handles a thrown value that is not an ApiError at all", () => {
    expect(describeCollegeError(new Error("boom"))).toMatch(/could not be sent/i);
    expect(describeCollegeError(undefined)).toMatch(/could not be sent/i);
  });
});
