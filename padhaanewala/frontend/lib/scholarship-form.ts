import {
  dateOnly,
  optionalDate,
  optionalInt,
  optionalText,
  requiredText,
  rowRefFor,
  type FormResult,
} from "@/lib/form-parts";

/**
 * The scholarship admin form.
 *
 * ## `amount` is a string, and that is not a bug to fix here
 *
 * `ScholarshipCreate.amount` is `str | None = Field(max_length=255)`, not a
 * number. A scheme's amount is not a single figure — it is "₹50,000 per year",
 * "up to ₹2,00,000", "50% of tuition fee" — and the column is sized at 255
 * characters for that reason. Parsing it into a number to "validate" it would
 * reject most real values and then write a rounded integer over the text.
 *
 * So it is sent as the trimmed string it is. The one thing checked is length,
 * because the column is `String(255)` and an over-long value is stored as sent
 * on SQLite and errors on MySQL.
 *
 * ## `state_id` is a real foreign key, so it gets a real list
 *
 * Unlike the `entity_id` soft reference in `media` and `faq`, this one *is* a
 * foreign key to `state`, and `ScholarshipResponse` even returns the resolved
 * `state_name`. It is populated from `GET /locations/states` rather than typed,
 * and the id is validated as a positive integer so an empty box stays `null`
 * instead of becoming `0`.
 *
 * ## `ownership` and `verification_status` are datalist inputs, not selects
 *
 * Both are `String(20)` columns with a default and no enum anywhere in the
 * schema, and the seeded data may already hold values this build has never seen.
 * A `<select>` of values I invented would silently refuse to open a record
 * carrying anything else — the admin would see a blank field on a row that has
 * one. So these are text inputs with a `<datalist>` of suggestions: typos are
 * prevented, and every value that exists on the server still round-trips.
 *
 * ## `is_active` and `documents_required` are omitted
 *
 * `list_scholarships` and `get_scholarship` filter `where(Scholarship.is_active)`,
 * so a toggle-off row leaves the table and cannot be reopened. And
 * `documents_required` is a `list` column — a textarea would post a string and
 * 422. Both omissions leave the columns as the server holds them, because `PUT`
 * applies `model_dump(exclude_unset=True)`.
 */
export interface ScholarshipFormValues {
  name: string;
  provider: string;
  ownership: string;
  verification_status: string;
  eligibility: string;
  state_id: string;
  course: string;
  category: string;
  income_criteria: string;
  amount: string;
  application_deadline: string;
  application_procedure: string;
  official_website: string;
  last_verified_date: string;
  next_verification_date: string;
}

/** `ScholarshipCreate` defaults, prefilled so a create does not store "". */
export const SCHOLARSHIP_OWNERSHIP_DEFAULT = "government";
export const SCHOLARSHIP_VERIFICATION_DEFAULT = "unverified";

export const EMPTY_SCHOLARSHIP_FORM: ScholarshipFormValues = {
  name: "",
  provider: "",
  ownership: SCHOLARSHIP_OWNERSHIP_DEFAULT,
  verification_status: SCHOLARSHIP_VERIFICATION_DEFAULT,
  eligibility: "",
  state_id: "",
  course: "",
  category: "",
  income_criteria: "",
  amount: "",
  application_deadline: "",
  application_procedure: "",
  official_website: "",
  last_verified_date: "",
  next_verification_date: "",
};

/** Suggestions only. The column has no enum; see the file note. */
export const SCHOLARSHIP_OWNERSHIPS = ["government", "private", "trust", "institutional"] as const;
export const SCHOLARSHIP_VERIFICATION_STATUSES = [
  "unverified",
  "verified",
  "expired",
  "rejected",
] as const;

/** The subset of `ScholarshipResponse` this form reads. */
export interface ScholarshipDetail {
  id: number;
  name: string;
  provider: string | null;
  ownership: string | null;
  verification_status: string | null;
  eligibility: string | null;
  state_id: number | null;
  course: string | null;
  category: string | null;
  income_criteria: string | null;
  amount: string | null;
  application_deadline: string | null;
  application_procedure: string | null;
  official_website: string | null;
  last_verified_date: string | null;
  next_verification_date: string | null;
}

