import {
  ApiError,
  isForbidden,
  type AttemptQuestion,
  type AttemptRecord,
  type ResultQuestion,
  type TestResult,
} from "@/lib/api";
import type { AnswerState } from "@/components/mocktests/types";

/**
 * The bridge between the server's attempt engine and the runner's local state.
 *
 * Everything the runner needs to reconcile, as pure functions, so it can be tested
 * without a browser or a network. The runner used to hold the whole paper in React
 * state and grade it locally against `correctIndex`; the server now owns all of
 * that, which means the two shapes genuinely disagree and the translation has to
 * live somewhere explicit:
 *
 *  - **The runner indexes options, the server stores their text.** `AttemptQuestion`
 *    carries `selected_answer: string | null` -- the option's *text* -- because a
 *    shuffled option list makes an index meaningless across requests. Every save
 *    therefore converts an index back to text, and every resume converts text back
 *    to an index.
 *  - **`id` is a number, not a string.** The answers map is keyed by
 *    {@link answerKey} so a question id can never collide with a mark flag or a
 *    topic name.
 *  - **The server grades.** There is no `correctIndex` in an `AttemptQuestion` at
 *    all, so nothing in this module tries to score an answer.
 */

/** The answers map: question id -> what the student has entered so far. */
export type AttemptAnswers = Record<string, AnswerState>;

/** One key function, so no caller builds a key by hand and misses a conversion. */
export function answerKey(questionId: number): string {
  return String(questionId);
}

/**
 * True when the question takes typed text rather than a chosen option.
 *
 * `question_type` is the column, not a shape: an `mcq` with a null `options` list
 * is a malformed row, and treating it as "not numeric" just means no option is
 * rendered, which is the honest rendering of a question nobody can answer.
 */
export function isNumericQuestion(question: AttemptQuestion): boolean {
  return question.question_type === "numeric";
}

/**
 * The option index the server's stored answer points at, or null.
 *
 * `indexOf` rather than a direct lookup because a stored answer whose text is no
 * longer among the options -- an option edited after the student answered it --
 * must read as "not answered" rather than as option 0, which would silently mark
 * an unrelated option chosen.
 */
export function optionIndexFor(
  question: AttemptQuestion,
  selectedAnswer: string | null,
): number | null {
  if (selectedAnswer === null || isNumericQuestion(question)) return null;
  const index = (question.options ?? []).indexOf(selectedAnswer);
  return index === -1 ? null : index;
}

/**
 * Read the server's stored answers into the runner's state.
 *
 * Used on resume, which is a real case rather than a hypothetical: `start`
 * finalises an expired attempt and reuses an unfinished one, so a student who
 * refreshes mid-test gets their answers back rather than a blank paper.
 */
export function seedAnswers(questions: AttemptQuestion[]): AttemptAnswers {
  const answers: AttemptAnswers = {};
  for (const question of questions) {
    const key = answerKey(question.id);
    if (isNumericQuestion(question)) {
      answers[key] = {
        selected: null,
        marked: false,
        numeric: question.selected_answer ?? "",
      };
      continue;
    }
    answers[key] = {
      selected: optionIndexFor(question, question.selected_answer),
      marked: false,
    };
  }
  return answers;
}

/**
 * What to send for one answer, or null to clear it.
 *
 * The clear matters: `saveAnswer` accepts `null` as a deliberate answer state, so
 * a student who changes their mind and clicks the chosen option again is removing
 * an answer rather than leaving the old one on the server.
 */
export function answerTextFor(
  question: AttemptQuestion,
  state: AnswerState | undefined,
): string | null {
  if (isNumericQuestion(question)) {
    const raw = state?.numeric?.trim() ?? "";
    return raw === "" ? null : raw;
  }
  const index = state?.selected;
  if (index === null || index === undefined) return null;
  return question.options?.[index] ?? null;
}

/** True when this question has an answer of either kind. */
export function isAnswered(
  question: AttemptQuestion,
  state: AnswerState | undefined,
): boolean {
  return answerTextFor(question, state) !== null;
}

/**
 * The grouping label for the results breakdown.
 *
 * `topic` is authored content and is usually `null` on an imported question, so
 * falling through to `subject` and then to a constant matters: `topic: null` used
 * as a record key rendered as a blank row labelled "undefined" in a breakdown that
 * is meant to be readable.
 */
export function topicOf(question: AttemptQuestion | ResultQuestion): string {
  return question.topic ?? question.subject ?? "General";
}

/**
 * Whether the server released the answer key for this attempt.
 *
 * `_build_result` withholds `correct_answer` and `explanation` unless the paper's
 * `result_visibility` is `immediate`, so a graded attempt can legitimately come
 * back with no key at all. The results screen has to notice that: rendering a
 * solution list of empty "Correct answer" rows would report the absence of a key
 * as the absence of an answer.
 */
export function answerKeyReleased(questions: ResultQuestion[]): boolean {
  return questions.some(
    (question) => question.correct_answer !== null || question.numeric_answer !== null,
  );
}

/* ------------------------------------------------------------------ *
 * The clock
 * ------------------------------------------------------------------ */

/**
 * How long the attempt actually took.
 *
 * `submitted_at - started_at` when both are present, because those are the
 * server's own timestamps. The fallback -- the paper's duration minus the
 * server's remaining seconds -- is only right when the clock ran out exactly, and
 * `time_remaining_seconds` on a submitted attempt is what the grader left there.
 */
export function elapsedSeconds(attempt: AttemptRecord, durationMinutes: number): number {
  if (attempt.started_at && attempt.submitted_at) {
    const started = Date.parse(attempt.started_at);
    const submitted = Date.parse(attempt.submitted_at);
    if (Number.isFinite(started) && Number.isFinite(submitted) && submitted >= started) {
      return Math.round((submitted - started) / 1000);
    }
  }
  return Math.max(0, durationMinutes * 60 - attempt.time_remaining_seconds);
}

