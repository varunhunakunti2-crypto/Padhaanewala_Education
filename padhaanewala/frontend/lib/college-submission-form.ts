import { ApiError } from "@/lib/api";
import type {
  CollegeSubmission,
  CollegeSubmissionPayload,
  CollegeSubmissionStatus,
} from "@/lib/api";

/**
 * The "suggest a college" form, expressed as pure data.
 *
 * Same reasoning as `lib/college-form.ts`: the load-bearing decisions in this
 * form are not rendering concerns, and they can be tested without a DOM.
 *
 *  - **The payload is built, never spread.** `CollegeSubmissionCreate` sets
 *    `extra="forbid"`, so an unknown key is a **422** rather than a dropped
 *    field. Spreading the form's own state onto the wire would carry any helper
 *    key the component later adds straight into a rejected request.
 *  - **A blank is absence, not `""`.** The submitter's empty optional boxes are
 *    sent as `null`, matching the nullable columns, so a saved row reads
 *    "not recorded" rather than storing empty strings.
 *  - **The two server-side validators are mirrored here.** The schema rejects a
 *    website that is not an absolute http(s) URL and an email without an `@`
 *    and a dot. Catching both at the keyboard turns a round-trip 422 into an
 *    instant, field-level message.
 *
 * Unlike the college form there is **no create/update split**: `Create` and
 * `Update` share exactly the same key set here, so one builder serves both. The
 * edit form is prefilled from the record, so a blank box means the submitter
 * cleared the field — which is why an edit sends the full key set and lets
 * `null` clear a column.
 */

export interface CollegeSubmissionFormValues {
  proposed_name: string;
  proposed_official_name: string;
  proposed_college_type: string;
  proposed_ownership: string;
  proposed_university_name: string;
  /** The FK, as typed. `""` means "no state chosen". */
  proposed_state_id: string;
  /** Free text the submitter typed, kept when no FK matches. */
  proposed_state_name: string;
  proposed_city: string;
  proposed_address: string;
  proposed_website: string;
  proposed_email: string;
  proposed_phone: string;
  proposed_overview: string;
  submitter_notes: string;
}

export const EMPTY_COLLEGE_SUBMISSION_FORM: CollegeSubmissionFormValues = {
  proposed_name: "",
  proposed_official_name: "",
  proposed_college_type: "",
  proposed_ownership: "",
  proposed_university_name: "",
  proposed_state_id: "",
  proposed_state_name: "",
  proposed_city: "",
  proposed_address: "",
  proposed_website: "",
  proposed_email: "",
  proposed_phone: "",
  proposed_overview: "",
  submitter_notes: "",
};

/** `CollegeSubmissionCreate.proposed_name` — `Field(min_length=2, max_length=255)`. */
export const SUBMISSION_NAME_MIN = 2;
export const SUBMISSION_NAME_MAX = 255;

/**
 * Column widths for every free-text field the submitter can type into, mirrored
 * from `app/schemas/submissions.py`.
 *
 * Without a cap on both sides, Pydantic accepts the string and PostgreSQL raises
 * `value too long for type character varying(n)` — a 500 for what is a plain
 * validation failure. `tests/college-submission-form.test.ts` reads the Python
 * and fails if the two ever drift, the same guard the college form carries.
 *
 * Absent on purpose: `proposed_address`, `proposed_overview` and
 * `submitter_notes` are `Text` columns with no width to exceed.
 */
export const SUBMISSION_FIELD_MAX = {
  proposed_official_name: 255,
  proposed_college_type: 50,
  proposed_ownership: 50,
  proposed_university_name: 255,
  proposed_state_name: 100,
  proposed_city: 100,
  proposed_website: 255,
  proposed_email: 255,
  proposed_phone: 20,
} as const;

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Prefill the edit form from the row the server actually holds. */
export function submissionFormFromRecord(
  record: CollegeSubmission,
): CollegeSubmissionFormValues {
  return {
    proposed_name: record.proposed_name,
    proposed_official_name: asString(record.proposed_official_name),
    proposed_college_type: asString(record.proposed_college_type),
    proposed_ownership: asString(record.proposed_ownership),
    proposed_university_name: asString(record.proposed_university_name),
    proposed_state_id: asString(record.proposed_state_id),
    proposed_state_name: asString(record.proposed_state_name),
    proposed_city: asString(record.proposed_city),
    proposed_address: asString(record.proposed_address),
    proposed_website: asString(record.proposed_website),
    proposed_email: asString(record.proposed_email),
    proposed_phone: asString(record.proposed_phone),
    proposed_overview: asString(record.proposed_overview),
    submitter_notes: asString(record.submitter_notes),
  };
}

