import { ApiError } from "@/lib/api";
import type { ApiCollegeDetail, ApiCollegeListItem } from "@/lib/api-server";

/**
 * The college admin form, expressed as pure data.
 *
 * ## Why this is not inside the component
 *
 * Three of the decisions in a college form are load-bearing and none of them is
 * a rendering concern:
 *
 *  - **Which fields each request may carry.** `CollegeCreate` and
 *    `CollegeUpdate` are *not* the same schema. `is_featured` is update-only;
 *    `courses` is create-only. Pydantic ignores unknown keys, so sending a field
 *    the endpoint does not declare fails silently — the admin clicks Save, sees
 *    "success", and the change is gone. That is exactly the shape of BUG-01 and
 *    BUG-05: a success signal with nothing behind it. It is not hypothetical:
 *    `accreditation_nba` was missing from `CollegeUpdate` while the form
 *    offered the control, so the PUT returned 200 and the value never changed
 *    until the probe replayed the real body against the real route.
 *  - **What a blank means.** `PUT /colleges/{ref}` uses
 *    `model_dump(exclude_unset=True)`, so an explicit `null` *clears* a column
 *    while an absent key leaves it alone. `""` is not the same as `null` either:
 *    `postal_code: ""` stores an empty string, not a missing value. A form that
 *    sends `""` for every untouched field will quietly blank a database.
 *  - **What an invalid number means.** `JSON.stringify({ y: NaN })` produces
 *    `{"y":null}`. A typo in "established year" therefore does not produce a
 *    422 — it produces a *successful* write that clears the column.
 *
 * All three are decided here, where they can be tested without a DOM, and
 * consumed by the component. The component decides only how to render them.
 */

/** A nullable boolean, kept as its own value rather than collapsed to false. */
export type TriState = "yes" | "no" | "unknown";

/** One row of the create form's course repeater, all values as typed. */
export interface CollegeCourseRow {
  course_id: string;
  annual_fee: string;
  total_fee: string;
  intake_seats: string;
  admission_mode: string;
  entrance_exam: string;
}

export interface CollegeFormValues {
  name: string;
  official_name: string;
  college_type: string;
  ownership: string;
  university_id: string;
  state_id: string;
  district_id: string;
  city: string;
  address: string;
  pincode: string;
  lat: string;
  lng: string;
  website: string;
  email: string;
  phone: string;
  established_year: string;
  accreditation_naac: string;
  accreditation_nba: TriState;
  overview: string;
  has_hostel: TriState;
  /**
   * Update-only. Absent from `CollegeCreate`, and the column defaults to false,
   * so a boolean is correct here rather than a tri-state.
   */
  is_featured: boolean;
  /** Create-only. `CollegeUpdate` has no `courses` field at all. */
  courses: CollegeCourseRow[];
}

export const EMPTY_COLLEGE_COURSE: CollegeCourseRow = {
  course_id: "",
  annual_fee: "",
  total_fee: "",
  intake_seats: "",
  admission_mode: "",
  entrance_exam: "",
};

export const EMPTY_COLLEGE_FORM: CollegeFormValues = {
  name: "",
  official_name: "",
  college_type: "",
  ownership: "",
  university_id: "",
  state_id: "",
  district_id: "",
  city: "",
  address: "",
  pincode: "",
  lat: "",
  lng: "",
  website: "",
  email: "",
  phone: "",
  established_year: "",
  accreditation_naac: "",
  accreditation_nba: "unknown",
  overview: "",
  has_hostel: "unknown",
  is_featured: false,
  courses: [],
};