/* ------------------------------------------------------------------ *
 * The result
 * ------------------------------------------------------------------ */

/** What `TestResultScreen` renders. Structurally the runner's old `BuildResult`. */
export interface ResultSummary {
  score: number;
  maxScore: number;
  /** The server's own share-of-paper percentage, already clamped to 0..100. */
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /**
   * Answers submitted but not auto-gradable -- essays, keyless MCQ, keyless
   * numeric. They are counted in neither `correct` nor `incorrect` and were
   * worth nothing yet, so a result screen that shows only the other three
   * tallies makes the counts look like they do not add up.
   */
  pendingReview: number;
  timeTakenSec: number;
  topicPerf: Record<string, { correct: number; total: number }>;
}

/**
 * Project the server's grade onto the summary the results screen draws.
 *
 * Every number comes from the server rather than being recomputed here. That is
 * the whole point of moving grading to `POST /attempts/{id}/submit`: a client that
 * scored its own paper would disagree with the stored attempt the moment the two
 * implementations drifted, and the stored attempt is the one the student's history
 * shows.
 *
 * `Decimal` fields arrive as strings and are parsed once, here. The per-question
 * split is the server's too (`correct_count` etc.), so an essay awaiting manual
 * review lands in `pending_review_count` rather than being invented as incorrect.
 *
 * The percentage is the server's rather than `correct / questions`. Those are not
 * the same figure: the server's is a share of the paper's marks, so a half-mark
 * question counts for half, and it is clamped at zero because negative marking can
 * drive the raw score below it. The screen used to derive its own percentage from
 * the answer count, which quietly reported a different number from the one the
 * stored attempt carried.
 *
 * The graded questions come from `result.questions` rather than from a separate
 * argument, so the summary cannot be built from a different list of questions than
 * the one that was graded.
 *
 * Topic performance counts `is_correct === true` only. An essay has
 * `is_correct === null` until someone reviews it, so it sits in `total` and is
 * never scored as wrong -- a breakdown that marked unreviewed essays red would be
 * claiming a verdict nobody has reached.
 */
export function resultSummary(
  result: TestResult,
  durationMinutes: number,
): ResultSummary {
  const attempt = result.attempt;
  const topicPerf: ResultSummary["topicPerf"] = {};
  for (const question of result.questions) {
    const topic = topicOf(question);
    topicPerf[topic] ??= { correct: 0, total: 0 };
    topicPerf[topic].total += 1;
    if (question.is_correct === true) topicPerf[topic].correct += 1;
  }

  const maxScore = Number(attempt.total_marks ?? 0);
  return {
    score: Number(attempt.score ?? 0),
    maxScore,
    percentage:
      attempt.percentage !== null
        ? Number(attempt.percentage)
        : maxScore
          ? Math.round((Number(attempt.score ?? 0) * 100) / maxScore)
          : 0,
    correct: attempt.correct_count ?? 0,
    incorrect: attempt.incorrect_count ?? 0,
    unattempted: attempt.unanswered_count ?? 0,
    pendingReview: attempt.pending_review_count ?? 0,
    timeTakenSec: elapsedSeconds(attempt, durationMinutes),
    topicPerf,
  };
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/**
 * Explain why an attempt could not be opened.
 *
 * The two 400s matter separately and the backend words both:
 *
 *  - **Attempt limit reached** -- the student has used `attempts_allowed`. Not
 *    retryable, and offering a retry button would be a promise the server will not
 *    keep.
 *  - **No questions available yet** -- this is the PDF-import feature showing
 *    through the student side. A paper whose questions are all unapproved drafts
 *    is an active row with nothing `_PUBLISHABLE` in it, so this is the sentence a
 *    student sees the moment after an import and before review. Passing it through
 *    verbatim is what tells them to wait rather than to try again.
 *
 * `err.detail` is preferred wherever it exists, because every 4xx on these routes
 * is already a sentence about the specific problem.
 */
export function describeAttemptStartError(err: unknown): string {
  if (isForbidden(err)) {
    return "You do not have access to this mock test.";
  }
  if (err instanceof ApiError) {
    if (typeof err.detail === "string" && err.detail.trim()) return err.detail;
    // Checked separately from `isForbidden`, which only matches 403: an expired or
    // absent session is a 401, and it means sign in rather than "you may not".
    if (err.status === 401) return "Sign in to take this mock test.";
    if (err.status === 404) return "That mock test no longer exists.";
    if (err.status === 0) return "Could not reach the mock test server.";
  }
  return "Could not start this mock test. Please try again.";
}

/**
 * Explain why an answer did not save.
 *
 * Distinct from a start failure because the right response is different: a failed
 * save leaves the student's selection on screen but not on the server, so the
 * wording has to say the attempt was not submitted, rather than implying the test
 * ended.
 */
export function describeAttemptSaveError(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string" && err.detail.trim()) return err.detail;
    if (err.status === 403) return "Not your attempt.";
    if (err.status === 400) return "This attempt has already been submitted.";
    if (err.status === 0) {
      return "You appear to be offline. Your answer is on screen but not saved — reconnect before you submit.";
    }
  }
  return "An answer could not be saved. Try that question again.";
}

/**
 * Whether the server has finalised the attempt, so the runner must stop.
 *
 * `getAttempt` is also how a client learns the server ended the attempt on the
 * deadline without the student submitting: the countdown in the tab can drift, and
 * the deadline is not the tab's problem to enforce.
 */
export function attemptHasEnded(attempt: AttemptRecord): boolean {
  return attempt.status !== "in_progress" && attempt.status !== "pending";
}