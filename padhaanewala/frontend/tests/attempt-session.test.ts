import { describe, expect, it } from "vitest";

import { ApiError, type AttemptQuestion, type AttemptRecord, type ResultQuestion } from "@/lib/api";
import {
  answerKey,
  answerTextFor,
  attemptHasEnded,
  describeAttemptSaveError,
  describeAttemptStartError,
  elapsedSeconds,
  isAnswered,
  isNumericQuestion,
  optionIndexFor,
  resultSummary,
  seedAnswers,
  topicOf,
} from "@/lib/attempt-session";

/**
 * The runner used to grade its own paper against `correctIndex`. It no longer can:
 * `AttemptQuestion` has no key at all, because the server withholds it until the
 * attempt is graded. These tests cover the translation that replaced it -- index
 * versus text, and the server's numbers arriving as `Decimal` strings.
 */

function mcq(overrides: Partial<AttemptQuestion> = {}): AttemptQuestion {
  return {
    id: 1,
    question_text: "A particle moves in a circle. The centripetal force is…",
    question_type: "mcq",
    options: ["mv²/r", "mvr", "mvr²", "F/r"],
    marks: "4.00",
    negative_marks: "1.00",
    difficulty: "medium",
    sort_order: 1,
    subject: "Physics",
    topic: "Circular motion",
    selected_answer: null,
    ...overrides,
  };
}

const numeric = (overrides: Partial<AttemptQuestion> = {}): AttemptQuestion =>
  mcq({ id: 2, question_type: "numeric", options: null, selected_answer: null, ...overrides });

const record = (overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id: 10,
  mock_test_id: 3,
  mock_test_name: "JEE Main 2024",
  status: "in_progress",
  started_at: "2026-03-01T10:00:00Z",
  expires_at: "2026-03-01T11:00:00Z",
  submitted_at: null,
  score: null,
  total_marks: null,
  correct_count: null,
  incorrect_count: null,
  unanswered_count: null,
  pending_review_count: null,
  percentage: null,
  time_remaining_seconds: 1800,
  ...overrides,
});

describe("answerKey", () => {
  it("is the question id as a string, so ids cannot collide with anything else", () => {
    expect(answerKey(42)).toBe("42");
  });
});

describe("isNumericQuestion", () => {
  it("reads the column rather than the shape", () => {
    expect(isNumericQuestion(mcq())).toBe(false);
    expect(isNumericQuestion(numeric())).toBe(true);
  });
});

describe("optionIndexFor", () => {
  it("maps the stored option text back to its index", () => {
    expect(optionIndexFor(mcq(), "mvr")).toBe(1);
  });

  it("reads a stored answer as unattempted when its option no longer exists", () => {
    // The failure this prevents: `?? 0` would mark option A chosen for a student
    // who answered something else.
    expect(optionIndexFor(mcq(), "edited away")).toBeNull();
  });

  it("is null for an unattempted question", () => {
    expect(optionIndexFor(mcq(), null)).toBeNull();
  });

  it("is null for a numeric question, whose answer is text rather than an index", () => {
    expect(optionIndexFor(numeric({ selected_answer: "42" }), "42")).toBeNull();
  });
});

describe("answerTextFor", () => {
  it("sends the option's text, which is what the server stores", () => {
    expect(answerTextFor(mcq(), { selected: 2, marked: false })).toBe("mvr²");
  });

  it("sends null when nothing is chosen, which clears the answer", () => {
    expect(answerTextFor(mcq(), { selected: null, marked: false })).toBeNull();
    expect(answerTextFor(mcq(), undefined)).toBeNull();
  });

  it("is null when the index points past the options", () => {
    expect(answerTextFor(mcq({ options: ["only one"] }), { selected: 3, marked: false })).toBeNull();
  });

  it("sends the typed text for a numeric question", () => {
    expect(answerTextFor(numeric(), { selected: null, marked: false, numeric: " 42 " })).toBe("42");
  });

  it("treats a blank numeric field as no answer rather than as 0", () => {
    // Grading a half-typed field as 0 would be a wrong answer the student never
    // gave. `is_unanswered` on the server is the same rule.
    expect(answerTextFor(numeric(), { selected: null, marked: false, numeric: "  " })).toBeNull();
  });
});

describe("isAnswered", () => {
  it("is true only when there is something to send", () => {
    expect(isAnswered(mcq(), { selected: 0, marked: false })).toBe(true);
    expect(isAnswered(mcq(), { selected: null, marked: false })).toBe(false);
    expect(isAnswered(numeric(), { selected: null, marked: false, numeric: "" })).toBe(false);
  });
});

describe("seedAnswers", () => {
  it("restores stored answers on resume", () => {
    const answers = seedAnswers([
      mcq({ id: 1, selected_answer: "mvr" }),
      numeric({ id: 2, selected_answer: "9.8" }),
    ]);
    expect(answers["1"].selected).toBe(1);
    expect(answers["2"].numeric).toBe("9.8");
  });

  it("leaves an unattempted question unattempted", () => {
    const answers = seedAnswers([mcq({ id: 1, selected_answer: null })]);
    expect(answers["1"].selected).toBeNull();
    expect(answers["1"].numeric).toBeUndefined();
  });

  it("gives every question a marked=false entry, so the palette has something to read", () => {
    expect(seedAnswers([mcq(), numeric()])["2"].marked).toBe(false);
  });
});

describe("topicOf", () => {
  it("prefers the topic", () => {
    expect(topicOf(mcq())).toBe("Circular motion");
  });

  it("falls back to the subject when an imported question has no topic", () => {
    expect(topicOf(mcq({ topic: null }))).toBe("Physics");
  });

  it("never returns null, which would render a blank row labelled undefined", () => {
    expect(topicOf(mcq({ topic: null, subject: null }))).toBe("General");
  });
});

