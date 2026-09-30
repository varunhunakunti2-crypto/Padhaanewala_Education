import {
  type AdminQuestionListItem,
  type AdminQuestionPaper,
  type QuestionPayload,
  type QuestionType,
  type QuestionUpdatePayload,
} from "@/lib/api";

/**
 * Question authoring, as pure data.
 *
 * ## Why the logic lives here
 *
 * The admin question form has two failure modes that a build, a lint pass and a
 * type check cannot see, and both are silent successes rather than errors:
 *
 *  1. **`PUT` uses `model_dump(exclude_unset=True)`.** A key absent from the body
 *     leaves the column alone; a key sent as `null` *clears* it. So spreading a
 *     form state is not equivalent to sending the fields: omit `explanation` and
 *     a cleared explanation box is saved as the old text, while sending `null`
 *     for a field the user never touched silently erases it. `buildQuestionPayload`
 *     therefore always emits every field it owns, with `null` used deliberately
 *     and only where `null` is the right meaning.
 *
 *  2. **An `mcq` whose `correct_answer` is not one of its `options` is accepted by
 *     every storage layer** — schema, router and DB all pass it — and the
 *     autograder then finds no match and marks *every* submission of that
 *     question wrong, permanently, with nothing reporting a problem. The server
 *     does reject it (422, `_check_gradeable`); checking it here as well is so
 *     the editor finds out at the field rather than after a student sits the
 *     paper.
 *
 * A third, quieter one: `JSON.stringify({ tolerance: NaN })` is
 * `{"tolerance":null}`. A typo in a numeric box would write a *successful* null
 * instead of producing the 422 the author expected. `numericField` refuses
 * non-finite input rather than letting it through.
 */

export interface QuestionFormValues {
  question_text: string;
  question_type: QuestionType;
  /** Editable rows. Kept as a list because an MCQ's options are positional. */
  options: string[];
  /** The option text that is correct, or `""` when none is chosen yet. */
  correct_answer: string;
  subject: string;
  topic: string;
  /** Free text, validated numerically, never passed through as a raw number. */
  numeric_answer: string;
  tolerance: string;
  marks: string;
  negative_marks: string;
  difficulty: string;
  explanation: string;
  sort_order: string;
}

/** Mirrors `TestQuestionCreate.marks` / `negative_marks`: `Numeric(6, 2)`. */
export const MARKS_MAX = 9999.99;
/** Mirrors `TestQuestionUpdate.sort_order` and the `Integer` column. */
export const SORT_ORDER_MIN = 0;
export const SORT_ORDER_MAX = 2_147_483_647;
/** `options` is a JSON array of `String(255)`; the stem is `Text`. */
export const OPTION_MAX = 255;
export const SUBJECT_MAX = 100;
export const TOPIC_MAX = 255;
export const DIFFICULTY_MAX = 20;

/** Below this an MCQ is degenerate: one choice and a "correct" answer. */
export const MIN_MCQ_OPTIONS = 2;

export const EMPTY_QUESTION_FORM: QuestionFormValues = {
  question_text: "",
  question_type: "mcq",
  options: ["", "", "", ""],
  correct_answer: "",
  subject: "",
  topic: "",
  numeric_answer: "",
  tolerance: "0",
  marks: "4",
  negative_marks: "1",
  difficulty: "medium",
  explanation: "",
  sort_order: "1",
};

export type FieldErrors = Partial<Record<keyof QuestionFormValues, string>>;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

/**
 * Trim, and treat the empty string as absent.
 *
 * A blank `topic` box and a never-filled one are the same intent, and the
 * distinction is invisible to the editor. Sending `""` would store an empty
 * string, which then shows up as a blank option in the facets dropdown.
 */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A decimal field as the string the API expects, or an error.
 *
 * Returns the *normalised* string rather than a number so `2.50` is stored as
 * `2.50` and not as a float that has been through binary rounding on the way.
 * `JSON.stringify(NaN)` is `null`, so a non-finite value must be rejected here
 * rather than reaching the wire.
 */
function decimalField(
  raw: string,
  label: string,
  bounds: { min: number; max: number },
  errors: FieldErrors,
  field: keyof QuestionFormValues,
  { required }: { required: boolean },
): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    if (required) errors[field] = `${label} is required`;
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    errors[field] = `${label} must be a number`;
    return null;
  }
  if (value < bounds.min || value > bounds.max) {
    errors[field] = `${label} must be between ${bounds.min} and ${bounds.max}`;
    return null;
  }
  return trimmed;
}

