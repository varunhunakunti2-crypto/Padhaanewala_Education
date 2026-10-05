import { ApiError, type DraftQuestionUpdatePayload, type ImportDraft } from "@/lib/api";

/**
 * The PDF-import upload form, expressed as pure data.
 *
 * Companion to `lib/media-form.ts` and for the same reasons. `POST
 * /question-imports/pdf` is multipart with a shape that cannot be inferred from
 * a React component:
 *
 *  - **Every non-file part arrives as a string.** `mock_test_id: int | None =
 *    Form(None)` means sending `""` is a 422, while *omitting* it is what "no
 *    target chosen" means. There is no `null` on the wire.
 *  - **Exactly one target is required, and the backend enforces it.** Sending
 *    both `mock_test_id` and `new_paper_name`, or neither, is a 422. The route
 *    says so outright, and building the body here is the only place that rule
 *    can be honoured -- a form with two independent controls cannot express it.
 *  - **The size ceiling is backend configuration.** `PDF_IMPORT_MAX_BYTES` is a
 *    setting, so the constant below mirrors the default and exists to fail
 *    before spending an upload. The server's own refusal is what decides.
 */

/* ------------------------------------------------------------------ *
 * Contract constants
 * ------------------------------------------------------------------ */

/**
 * Mirror of `PDF_IMPORT_MAX_BYTES` in `backend/app/config.py`.
 *
 * Read through {@link importMaxBytes} so a deployment with a different ceiling
 * can set `NEXT_PUBLIC_PDF_IMPORT_MAX_BYTES`. Kept *below-or-equal* to the
 * server's value for the reason {@link MEDIA_MAX_BYTES_DEFAULT} documents: a
 * client limit under the server's refuses early and visibly, while one above it
 * spends a 20 MB upload before the real refusal arrives.
 */
export const PDF_IMPORT_MAX_BYTES_DEFAULT = 20 * 1024 * 1024;

/**
 * The first bytes of every PDF. Checked on the client to turn the most common
 * mistake into a sentence rather than a 422; the server re-checks it, because a
 * browser-reported MIME type is advisory.
 */
const PDF_MAGIC = "%PDF-";

export const PDF_IMPORT_ACCEPT_ATTRIBUTE = "application/pdf,.pdf";

/** How many questions to ask for per 12,000-character chunk, by default. */
export const PDF_IMPORT_DEFAULT_PER_CHUNK = 5;

/**
 * Mirrors `PDF_IMPORT_DEFAULT_DRAFTS_PER_CHUNK`, and the only knob the upload
 * form exposes.
 *
 * Exposed because it is the one number an admin can predict: pages x this is
 * roughly the length of the resulting paper, so it is the difference between
 * "the model produced 5 questions for 40 pages" being a surprise and a choice.
 */
export const PDF_IMPORT_PER_CHUNK_MIN = 1;
export const PDF_IMPORT_PER_CHUNK_MAX = 20;

/** `mock_test_ref` is resolved as an integer or a slug; the picker sends digits. */
export const PDF_IMPORT_NEW_PAPER_NAME_MIN = 2;

/* ------------------------------------------------------------------ *
 * File pre-checks
 * ------------------------------------------------------------------ */

export type ImportCheck = { ok: true } | { ok: false; error: string };

