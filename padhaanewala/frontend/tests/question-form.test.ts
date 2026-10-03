import { describe, expect, it } from "vitest";

import type { AdminQuestionListItem } from "@/lib/api";
import {
  DIFFICULTY_MAX,
  EMPTY_QUESTION_FORM,
  MARKS_MAX,
  MIN_MCQ_OPTIONS,
  OPTION_MAX,
  buildQuestionPayload,
  emptyQuestionForm,
  nextSortOrder,
  questionFormFromRow,
  type QuestionFormValues,
} from "@/lib/question-form";

/**
 * The question form's decisions, tested without a DOM.
 *
 * The two silent-success traps this exists for:
 *
 *  - `PUT /mock-tests/{ref}/questions/{id}` uses `model_dump(exclude_unset=True)`,
 *    so an absent key leaves the column alone and an explicit `null` clears it.
 *    Every test in "emits every field" is really a test that a field cannot be
 *    silently left behind.
 *  - An `mcq` whose `correct_answer` is not one of its `options` passes the
 *    schema, the router and the DB, and is then marked wrong for every student
 *    who attempts it. The server rejects it; these assertions hold the client in
 *    step so the editor meets the error at the field.
 */

function form(overrides: Partial<QuestionFormValues> = {}): QuestionFormValues {
  return {
    ...EMPTY_QUESTION_FORM,
    question_text: "What is the SI unit of force?",
    options: ["newton", "joule", "watt", "pascal"],
    correct_answer: "newton",
    ...overrides,
  };
}

function row(overrides: Partial<AdminQuestionListItem> = {}): AdminQuestionListItem {
  return {
    id: 1,
    question_text: "Stored question",
    question_type: "mcq",
    options: ["a", "b"],
    correct_answer: "a",
    marks: "4.00",
    negative_marks: "1.00",
    difficulty: "medium",
    explanation: "Because",
    sort_order: 3,
    is_active: true,
    subject: "Physics",
    topic: "Mechanics",
    numeric_answer: null,
    tolerance: "0",
    mock_test_id: 7,
    paper_name: "Paper",
    paper_slug: "paper",
    ...overrides,
  };
}