function integerField(
  raw: string,
  label: string,
  bounds: { min: number; max: number },
  errors: FieldErrors,
  field: keyof QuestionFormValues,
): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    errors[field] = `${label} is required`;
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    errors[field] = `${label} must be a whole number`;
    return null;
  }
  if (value < bounds.min || value > bounds.max) {
    errors[field] = `${label} must be between ${bounds.min} and ${bounds.max}`;
    return null;
  }
  return trimmed;
}

/**
 * Validate a form and build the request body.
 *
 * There is no create/update branch here on purpose. `POST` and `PUT` take the
 * same body shape and `PUT` uses `exclude_unset=True`, so emitting every field
 * unconditionally is correct for both: on create the extra fields are the
 * defaults, and on update the explicit `null`s are how a field gets cleared. The
 * one genuine create/edit difference -- the paper is chosen on create and fixed
 * on edit -- lives in the panel, which is where the paper is known.
 *
 * Mirrors `_check_gradeable` in `routers/mock_tests.py` rather than inventing a
 * stricter set, with one deliberate exception noted on `MIN_MCQ_OPTIONS`:
 *
 * - `mcq` must be complete -- at least two options and a key among them. The
 *   server's floor is one option; a single-choice question is technically
 *   scorable and practically unanswerable, so it is blocked here.
 * - `numeric` may be saved with no key. The server allows this on purpose: an
 *   authored question with no answer yet is a legitimate draft, and the autograder
 *   routes it to manual review rather than marking it wrong.
 * - `essay` needs neither options nor a key, for the same reason.
 */
