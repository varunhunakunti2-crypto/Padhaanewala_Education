import {
  optionalDate,
  optionalText,
  requiredText,
  type FormResult,
} from "@/lib/form-parts";

/**
 * The exam admin form.
 *
 * ## `syllabus` and `faqs` are not in this form
 *
 * `ExamCreate` declares them as `syllabus: dict | None` and `faqs: list | None` —
 * JSON columns, not text. A textarea bound to them would post a *string* and get
 * a 422 on a field the admin was not looking at, which reads as a backend fault.
 * Editing them properly needs a structured editor, so this form does not pretend
 * to offer one: an edit leaves both columns exactly as the server holds them,
 * because the payload omits them and `model_dump(exclude_unset=True)` only
 * applies what is present.
 *
 * The read side is honest about it too — the list row shows whether a syllabus
 * exists, so a record that has one is visibly not being cleared by this form.
 *
 * ## `is_active` is omitted, for the course reasons
 *
 * `list_exams` and `get_exam` both filter `where(Exam.is_active)`, while
 * `_find_exam` — which backs `PUT` and `DELETE` — does not. So deactivating a row
 * makes it vanish from the table and unopenable for editing, while still being
 * deletable by id. Offering the toggle would be a one-way door with a hidden back
 * door, which is worse than not offering it.
 *
 * ## Dates are validated component-wise
 *
 * Five `date` columns here, all `YYYY-MM-DD` on the wire. `new Date("2026-02-31")`
 * does not fail — it rolls to 2 March — so a date input plus a text paste is the
 * only way to get one of these wrong, and it would store the wrong day silently.
 * See `optionalDate` in `lib/form-parts.ts`.
 */
export interface ExamFormValues {
  name: string;
  conducting_authority: string;
  exam_type: string;
  eligibility: string;
  application_start_date: string;
  application_deadline: string;
  exam_date: string;
  admit_card_date: string;
  result_date: string;
  official_website: string;
  official_notification: string;
}

export const EMPTY_EXAM_FORM: ExamFormValues = {
  name: "",
  conducting_authority: "",
  // `ExamCreate.exam_type` defaults to "national". Prefilled rather than left
  // blank so a create that is not about exam type does not store "".
  exam_type: "national",
  eligibility: "",
  application_start_date: "",
  application_deadline: "",
  exam_date: "",
  admit_card_date: "",
  result_date: "",
  official_website: "",
  official_notification: "",
};

/** `Field(default="national", max_length=50)` on `ExamCreate`. */
export const EXAM_TYPE_DEFAULT = "national";
export const EXAM_TYPE_MAX = 50;

/** The subset of `ExamResponse` this form reads. */
export interface ExamDetail {
  id: number;
  name: string;
  conducting_authority: string | null;
  exam_type: string | null;
  eligibility: string | null;
  application_start_date: string | null;
  application_deadline: string | null;
  exam_date: string | null;
  admit_card_date: string | null;
  result_date: string | null;
  official_website: string | null;
  official_notification: string | null;
}

export function examFormFromDetail(detail: ExamDetail): ExamFormValues {
  return {
    name: detail.name,
    conducting_authority: detail.conducting_authority ?? "",
    exam_type: detail.exam_type ?? EXAM_TYPE_DEFAULT,
    eligibility: detail.eligibility ?? "",
    application_start_date: dateOrBlank(detail.application_start_date),
    application_deadline: dateOrBlank(detail.application_deadline),
    exam_date: dateOrBlank(detail.exam_date),
    admit_card_date: dateOrBlank(detail.admit_card_date),
    result_date: dateOrBlank(detail.result_date),
    official_website: detail.official_website ?? "",
    official_notification: detail.official_notification ?? "",
  };
}

export type ExamPayload = Record<string, unknown>;

export function buildExamPayload(
  values: ExamFormValues,
  mode: "create" | "update",
): FormResult<ExamPayload> {
  void mode;

  // `ExamUpdate` declares `conducting_authority` as optional where `ExamCreate`
  // requires it. The two modes still share a builder, so the requirement is
  // enforced on both — an update that blanked it would store an empty string
  // against a column the create schema insists on, and nothing downstream would
  // notice.
  const name = requiredText(values.name, "The exam name", { min: 2, max: 255 });
  if (!name.ok) return name;

  const authority = requiredText(values.conducting_authority, "The conducting authority", {
    min: 2,
    max: 255,
  });
  if (!authority.ok) return authority;

  const examType = optionalText(values.exam_type, "Exam type", EXAM_TYPE_MAX);
  if (!examType.ok) return examType;

  const eligibility = optionalText(values.eligibility, "Eligibility");
  if (!eligibility.ok) return eligibility;

  const start = optionalDate(values.application_start_date, "The application start date");
  if (!start.ok) return start;

  const deadline = optionalDate(values.application_deadline, "The application deadline");
  if (!deadline.ok) return deadline;

  const examDate = optionalDate(values.exam_date, "The exam date");
  if (!examDate.ok) return examDate;

  const admitCard = optionalDate(values.admit_card_date, "The admit card date");
  if (!admitCard.ok) return admitCard;

  const result = optionalDate(values.result_date, "The result date");
  if (!result.ok) return result;

  const website = optionalText(values.official_website, "The official website");
  if (!website.ok) return website;

  const notification = optionalText(values.official_notification, "The official notification");
  if (!notification.ok) return notification;

  // An exam whose applications close after the exam itself is a data-entry slip
  // the admin cannot see, because both columns are independent in the schema and
  // nothing on the page puts them side by side. Caught here so the form can say
  // so, rather than discovered after applications have closed.
  if (
    examDate.value !== null &&
    deadline.value !== null &&
    deadline.value > examDate.value
  ) {
    return {
      ok: false,
      error: "The application deadline cannot be after the exam date.",
    };
  }

  return {
    ok: true,
    value: {
      name: name.value,
      conducting_authority: authority.value,
      // Falls back to the declared default rather than to null: an exam type of
      // null is not something any list or filter in the admin UI expects.
      exam_type: examType.value ?? EXAM_TYPE_DEFAULT,
      eligibility: eligibility.value,
      application_start_date: start.value,
      application_deadline: deadline.value,
      exam_date: examDate.value,
      admit_card_date: admitCard.value,
      result_date: result.value,
      official_website: website.value,
      official_notification: notification.value,
      // `syllabus`, `faqs` and `is_active` omitted on purpose — see the file note.
    },
  };
}

/** Re-exported for the tests that assert the date handling directly. */
function dateOrBlank(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}