export function scholarshipFormFromDetail(detail: ScholarshipDetail): ScholarshipFormValues {
  return {
    name: detail.name,
    provider: detail.provider ?? "",
    ownership: detail.ownership ?? SCHOLARSHIP_OWNERSHIP_DEFAULT,
    verification_status: detail.verification_status ?? SCHOLARSHIP_VERIFICATION_DEFAULT,
    eligibility: detail.eligibility ?? "",
    state_id: detail.state_id === null ? "" : String(detail.state_id),
    course: detail.course ?? "",
    category: detail.category ?? "",
    income_criteria: detail.income_criteria ?? "",
    amount: detail.amount ?? "",
    application_deadline: dateOnly(detail.application_deadline),
    application_procedure: detail.application_procedure ?? "",
    official_website: detail.official_website ?? "",
    last_verified_date: dateOnly(detail.last_verified_date),
    next_verification_date: dateOnly(detail.next_verification_date),
  };
}

export function scholarshipRefFor(row: { id: number }): string {
  return rowRefFor(row);
}

export type ScholarshipPayload = Record<string, unknown>;

export function buildScholarshipPayload(
  values: ScholarshipFormValues,
  mode: "create" | "update",
): FormResult<ScholarshipPayload> {
  void mode;

  const name = requiredText(values.name, "The scholarship name", { min: 2, max: 255 });
  if (!name.ok) return name;

  const provider = requiredText(values.provider, "The provider", { min: 2, max: 255 });
  if (!provider.ok) return provider;

  const ownership = optionalText(values.ownership, "Ownership", 20);
  if (!ownership.ok) return ownership;

  const verification = optionalText(values.verification_status, "Verification status", 20);
  if (!verification.ok) return verification;

  const eligibility = optionalText(values.eligibility, "Eligibility");
  if (!eligibility.ok) return eligibility;

  // A real foreign key. `min: 1` so a zero cannot be stored against `state_id`.
  const stateId = optionalInt(values.state_id, "State", { min: 1 });
  if (!stateId.ok) return stateId;

  const course = optionalText(values.course, "Course", 255);
  if (!course.ok) return course;

  const category = optionalText(values.category, "Category", 100);
  if (!category.ok) return category;

  const income = optionalText(values.income_criteria, "Income criteria", 255);
  if (!income.ok) return income;

  // Text, not a number. See the file note.
  const amount = optionalText(values.amount, "Amount", 255);
  if (!amount.ok) return amount;

  const deadline = optionalDate(values.application_deadline, "The application deadline");
  if (!deadline.ok) return deadline;

  const procedure = optionalText(values.application_procedure, "The application procedure");
  if (!procedure.ok) return procedure;

  const website = optionalText(values.official_website, "The official website");
  if (!website.ok) return website;

  const lastVerified = optionalDate(values.last_verified_date, "The last verified date");
  if (!lastVerified.ok) return lastVerified;

  const nextVerification = optionalDate(values.next_verification_date, "The next verification date");
  if (!nextVerification.ok) return nextVerification;

  // A scheme verified *after* it is due to be re-verified is either a typo or a
  // scheme that was never checked. Either way it is worth a sentence, and the
  // two columns are far apart on the form.
  if (
    lastVerified.value !== null &&
    nextVerification.value !== null &&
    nextVerification.value <= lastVerified.value
  ) {
    return {
      ok: false,
      error: "The next verification date must be after the last verified date.",
    };
  }

  return {
    ok: true,
    value: {
      name: name.value,
      provider: provider.value,
      ownership: ownership.value ?? SCHOLARSHIP_OWNERSHIP_DEFAULT,
      verification_status: verification.value ?? SCHOLARSHIP_VERIFICATION_DEFAULT,
      eligibility: eligibility.value,
      state_id: stateId.value,
      course: course.value,
      category: category.value,
      income_criteria: income.value,
      amount: amount.value,
      application_deadline: deadline.value,
      application_procedure: procedure.value,
      official_website: website.value,
      last_verified_date: lastVerified.value,
      next_verification_date: nextVerification.value,
      // `documents_required` and `is_active` omitted on purpose — see the file note.
    },
  };
}