export function buildQuestionPayload(
  values: QuestionFormValues,
): Result<QuestionPayload> {
  const errors: FieldErrors = {};

  const stem = values.question_text.trim();
  if (stem === "") errors.question_text = "The question text is required";

  const options = values.options.map((o) => o.trim()).filter((o) => o !== "");

  if (values.question_type === "mcq") {
    if (options.length < MIN_MCQ_OPTIONS) {
      errors.options = `An mcq needs at least ${MIN_MCQ_OPTIONS} options`;
    } else if (options.length > 8) {
      errors.options = "An mcq cannot have more than 8 options";
    } else if (options.some((o) => o.length > OPTION_MAX)) {
      errors.options = `Each option must be ${OPTION_MAX} characters or fewer`;
    } else {
      const duplicates = options.filter(
        (o, i) => options.indexOf(o) !== i,
      );
      if (duplicates.length) {
        // Two identical options make "which is correct?" unanswerable, and the
        // autograder would accept the text as the key for both.
        errors.options = "Options must be different from each other";
      }
    }

    const key = values.correct_answer.trim();
    if (key === "") {
      errors.correct_answer = "Choose which option is correct";
    } else if (options.length > 0 && !options.includes(key)) {
      // The exact failure `_check_gradeable` exists to stop. Named here too so
      // the editor sees it against the options list, not as a bare 422.
      errors.correct_answer = "The correct answer must be one of the options";
    }
  }

  const subject = values.subject.trim();
  if (subject.length > SUBJECT_MAX) {
    errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer`;
  }
  const topic = values.topic.trim();
  if (topic.length > TOPIC_MAX) {
    errors.topic = `Topic must be ${TOPIC_MAX} characters or fewer`;
  }
  const difficulty = values.difficulty.trim() || "medium";
  if (difficulty.length > DIFFICULTY_MAX) {
    errors.difficulty = `Difficulty must be ${DIFFICULTY_MAX} characters or fewer`;
  }

  const marks = decimalField(
    values.marks,
    "Marks",
    { min: 0, max: MARKS_MAX },
    errors,
    "marks",
    { required: true },
  );
  const negativeMarks = decimalField(
    values.negative_marks,
    "Negative marks",
    { min: 0, max: MARKS_MAX },
    errors,
    "negative_marks",
    { required: true },
  );
  // Absolute margin, so it cannot be negative -- the same rule as the column.
  const tolerance = decimalField(
    values.tolerance,
    "Tolerance",
    { min: 0, max: 9999.9999 },
    errors,
    "tolerance",
    { required: true },
  );
  const numericAnswer = decimalField(
    values.numeric_answer,
    "Numeric answer",
    { min: -99999999.9999, max: 99999999.9999 },
    errors,
    "numeric_answer",
    { required: false },
  );
  const sortOrder = integerField(
    values.sort_order,
    "Position",
    { min: SORT_ORDER_MIN, max: SORT_ORDER_MAX },
    errors,
    "sort_order",
  );

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Everything below is emitted unconditionally, on both create and update.
  // `exclude_unset=True` on the update route means an omitted key is *not*
  // cleared, so "clear this field" and "don't touch this field" have to be
  // distinguished by sending `null` deliberately rather than by leaving a key
  // out. The per-type branches are where that null is earned.
  const payload: QuestionPayload = {
    question_text: stem,
    question_type: values.question_type,
    // `null` rather than `[]` for a type with no options: an empty JSON array is
    // a value, and would round-trip as one.
    options: values.question_type === "mcq" ? options : null,
    // Only an `mcq` has a `correct_answer`. Sending the stale one when the type
    // is switched away from `mcq` would leave a key on a numeric question.
    correct_answer: values.question_type === "mcq" ? values.correct_answer.trim() : null,
    subject: blankToNull(subject),
    topic: blankToNull(topic),
    // Likewise the numeric key: switching `numeric` -> `mcq` must not leave a
    // `numeric_answer` behind, because the autograder decides by `question_type`
    // and a leftover number on an `mcq` is simply dead weight that reads as a
    // populated key in the editor.
    numeric_answer:
      values.question_type === "numeric" ? numericAnswer : null,
    tolerance: tolerance ?? "0",
    marks: marks ?? "0",
    negative_marks: negativeMarks ?? "0",
    difficulty,
    explanation: blankToNull(values.explanation),
    sort_order: Number(sortOrder ?? 0),
  };

  return { ok: true, value: payload };
}

/** A bank row as form values, ready to edit. */
export function questionFormFromRow(row: AdminQuestionListItem): QuestionFormValues {
  const options = row.options ?? [];
  return {
    question_text: row.question_text,
    question_type: (row.question_type as QuestionType) ?? "mcq",
    // A stored `mcq` with fewer than MIN_MCQ_OPTIONS options (a hand-edited row)
    // still has to open in a usable shape, so pad rather than render an editor
    // with no rows to type into.
    options:
      options.length > 0 ? [...options] : [...EMPTY_QUESTION_FORM.options],
    correct_answer: row.correct_answer ?? "",
    subject: row.subject ?? "",
    topic: row.topic ?? "",
    numeric_answer: row.numeric_answer ?? "",
    tolerance: row.tolerance ?? "0",
    marks: row.marks ?? "0",
    negative_marks: row.negative_marks ?? "0",
    difficulty: row.difficulty ?? "medium",
    explanation: row.explanation ?? "",
    sort_order: String(row.sort_order ?? 0),
  };
}

/** A blank form, positioned after whatever the paper already contains. */
export function emptyQuestionForm(nextSortOrder: number): QuestionFormValues {
  return { ...EMPTY_QUESTION_FORM, sort_order: String(nextSortOrder) };
}

/**
 * A stored row as a complete update body, with `is_active` overridden.
 *
 * Needed for the deactivate/reactivate button, which does not open the editor.
 * It cannot just send `{ is_active: false }`: the update route uses
 * `exclude_unset=True`, and — more importantly — `_check_gradeable` judges the
 * *merged* state, so a partial body is accepted but a row whose `correct_answer`
 * had drifted outside its options would be re-validated against itself and
 * 422. Re-sending the full stored state makes the toggle behave exactly like
 * opening the editor and pressing Save.
 */
export function questionPayloadFromRow(
  row: AdminQuestionListItem,
  overrides: Partial<QuestionUpdatePayload> = {},
): QuestionUpdatePayload {
  return {
    question_text: row.question_text,
    question_type: (row.question_type as QuestionType) ?? "mcq",
    options: row.options ?? null,
    correct_answer: row.correct_answer ?? null,
    subject: row.subject ?? null,
    topic: row.topic ?? null,
    numeric_answer: row.numeric_answer ?? null,
    tolerance: row.tolerance ?? "0",
    marks: row.marks ?? "0",
    negative_marks: row.negative_marks ?? "0",
    difficulty: row.difficulty ?? "medium",
    explanation: row.explanation ?? null,
    sort_order: row.sort_order ?? 0,
    is_active: row.is_active,
    ...overrides,
  };
}

/**
 * One past the highest `sort_order` in a paper, so an append lands last.
 *
 * Derived from `question_count` because the facets endpoint reports the count the
 * editor sees -- inactive questions included -- and `sort_order` on a hand-built
 * paper is not guaranteed to be a dense 1..n. Approximate, and the backend
 * recomputes the truth anyway on create when `sort_order` is left unset; this
 * only decides where a new row appears before it is saved.
 */
export function nextSortOrder(paper: AdminQuestionPaper | undefined): number {
  return (paper?.question_count ?? 0) + 1;
}