/* ------------------------------------------------------------------ *
 * Payload construction
 * ------------------------------------------------------------------ */

export type SubmissionPayloadResult =
  | { ok: true; payload: CollegeSubmissionPayload }
  | { ok: false; error: string };

function fail(error: string): SubmissionPayloadResult {
  return { ok: false, error };
}

/** Trim, and treat an empty box as "not provided" rather than as `""`. */
function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A whole-number field, or `null` when the box is empty. */
function optionalInt(
  value: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }
  return { ok: true, value: Number(trimmed) };
}

/** Refuse a value longer than the column, rather than let it 500 on save. */
function capped(
  value: string,
  field: keyof typeof SUBMISSION_FIELD_MAX,
  label: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  const max = SUBMISSION_FIELD_MAX[field];
  if (trimmed.length > max) {
    return { ok: false, error: `${label} cannot be longer than ${max} characters.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * Mirror of `_validate_website_value`: an absolute http(s) URL with a host.
 *
 * A relative or scheme-less value would 404 on the college card, and
 * `javascript:` would be an XSS vector in the anchor `href` it is later
 * rendered into — so both are refused here as well as on the server.
 */
function validateWebsite(
  value: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > SUBMISSION_FIELD_MAX.proposed_website) {
    return {
      ok: false,
      error: `Website cannot be longer than ${SUBMISSION_FIELD_MAX.proposed_website} characters.`,
    };
  }
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) {
    return {
      ok: false,
      error: "Website must start with http:// or https:// and include a host.",
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Mirror of `_validate_email_value`: a light `local@host.tld` shape check, not
 * RFC compliance — the backend carries no `email-validator` dependency either.
 */
function validateEmail(
  value: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > SUBMISSION_FIELD_MAX.proposed_email) {
    return {
      ok: false,
      error: `Email cannot be longer than ${SUBMISSION_FIELD_MAX.proposed_email} characters.`,
    };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Mirror of the server's `_strip_control_chars`: drop C0/C1 control bytes and
 * trim. The server cleans the name this way *before* it measures it, so a name
 * that is only control bytes is empty there; measuring the raw string here would
 * pass a value the server then rejects with a 422 the user cannot place.
 */
function cleanName(raw: string): string {
  let cleaned = "";
  for (const ch of raw) {
    if (ch >= " " && ch !== "\x7f") cleaned += ch;
  }
  return cleaned.trim();
}

/**
 * Mirror of `_validated_name`.
 *
 * Three rules, in the server's order, all evaluated on the *cleaned* value:
 * non-empty, at least `SUBMISSION_NAME_MIN`, and at least one ASCII letter or
 * digit. The last one is the load-bearing one — the server slugifies the name
 * with `re.sub(r"[^a-z0-9]+", "-", …).strip("-")`, so punctuation alone
 * (`"--"`) clears both length checks but slugifies to `""`, and approving it
 * would write an empty `slug` into the unique index. Refusing it here is what
 * turns that 500 into a message at the keyboard.
 */
function validateName(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const cleaned = cleanName(raw);
  if (cleaned === "") return { ok: false, error: "A college needs a name." };
  if (cleaned.length < SUBMISSION_NAME_MIN) {
    return { ok: false, error: `The name needs at least ${SUBMISSION_NAME_MIN} characters.` };
  }
  if (cleaned.length > SUBMISSION_NAME_MAX) {
    return { ok: false, error: `The name cannot be longer than ${SUBMISSION_NAME_MAX} characters.` };
  }
  if (!/[a-z0-9]/.test(cleaned.toLowerCase())) {
    return { ok: false, error: "The name needs at least one letter or number." };
  }
  return { ok: true, value: cleaned };
}

/**
 * Build the request body for `POST /college-submissions` or
 * `PUT /college-submissions/{id}`.
 *
 * Every key the schema declares is always present, so the same object is a
 * valid create body and a valid full edit body. The one value that may not be
 * null is the name. Fields the submitter cannot meaningfully state
 * (`possible_duplicate_college_id`, `reviewer_notes`, the reviewer and status
 * columns) are server-owned and deliberately absent.
 */
export function buildSubmissionPayload(
  values: CollegeSubmissionFormValues,
): SubmissionPayloadResult {
  const name = validateName(values.proposed_name);
  if (!name.ok) return fail(name.error);

  const officialName = capped(
    values.proposed_official_name,
    "proposed_official_name",
    "Official name",
  );
  if (!officialName.ok) return fail(officialName.error);

  const collegeType = capped(
    values.proposed_college_type,
    "proposed_college_type",
    "Institution type",
  );
  if (!collegeType.ok) return fail(collegeType.error);

  const ownership = capped(
    values.proposed_ownership,
    "proposed_ownership",
    "Ownership",
  );
  if (!ownership.ok) return fail(ownership.error);

  const university = capped(
    values.proposed_university_name,
    "proposed_university_name",
    "University",
  );
  if (!university.ok) return fail(university.error);

  const stateName = capped(
    values.proposed_state_name,
    "proposed_state_name",
    "State",
  );
  if (!stateName.ok) return fail(stateName.error);

  const city = capped(values.proposed_city, "proposed_city", "City");
  if (!city.ok) return fail(city.error);

  const phone = capped(values.proposed_phone, "proposed_phone", "Phone");
  if (!phone.ok) return fail(phone.error);

  const website = validateWebsite(values.proposed_website);
  if (!website.ok) return fail(website.error);

  const email = validateEmail(values.proposed_email);
  if (!email.ok) return fail(email.error);

  const stateId = optionalInt(values.proposed_state_id, "State");
  if (!stateId.ok) return fail(stateId.error);

  return {
    ok: true,
    payload: {
      proposed_name: name.value,
      proposed_official_name: officialName.value,
      proposed_college_type: collegeType.value,
      proposed_ownership: ownership.value,
      proposed_university_name: university.value,
      proposed_state_id: stateId.value,
      proposed_state_name: stateName.value,
      proposed_city: city.value,
      proposed_address: text(values.proposed_address),
      proposed_website: website.value,
      proposed_email: email.value,
      proposed_phone: phone.value,
      proposed_overview: text(values.proposed_overview),
      submitter_notes: text(values.submitter_notes),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Status presentation
 *
 * Shared by the admin queue and the submitter's own list, so a status is
 * labelled and coloured the same way wherever it is shown.
 * ------------------------------------------------------------------ */

/** Queue order: the two actionable states first, the terminal ones after. */
export const SUBMISSION_STATUSES = [
  "pending",
  "changes_requested",
  "approved",
  "rejected",
] as const satisfies readonly CollegeSubmissionStatus[];

export const SUBMISSION_STATUS_LABEL: Record<CollegeSubmissionStatus, string> = {
  pending: "Pending",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

/** Matches `Badge`'s own variant union so the call site needs no cast. */
export const SUBMISSION_STATUS_TONE: Record<
  CollegeSubmissionStatus,
  "yellow" | "amber" | "green" | "red"
> = {
  pending: "yellow",
  changes_requested: "amber",
  approved: "green",
  rejected: "red",
};

/** True for the two states an owner may still edit or withdraw. */
export function isRevisable(status: CollegeSubmissionStatus): boolean {
  return status === "pending" || status === "changes_requested";
}

/* ------------------------------------------------------------------ *
 * Error presentation
 * ------------------------------------------------------------------ */

/**
 * Turn a failed submission write into something the caller can act on.
 *
 * The **409** is singled out because it is the one status the submitter can
 * cause deliberately: the proposed name already matches a live college. On an
 * edit or a withdraw the same code means "this row has been reviewed and is now
 * frozen", so its own server message is passed through rather than overwritten.
 */
export function describeSubmissionError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "The request could not be sent. Check your connection.";
  }
  if (err.status === 403) {
    return "You do not have permission to do that. A higher role is required.";
  }
  if (err.status === 404) {
    return "That submission no longer exists. Reload and try again.";
  }
  if (err.status === 409) {
    if (/exist/i.test(String(err.message))) {
      return "A college with this name already exists — check the catalogue before suggesting it.";
    }
    return err.message || "That submission has already been reviewed.";
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