/** Bytes rendered the way the size hint and the size error both want them. */
export function formatImportBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The server's ceiling for this deployment, with the default as the fallback. */
export function importMaxBytes(): number {
  const configured = Number(process.env.NEXT_PUBLIC_PDF_IMPORT_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : PDF_IMPORT_MAX_BYTES_DEFAULT;
}

/** The file's extension, lowercased, or `""` when it has none. */
export function importFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Reject the files this form should not send, before spending an upload.
 *
 * A scanned paper is *not* refused here even though it will produce nothing
 * useful: whether a PDF has a text layer cannot be known without parsing it, and
 * the floor that catches a scan is server-side with a message written for it.
 * Refusing by file size or name alone would mean refusing legitimate files.
 */
export function validateImportPdf(file: File | null | undefined): ImportCheck {
  if (!file) return { ok: false, error: "Choose a PDF to upload." };

  if (file.size === 0) return { ok: false, error: "That file is empty." };

  const limit = importMaxBytes();
  if (file.size > limit) {
    return {
      ok: false,
      error:
        `That file is ${formatImportBytes(file.size)}. The limit is ` +
        `${formatImportBytes(limit)} — export a smaller PDF, or split the paper ` +
        "into one file per section.",
    };
  }

  const extension = importFileExtension(file.name);
  if (extension !== "" && extension !== "pdf") {
    return {
      ok: false,
      error: `A .${extension} file is not accepted. This form only reads PDFs.`,
    };
  }

  const declared = (file.type ?? "").trim().toLowerCase();
  // Empty `File.type` is normal for PDFs on some platforms, so a mismatch is
  // only an error when the browser actually claimed something. The bytes are
  // checked either way, by the server.
  if (declared !== "" && declared !== "application/pdf") {
    return {
      ok: false,
      error:
        `A browser labels this file “${declared}”, which is not a PDF. ` +
        "Re-export it as a PDF and try again.",
    };
  }

  return { ok: true };
}

/**
 * Read the file's first bytes to confirm the PDF magic number.
 *
 * `File.slice(...).arrayBuffer()` reads 5 bytes rather than the whole file, so
 * this is not a second upload. Async because there is no synchronous way to read
 * a `File`'s bytes, which is why {@link validateImportPdf} stays sync and this
 * is a separate, best-effort extra check: a refusal here is a fast local no, and
 * anything that passes is still verified server-side.
 */
export async function confirmPdfBytes(file: File): Promise<ImportCheck> {
  try {
    const head = new TextDecoder("latin1").decode(await file.slice(0, 5).arrayBuffer());
    if (!head.startsWith(PDF_MAGIC)) {
      return {
        ok: false,
        error:
          "That file does not start with %PDF-, so it is not a real PDF. Renaming " +
          "a file to .pdf does not convert it.",
      };
    }
  } catch {
    // An unreadable file is the server's call, not a local failure worth
    // blocking on -- the bytes have to be read for the upload anyway.
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Payload construction
 * ------------------------------------------------------------------ */

/** Which paper the drafts land in. Exactly one of these is sent. */
export type ImportTarget = "existing" | "new";

export interface ImportFormValues {
  target: ImportTarget;
  /** `mock_test_id`. Digits, from the picker -- never typed. */
  mock_test_id: string;
  new_paper_name: string;
  subject: string;
  /** Blank means "use the server default" (`PDF_IMPORT_DEFAULT_DRAFTS_PER_CHUNK`). */
  per_chunk: string;
}

/**
 * Defaults to a new paper.
 *
 * The common case is the first upload for a paper that does not exist yet: the
 * target list is a live database, and a content admin adding a 2024 paper has
 * nothing in it to pick.
 */
export const EMPTY_IMPORT_FORM: ImportFormValues = {
  target: "new",
  mock_test_id: "",
  new_paper_name: "",
  subject: "",
  per_chunk: String(PDF_IMPORT_DEFAULT_PER_CHUNK),
};

export type ImportUploadBuild =
  | { ok: true; body: FormData }
  | { ok: false; error: string };

/**
 * Build the multipart body for `POST /question-imports/pdf`.
 *
 * The part names must match the route's `Form(...)` parameters exactly: `file`,
 * `mock_test_id`, `new_paper_name`, `subject`, `per_chunk`.
 *
 * The one-target rule is enforced here rather than left to the 422 because a
 * 422 arrives after the browser has already spent the upload, and its wording
 * ("give either `mock_test_id` or `new_paper_name`, not both and not neither")
 * reads as an API complaint when it is really a form that has not been filled in.
 */
export function buildImportUpload(
  values: ImportFormValues,
  file: File | null,
): ImportUploadBuild {
  const checked = validateImportPdf(file);
  if (!checked.ok) return { ok: false, error: checked.error };
  const pdf = file as File;

  const mockTestId = values.mock_test_id.trim();
  const newPaperName = values.new_paper_name.trim();

  // Mirrors the route's own check, so the two halves cannot disagree about which
  // combination is legal.
  const sendsExisting = values.target === "existing";
  if (sendsExisting === (newPaperName !== "")) {
    return {
      ok: false,
      error: "Choose either an existing paper or a name for a new one -- not both.",
    };
  }
  if (sendsExisting && mockTestId === "") {
    return { ok: false, error: "Choose which paper to add these questions to." };
  }
  if (sendsExisting && !/^\d+$/.test(mockTestId)) {
    return { ok: false, error: "The paper id must be a positive whole number." };
  }
  if (!sendsExisting && newPaperName.length < PDF_IMPORT_NEW_PAPER_NAME_MIN) {
    return {
      ok: false,
      error: "Give the new paper a name of at least 2 characters.",
    };
  }

  const rawPerChunk = values.per_chunk.trim();
  let perChunk: number | null = null;
  if (rawPerChunk !== "") {
    if (!/^\d+$/.test(rawPerChunk)) {
      return { ok: false, error: "Questions per chunk must be a whole number." };
    }
    perChunk = Number(rawPerChunk);
    if (
      perChunk < PDF_IMPORT_PER_CHUNK_MIN ||
      perChunk > PDF_IMPORT_PER_CHUNK_MAX
    ) {
      return {
        ok: false,
        error:
          `Questions per chunk must be between ${PDF_IMPORT_PER_CHUNK_MIN} and ` +
          `${PDF_IMPORT_PER_CHUNK_MAX}.`,
      };
    }
  }

  const body = new FormData();
  body.set("file", pdf, pdf.name);
  // The unset half is omitted rather than sent empty: an empty string is not
  // "no target" to FastAPI, it is a 422. The target rule above has already
  // decided which half that is.
  if (sendsExisting) {
    body.set("mock_test_id", mockTestId);
  } else {
    body.set("new_paper_name", newPaperName);
  }
  const subject = values.subject.trim();
  if (subject !== "") body.set("subject", subject);
  if (perChunk !== null) body.set("per_chunk", String(perChunk));

  return { ok: true, body };
}

/* ------------------------------------------------------------------ *
 * Correcting a draft
 *
 * Editing is the normal path, not an edge case: the model gets the wording
 * roughly right and the key attached to the wrong option often enough that the
 * review step exists to correct it. `lib/question-form.ts` does the same job for
 * hand-authored questions, and for the same reason -- the rules are the payload,
 * and a payload with rules in it can be tested without a DOM.
 * ------------------------------------------------------------------ */

/** Mirrors `MAX_OPTION_LENGTH` / `MAX_QUESTION_TEXT_LENGTH` in the backend schema. */
export const DRAFT_MAX_OPTION_LENGTH = 500;
export const DRAFT_MAX_TEXT_LENGTH = 8000;
export const DRAFT_MAX_SUBJECT_LENGTH = 100;
export const DRAFT_MAX_TOPIC_LENGTH = 255;
export const DRAFT_MAX_DIFFICULTY_LENGTH = 20;

/** An mcq needs at least this many options to be answerable. */
const DRAFT_MIN_OPTIONS = 2;

export interface DraftFormValues {
  question_text: string;
  options: string[];
  correct_answer: string;
  subject: string;
  topic: string;
  difficulty: string;
  marks: string;
  negative_marks: string;
  explanation: string;
}

/** Per-field messages, keyed the way `QuestionFormValues` keys them. */
export type DraftFieldErrors = Partial<Record<keyof DraftFormValues, string>>;

/**
 * Read a draft into editable values.
 *
 * `marks` and `negative_marks` arrive as `Decimal` rendered by FastAPI as
 * strings (`"4.00"`), and `explanation`/`topic` can be `null`. Both are
 * normalised here rather than at the input, so the form is always editing
 * strings and `null` never reaches a controlled value.
 */
export function draftFormFromDraft(draft: ImportDraft): DraftFormValues {
  return {
    question_text: draft.question_text,
    // A draft with no options at all is a state the review panel must be able to
    // *show*, so it falls back to two blank rows rather than an empty list --
    // an empty textarea with no way to add to it is a dead end.
    options: draft.options && draft.options.length > 0 ? [...draft.options] : ["", ""],
    correct_answer: draft.correct_answer ?? "",
    subject: draft.subject ?? "",
    topic: draft.topic ?? "",
    difficulty: draft.difficulty ?? "",
    marks: draft.marks,
    negative_marks: draft.negative_marks,
    explanation: draft.explanation ?? "",
  };
}

/**
 * Re-point the key when the option carrying it is edited.
 *
 * Without this the key silently stops matching: the radio the admin picks now
 * points at text that no longer exists, and the save is rejected for a reason
 * they cannot see. Same rule as `QuestionEditor` in `QuestionsSection`, and for
 * the same reason -- the alternative is a key that can point at nothing.
 */
export function draftOptionsWithKey(
  options: string[],
  key: string,
  index: number,
  value: string,
): { options: string[]; correct_answer: string } {
  const next = [...options];
  const previous = next[index];
  next[index] = value;
  return {
    options: next,
    correct_answer: key === previous ? value : key,
  };
}

export type DraftUpdateBuild =
  | { ok: true; value: DraftQuestionUpdatePayload; changed: boolean }
  | { ok: false; errors: DraftFieldErrors };

/**
 * Validate the editor and build the partial update.
 *
 * Given a `baseline` (the values as they were loaded), only fields that actually
 * changed are sent. The route is a partial update judged against the *merged*
 * row, so this is both smaller and safer than resending everything: it cannot
 * rewrite `question_text` when the admin only moved the key, and it means the
 * audit row's `new_value` is the edit rather than the whole question.
 *
 * The omissions are deliberate rather than lazy, because each field's blank
 * case differs:
 *
 *  - **`marks`/`negative_marks` blank is omitted, not sent empty.** `Decimal` has
 *    no empty string; `""` is a 422 rather than "no marks".
 *  - **`difficulty` blank is omitted.** It is nullable in the schema but not in
 *    the column, so sending `null` here would be a 500.
 *  - **`subject`/`topic`/`explanation` blank *is* sent as `null`.** These are
 *    genuinely nullable, and "this draft has no explanation" is a real
 *    correction that dropping the field would silently fail to record.
 *
 * With every field unchanged the payload is empty and the route returns the draft
 * untouched, so "Save" on an untouched form is a no-op rather than a pointless
 * write.
 */
export function buildDraftUpdate(
  values: DraftFormValues,
  baseline?: DraftFormValues,
): DraftUpdateBuild {
  const errors: DraftFieldErrors = {};

  const text = values.question_text.trim();
  if (text === "") {
    errors.question_text = "The question cannot be blank.";
  } else if (text.length > DRAFT_MAX_TEXT_LENGTH) {
    errors.question_text = `Keep it under ${DRAFT_MAX_TEXT_LENGTH} characters.`;
  }

  // Trimmed for the *count* but preserved verbatim in the payload: option text is
  // compared against `correct_answer` as stored, so stripping whitespace here
  // would silently break a key the admin picked.
  const options = values.options.filter((o) => o.trim() !== "");
  if (options.length < DRAFT_MIN_OPTIONS) {
    errors.options = `An mcq needs at least ${DRAFT_MIN_OPTIONS} options.`;
  }
  for (const option of options) {
    if (option.length > DRAFT_MAX_OPTION_LENGTH) {
      errors.options = `Keep each option under ${DRAFT_MAX_OPTION_LENGTH} characters.`;
      break;
    }
  }

  // Checked against the trimmed list, because that is what is compared. A key
  // that differs from its option only by whitespace is exactly the failure this
  // catches, and it is the one `_check_gradeable_mcq` would 422 on.
  if (!errors.options) {
    const key = values.correct_answer.trim();
    if (key === "") {
      errors.correct_answer = "Mark which option is correct.";
    } else if (!options.some((option) => option.trim() === key)) {
      errors.correct_answer = "The key has to match one of the options exactly.";
    }
  }

  for (const [key, value, limit] of [
    ["subject", values.subject, DRAFT_MAX_SUBJECT_LENGTH],
    ["topic", values.topic, DRAFT_MAX_TOPIC_LENGTH],
    ["difficulty", values.difficulty, DRAFT_MAX_DIFFICULTY_LENGTH],
  ] as const) {
    if (value.trim().length > limit) {
      errors[key] = `Keep this under ${limit} characters.`;
    }
  }

  // `Decimal(ge=0)`: a negative mark is a 422 the admin can predict, and a
  // fraction is fine.
  for (const [key, value] of [
    ["marks", values.marks],
    ["negative_marks", values.negative_marks],
  ] as const) {
    const trimmed = value.trim();
    if (trimmed === "") continue;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      errors[key] = "Use a number, for example 4 or 0.25.";
    } else if (Number(trimmed) > 9999.99) {
      errors[key] = "Keep this under 10000.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: DraftQuestionUpdatePayload = {};

  /**
   * True when this field has to be sent.
   *
   * Without a baseline everything is sent -- the safe default for a caller that
   * holds no record of the original -- and with one, only the fields whose
   * normalised value differs. Normalisation must match the payload's own, or a
   * field unchanged apart from stray whitespace reads as an edit.
   */
  const needs = (next: unknown, baselineValue: unknown) =>
    baseline === undefined || baselineValue !== next;

  /** Blank is `null` for the columns that are genuinely nullable. */
  const nullable = (raw: string) => (raw.trim() === "" ? null : raw.trim());

  /** Element-wise, because `options` is a new array on every build. */
  const sameStrings = (next: string[], was: string[] | null) =>
    was !== null && was.length === next.length && was.every((o, i) => o === next[i]);

  if (needs(text, nullable(baseline?.question_text ?? ""))) value.question_text = text;
  // Compared element-wise: `options` is a freshly filtered array, so `!==` against
  // the baseline would report every draft as edited.
  if (!sameStrings(options, baseline?.options.filter((o) => o.trim() !== "") ?? null))
    value.options = options;

  // Never `null`: the route 422s an explicit null key. A draft that genuinely
  // cannot be keyed is rejected by the admin, not edited into that state.
  const key = values.correct_answer.trim();
  if (needs(key, nullable(baseline?.correct_answer ?? ""))) value.correct_answer = key;

  for (const field of ["subject", "topic", "explanation"] as const) {
    const next = nullable(values[field]);
    if (needs(next, nullable(baseline?.[field] ?? ""))) value[field] = next;
  }

  // Nullable in the schema, NOT NULL in the column: blank is omitted rather than
  // cleared, because `difficulty = null` would be a 500.
  const difficulty = values.difficulty.trim();
  if (difficulty !== "" && needs(difficulty, nullable(baseline?.difficulty ?? "")))
    value.difficulty = difficulty;

  // `Decimal` has no empty string, so blank marks are omitted as well: the stored
  // value survives instead of the save 422ing.
  for (const field of ["marks", "negative_marks"] as const) {
    const next = values[field].trim();
    if (next !== "" && needs(next, nullable(baseline?.[field] ?? ""))) value[field] = next;
  }

  return { ok: true, value, changed: Object.keys(value).length > 0 };
}

/* ------------------------------------------------------------------ *
 * Error presentation
 * ------------------------------------------------------------------ */

/**
 * Turn a rejected upload into something an admin can fix.
 *
 * The statuses worth naming rather than flattening:
 *
 *  - **503** is the one an admin can act on without touching code: the server
 *    has no `GEMINI_API_KEY`, so nothing it sends could ever generate. It is
 *    checked before the file is read server-side, so no upload is wasted.
 *  - **422** is the target rule and the `%PDF-` check, and the backend's wording
 *    for both is already actionable.
 *  - **413** is the size ceiling with the real byte counts in the message.
 */
export function describeImportError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "The upload could not be sent. Check your connection.";
  }
  if (err.status === 403) {
    return "Your role cannot import questions. A super admin, admin or content manager is needed.";
  }
  if (err.status === 503) {
    return (
      err.message ||
      "PDF question import is not configured on this server (no Gemini API key)."
    );
  }
  if (err.status === 413) {
    return err.message || "That file is over the size limit.";
  }
  if (err.status === 422) {
    return err.message || "The server rejected this upload.";
  }
  if (err.status === 0) {
    return "Could not reach the API.";
  }
  return err.message || "The upload failed.";
}