describe("elapsedSeconds", () => {
  it("uses the server's own timestamps when the attempt was submitted", () => {
    const attempt = record({
      submitted_at: "2026-03-01T10:41:00Z",
      time_remaining_seconds: 1140,
    });
    expect(elapsedSeconds(attempt, 60)).toBe(2460);
  });

  it("falls back to the duration minus the remaining seconds when unsubmitted", () => {
    expect(elapsedSeconds(record({ time_remaining_seconds: 1800 }), 60)).toBe(1800);
  });

  it("is never negative", () => {
    expect(elapsedSeconds(record({ time_remaining_seconds: 9999 }), 60)).toBe(0);
  });

  it("ignores a submitted_at earlier than started_at rather than reporting it", () => {
    const attempt = record({
      started_at: "2026-03-01T10:41:00Z",
      submitted_at: "2026-03-01T10:00:00Z",
    });
    expect(elapsedSeconds(attempt, 60)).toBe(1800);
  });
});

describe("resultSummary", () => {
  const result = (attempt: Partial<AttemptRecord>, questions: ResultQuestion[]) => ({
    attempt: record({
      status: "submitted",
      submitted_at: "2026-03-01T10:30:00Z",
      score: "5.00",
      total_marks: "8.00",
      ...attempt,
    }),
    questions,
  });

  const graded = (overrides: Partial<ResultQuestion>): ResultQuestion => ({
    ...mcq(),
    is_correct: true,
    marks_awarded: "4.00",
    correct_answer: "mv²/r",
    explanation: null,
    numeric_answer: null,
    tolerance: null,
    grader_feedback: null,
    ...overrides,
  });

  it("takes every count from the server rather than scoring locally", () => {
    const summary = resultSummary(result(
        { correct_count: 2, incorrect_count: 1, unanswered_count: 1 },
        [
          graded({ id: 1, is_correct: true }),
          graded({ id: 2, is_correct: false }),
          graded({ id: 3, is_correct: null }),
        ],
      ),
      60,
    );
    expect(summary.correct).toBe(2);
    expect(summary.incorrect).toBe(1);
    expect(summary.unattempted).toBe(1);
    expect(summary.score).toBe(5);
    expect(summary.maxScore).toBe(8);
  });

  it("groups the breakdown by topic", () => {
    const summary = resultSummary(result({}, [
        graded({ id: 1, topic: "Circular motion", is_correct: true }),
        graded({ id: 2, topic: "Circular motion", is_correct: false }),
        graded({ id: 3, topic: "Rotation", is_correct: true }),
      ]),
      60,
    );
    expect(summary.topicPerf["Circular motion"]).toEqual({ correct: 1, total: 2 });
    expect(summary.topicPerf["Rotation"]).toEqual({ correct: 1, total: 1 });
  });

  it("does not mark an essay awaiting review as wrong", () => {
    const summary = resultSummary(result({}, [graded({ id: 1, is_correct: null, question_type: "essay" })]),
      60,
    );
    expect(summary.topicPerf["Circular motion"].correct).toBe(0);
    expect(summary.topicPerf["Circular motion"].total).toBe(1);
  });

  it("tolerates a null score rather than rendering NaN", () => {
    const summary = resultSummary(result({ score: null, total_marks: null, correct_count: null }, []),
      60,
    );
    expect(summary.score).toBe(0);
    expect(summary.maxScore).toBe(0);
  });
});

describe("attemptHasEnded", () => {
  it("is false while an attempt is running", () => {
    expect(attemptHasEnded(record())).toBe(false);
    expect(attemptHasEnded(record({ status: "pending" }))).toBe(false);
  });

  it("is true once the server has finalised it", () => {
    // This is how a client learns the server ended the attempt on the deadline.
    expect(attemptHasEnded(record({ status: "submitted" }))).toBe(true);
    expect(attemptHasEnded(record({ status: "graded" }))).toBe(true);
  });
});

describe("describeAttemptStartError", () => {
  it("passes the server's own sentence through, which is the useful part", () => {
    const err = new ApiError(
      "Bad Request",
      400,
      "This mock test has no questions available yet. If it was just imported, its questions are still awaiting review.",
    );
    expect(describeAttemptStartError(err)).toContain("awaiting review");
  });

  it("says sign in for a 401, which is not the same as forbidden", () => {
    expect(describeAttemptStartError(new ApiError("Unauthorized", 401))).toBe(
      "Sign in to take this mock test.",
    );
  });

  it("passes an attempt-limit refusal through rather than offering a retry", () => {
    const err = new ApiError("Bad Request", 400, "Attempt limit reached for this mock test");
    expect(describeAttemptStartError(err)).toBe("Attempt limit reached for this mock test");
  });

  it("says the paper is gone for a 404", () => {
    expect(describeAttemptStartError(new ApiError("Not Found", 404))).toBe(
      "That mock test no longer exists.",
    );
  });

  it("does not claim an offline client lost its attempt", () => {
    expect(describeAttemptStartError(new ApiError("Network", 0))).toContain("Could not reach");
  });
});

describe("describeAttemptSaveError", () => {
  it("warns that the answer is on screen but not on the server", () => {
    const message = describeAttemptSaveError(new ApiError("Network", 0));
    expect(message).toContain("not saved");
  });

  it("says the attempt is already submitted for a 400", () => {
    expect(describeAttemptSaveError(new ApiError("Bad Request", 400))).toContain(
      "already been submitted",
    );
  });

  it("passes a server sentence through", () => {
    expect(describeAttemptSaveError(new ApiError("Forbidden", 403, "Not your attempt"))).toBe(
      "Not your attempt",
    );
  });
});