describe("buildQuestionPayload — required fields", () => {
  it("rejects an empty stem", () => {
    const result = buildQuestionPayload(form({ question_text: "   " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.question_text).toBeTruthy();
  });

  it("trims the stem rather than storing the padding", () => {
    const result = buildQuestionPayload(form({ question_text: "  spaced  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.question_text).toBe("spaced");
  });

  it("rejects non-numeric marks instead of sending NaN", () => {
    // JSON.stringify({ marks: NaN }) is '{"marks":null}' -- a successful write
    // of null rather than the 422 the author expected.
    const result = buildQuestionPayload(form({ marks: "four" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.marks).toBeTruthy();
  });

  it("rejects out-of-range marks", () => {
    const over = buildQuestionPayload(form({ marks: String(MARKS_MAX + 1) }));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.errors.marks).toBeTruthy();
  });

  it("rejects a non-integer position", () => {
    const result = buildQuestionPayload(form({ sort_order: "1.5" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.sort_order).toBeTruthy();
  });

  it("keeps a decimal string as written, without passing through a float", () => {
    // 2.50 must not become 2.5, and must not be reformatted by Number().
    const result = buildQuestionPayload(form({ marks: "2.50" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.marks).toBe("2.50");
  });
});

describe("buildQuestionPayload — mcq gradeability", () => {
  it("rejects fewer than two options", () => {
    const result = buildQuestionPayload(
      form({ options: ["only"], correct_answer: "only" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toContain(String(MIN_MCQ_OPTIONS));
  });

  it("rejects a key that is not one of the options", () => {
    // The exact failure _check_gradeable exists to stop.
    const result = buildQuestionPayload(
      form({ options: ["a", "b"], correct_answer: "c" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.correct_answer).toMatch(/one of the options/i);
    }
  });

  it("rejects duplicate options", () => {
    // Two identical options make "which is correct?" unanswerable, and the
    // autograder would accept the text as the key for both.
    const result = buildQuestionPayload(
      form({ options: ["same", "same", "b", "c"], correct_answer: "same" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toMatch(/different/i);
  });

  it("rejects an oversized option", () => {
    const result = buildQuestionPayload(
      form({ options: ["x".repeat(OPTION_MAX + 1), "b"], correct_answer: "b" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeTruthy();
  });

  it("ignores empty option rows rather than saving a blank choice", () => {
    const result = buildQuestionPayload(
      form({ options: ["", "a", "  ", "b", ""], correct_answer: "a" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.options).toEqual(["a", "b"]);
  });

  it("requires a key to be chosen", () => {
    const result = buildQuestionPayload(form({ correct_answer: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.correct_answer).toBeTruthy();
  });
});

describe("buildQuestionPayload — per-type keys", () => {
  it("clears the numeric key when the type is not numeric", () => {
    // Switching numeric -> mcq must not leave a numeric_answer behind: the
    // autograder decides by question_type, so a leftover number is dead weight
    // that reads as a populated key in the editor.
    const result = buildQuestionPayload(
      form({ question_type: "mcq", numeric_answer: "42" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.numeric_answer).toBeNull();
  });

  it("clears correct_answer when the type is not mcq", () => {
    const result = buildQuestionPayload(
      form({ question_type: "numeric", numeric_answer: "42", correct_answer: "newton" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.correct_answer).toBeNull();
      expect(result.value.options).toBeNull();
    }
  });

  it("sends null rather than an empty array for a type with no options", () => {
    // An empty JSON array is a value, and would round-trip as one.
    const result = buildQuestionPayload(
      form({ question_type: "essay", numeric_answer: "", options: [] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.options).toBeNull();
  });

  it("allows a numeric question with no key, as a draft", () => {
    // Deliberate: the server permits it and routes it to manual review.
    const result = buildQuestionPayload(
      form({ question_type: "numeric", numeric_answer: "", options: [] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.numeric_answer).toBeNull();
  });

  it("rejects a negative tolerance", () => {
    // The column is an absolute margin.
    const result = buildQuestionPayload(
      form({ question_type: "numeric", numeric_answer: "1", tolerance: "-1" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.tolerance).toBeTruthy();
  });

  it("allows an essay with no options and no key", () => {
    const result = buildQuestionPayload(
      form({ question_type: "essay", options: [], correct_answer: "" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.options).toBeNull();
      expect(result.value.correct_answer).toBeNull();
    }
  });
});

describe("buildQuestionPayload — blank means null", () => {
  it("turns a blank optional field into null so it clears on update", () => {
    const result = buildQuestionPayload(
      form({ subject: "", topic: "   ", explanation: "" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subject).toBeNull();
      expect(result.value.topic).toBeNull();
      expect(result.value.explanation).toBeNull();
    }
  });

  it("rejects an oversized subject and topic", () => {
    expect(buildQuestionPayload(form({ subject: "x".repeat(101) })).ok).toBe(false);
    expect(buildQuestionPayload(form({ topic: "x".repeat(256) })).ok).toBe(false);
  });

  it("rejects an oversized difficulty", () => {
    const result = buildQuestionPayload(
      form({ difficulty: "x".repeat(DIFFICULTY_MAX + 1) }),
    );
    expect(result.ok).toBe(false);
  });

  it("defaults an empty difficulty to medium", () => {
    const result = buildQuestionPayload(form({ difficulty: "  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.difficulty).toBe("medium");
  });
});

describe("buildQuestionPayload — emits every field", () => {
  it("includes every payload key even when the form field is blank", () => {
    // The exclude_unset trap. If a key is missing from the body, PUT leaves the
    // column alone, so clearing a field depends on sending null explicitly.
    const result = buildQuestionPayload(
      form({ subject: "", topic: "", explanation: "", numeric_answer: "" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = [
      "question_text",
      "question_type",
      "options",
      "correct_answer",
      "subject",
      "topic",
      "numeric_answer",
      "tolerance",
      "marks",
      "negative_marks",
      "difficulty",
      "explanation",
      "sort_order",
    ];
    for (const key of expected) {
      expect(Object.keys(result.value)).toContain(key);
    }
    // And no key is `undefined`, which JSON.stringify would drop entirely.
    for (const key of expected) {
      expect(result.value[key as keyof typeof result.value]).not.toBeUndefined();
    }
  });

  it("survives JSON.stringify with no undefined leaking through", () => {
    const result = buildQuestionPayload(form());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const wire = JSON.parse(JSON.stringify(result.value));
    expect(Object.keys(wire).sort()).toEqual(Object.keys(result.value).sort());
  });
});

describe("questionFormFromRow", () => {
  it("round-trips a stored row back through the form", () => {
    const source = row();
    const values = questionFormFromRow(source);
    const result = buildQuestionPayload(values);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.question_text).toBe(source.question_text);
    expect(result.value.options).toEqual(source.options);
    expect(result.value.correct_answer).toBe(source.correct_answer);
    expect(result.value.subject).toBe(source.subject);
    expect(result.value.sort_order).toBe(3);
  });

  it("pads options so a stored row with none still opens a usable editor", () => {
    // A hand-edited row with no options must not render an editor with no rows
    // to type into.
    const values = questionFormFromRow(row({ options: [], correct_answer: null }));
    expect(values.options.length).toBeGreaterThanOrEqual(MIN_MCQ_OPTIONS);
  });

  it("keeps a numeric row's key so editing does not lose it", () => {
    const values = questionFormFromRow(
      row({ question_type: "numeric", options: null, correct_answer: null, numeric_answer: "42.5" }),
    );
    expect(values.question_type).toBe("numeric");
    expect(values.numeric_answer).toBe("42.5");
    const result = buildQuestionPayload(values);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.numeric_answer).toBe("42.5");
  });
});

describe("nextSortOrder", () => {
  it("appends after the paper's current count", () => {
    expect(
      nextSortOrder({ mock_test_id: 1, name: "P", slug: "p", question_count: 75 }),
    ).toBe(76);
  });

  it("starts at 1 for an unknown paper", () => {
    expect(nextSortOrder(undefined)).toBe(1);
  });
});

describe("emptyQuestionForm", () => {
  it("defaults to a valid mcq that needs no edits to be gradeable", () => {
    const result = buildQuestionPayload(
      emptyQuestionForm(1),
    );
    // Expected to fail: the blank defaults have no stem and no key yet. What
    // matters is that it fails on the fields the editor has to fill in, not on
    // something structural.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.question_text).toBeTruthy();
      expect(result.errors.correct_answer).toBeTruthy();
    }
  });

  it("positions the new question where asked", () => {
    expect(emptyQuestionForm(76).sort_order).toBe("76");
  });
});