function tri(value: boolean | null | undefined): TriState {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Prefill the edit form from the record the server actually holds. */
export function collegeFormFromDetail(detail: ApiCollegeDetail): CollegeFormValues {
  return {
    name: detail.name,
    official_name: asString(detail.official_name),
    college_type: asString(detail.college_type),
    ownership: asString(detail.ownership),
    university_id: asString(detail.university_id),
    state_id: asString(detail.state_id),
    district_id: asString(detail.district_id),
    city: asString(detail.city),
    address: asString(detail.address),
    pincode: asString(detail.pincode),
    lat: asString(detail.lat),
    lng: asString(detail.lng),
    website: asString(detail.website),
    email: asString(detail.email),
    phone: asString(detail.phone),
    established_year: asString(detail.established_year),
    accreditation_naac: asString(detail.accreditation_naac),
    accreditation_nba: tri(detail.accreditation_nba),
    overview: asString(detail.overview),
    has_hostel: tri(detail.has_hostel),
    is_featured: detail.is_featured,
    // Editing courses goes through `PUT /colleges/{ref}/courses` and
    // `CollegeUpdate` has no `courses` key, so an edit deliberately does not
    // offer the repeater. Prepopulating it would invite a save that cannot
    // possibly apply.
    courses: [],
  };
}

/**
 * The key `PUT` and `DELETE` expect.
 *
 * `colleges.py` resolves `college_ref` as `int(ref)` when the path segment is
 * all digits and as a slug otherwise. The primary key is therefore the only
 * unambiguous choice. The tempting one is `college_id` — the `COLLEGE000042`
 * string shown in the table — and it is **not** a valid key: it is not numeric,
 * so it falls through to a slug lookup that can never match.
 */
export function collegeRefFor(row: Pick<ApiCollegeListItem, "id" | "slug">): string {
  return String(row.id);
}

/* ------------------------------------------------------------------ *
 * Payload construction
 * ------------------------------------------------------------------ */

export type CollegeWritePayload = Record<string, unknown>;

export type PayloadResult =
  | { ok: true; payload: CollegeWritePayload }
  | { ok: false; error: string };

function fail(error: string): PayloadResult {
  return { ok: false, error };
}

/** Trim, and treat an empty box as "not provided" rather than as `""`. */
function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalInt(
  value: string,
  label: string,
  opts: { min?: number; max?: number } = {},
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }
  const parsed = Number(trimmed);
  if (opts.min !== undefined && parsed < opts.min) {
    return { ok: false, error: `${label} cannot be earlier than ${opts.min}.` };
  }
  if (opts.max !== undefined && parsed > opts.max) {
    return { ok: false, error: `${label} cannot be later than ${opts.max}.` };
  }
  return { ok: true, value: parsed };
}
function optionalDecimal(
  value: string,
  label: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    // The important branch. Without it this becomes `null` in the JSON body and
    // the write succeeds with the column cleared.
    return { ok: false, error: `${label} must be a number.` };
  }
  return { ok: true, value: trimmed };
}

function triValue(value: TriState): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

/** `name` is the one required field, and the backend caps it at 255. */
export const COLLEGE_NAME_MIN = 2;
export const COLLEGE_NAME_MAX = 255;

function validateName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "A college needs a name." };
  if (trimmed.length < COLLEGE_NAME_MIN) {
    return { ok: false, error: `The name needs at least ${COLLEGE_NAME_MIN} characters.` };
  }
  if (trimmed.length > COLLEGE_NAME_MAX) {
    return { ok: false, error: `The name cannot be longer than ${COLLEGE_NAME_MAX} characters.` };
  }
  return { ok: true, value: trimmed };
}

function buildCoursePayload(
  rows: CollegeCourseRow[],
): { ok: true; value: unknown[] } | { ok: false; error: string } {
  const out: unknown[] = [];
  const seen = new Set<number>();

  for (const [index, row] of rows.entries()) {
    const n = index + 1;
    if (row.course_id.trim() === "") continue;

    const id = optionalInt(row.course_id, `Course ${n}: course`);
    if (!id.ok) return { ok: false, error: id.error };
    if (id.value === null) continue;

    if (seen.has(id.value)) {
      return { ok: false, error: `Course ${n} is listed more than once.` };
    }
    seen.add(id.value);

    const seats = optionalInt(row.intake_seats, `Course ${n}: intake seats`, { min: 0 });
    if (!seats.ok) return { ok: false, error: seats.error };

    const annual = optionalDecimal(row.annual_fee, `Course ${n}: annual fee`);
    if (!annual.ok) return { ok: false, error: annual.error };

    const total = optionalDecimal(row.total_fee, `Course ${n}: total fee`);
    if (!total.ok) return { ok: false, error: total.error };

    out.push({
      course_id: id.value,
      annual_fee: annual.value,
      total_fee: total.value,
      intake_seats: seats.value,
      admission_mode: text(row.admission_mode),
      entrance_exam: text(row.entrance_exam),
    });
  }

  return { ok: true, value: out };
}

/**
 * Build the request body for `POST /colleges` or `PUT /colleges/{ref}`.
 *
 * `mode` decides which schema's field set applies, and the two do not overlap
 * cleanly — see the note at the top of this file.
 */
export function buildCollegePayload(
  values: CollegeFormValues,
  mode: "create" | "update",
): PayloadResult {
  const name = validateName(values.name);
  if (!name.ok) return fail(name.error);

  const university = optionalInt(values.university_id, "University");
  if (!university.ok) return fail(university.error);

  const state = optionalInt(values.state_id, "State");
  if (!state.ok) return fail(state.error);

  const district = optionalInt(values.district_id, "District");
  if (!district.ok) return fail(district.error);

  // Bounded rather than free text: the backend stores a bare `Integer` with no
  // constraint, so "3024" and "99" would both be accepted and both be wrong. The
  // upper bound is read at call time rather than hardcoded, so this file needs
  // no edit when the year passes.
  const year = optionalInt(values.established_year, "Established year", {
    min: 1000,
    max: new Date().getFullYear(),
  });
  if (!year.ok) return fail(year.error);

  const lat = optionalDecimal(values.lat, "Latitude");
  if (!lat.ok) return fail(lat.error);

  const lng = optionalDecimal(values.lng, "Longitude");
  if (!lng.ok) return fail(lng.error);

  // Keys shared by both schemas.
  const shared: CollegeWritePayload = {
    name: name.value,
    official_name: text(values.official_name),
    college_type: text(values.college_type),
    ownership: text(values.ownership),
    university_id: university.value,
    state_id: state.value,
    district_id: district.value,
    city: text(values.city),
    address: text(values.address),
    pincode: text(values.pincode),
    lat: lat.value,
    lng: lng.value,
    website: text(values.website),
    email: text(values.email),
    phone: text(values.phone),
    established_year: year.value,
    accreditation_naac: text(values.accreditation_naac),
    accreditation_nba: triValue(values.accreditation_nba),
    overview: text(values.overview),
    has_hostel: triValue(values.has_hostel),
  };

  if (mode === "create") {
    const courses = buildCoursePayload(values.courses);
    if (!courses.ok) return fail(courses.error);
    return { ok: true, payload: { ...shared, courses: courses.value } };
  }

  // Update-only. Deliberately absent: `is_active`, because `GET /colleges`
  // filters it out — deactivating a college from this screen would remove the
  // row and leave no way to bring it back without the API. Also absent:
  // `facilities`, a free-form JSON column this form does not model, and
  // `courses`, which `CollegeUpdate` does not accept.
  return {
    ok: true,
    payload: {
      ...shared,
      is_featured: values.is_featured,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Error presentation
 * ------------------------------------------------------------------ */

/**
 * Turn a failed write into something an admin can act on.
 *
 * The duplicate-name case is singled out because it is the one a user can cause
 * deliberately and fix by editing, and because the backend signals it as a
 * **400**, not the 409 a conflict conventionally gets — so a client that only
 * special-cases 409 will report it as an unexplained failure.
 */
export function describeCollegeError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "The request could not be sent. Check your connection.";
  }
  if (err.status === 403) {
    return "You do not have permission to do that. A higher role is required.";
  }
  if (err.status === 404) {
    return "That college no longer exists. Reload the list and try again.";
  }
  if (err.status === 400 && /exists/i.test(String(err.message))) {
    return "A college with that name already exists.";
  }
  if (err.status === 422) {
    // apiFetch has already joined the FastAPI validation messages.
    return err.message || "The server rejected these values.";
  }
  if (err.status === 0) {
    return "Could not reach the API.";
  }
  return err.message || "The server rejected the request.";
}
