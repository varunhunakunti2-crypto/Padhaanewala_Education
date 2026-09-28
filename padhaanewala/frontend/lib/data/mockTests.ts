import type { MockTest, MockTestQuestion } from "@/lib/types";
import bank from "./mockTests.json";

export interface QuestionBankItem {
  id: string;
  topic: string;
  subject: string;
  text: string;
  type?: "mcq" | "numeric";
  options: string[];
  correctIndex: number;
  numericAnswer?: number;
  explanation: string;
}

/**
 * Content lives in `mockTests.json`, not here.
 *
 * That file is the single source of truth, shared with
 * `backend/scripts/seed_mock_tests.py`, which loads the same papers and questions
 * into Postgres. The `subject`/`topic`/`numericAnswer` columns on
 * `test_questions` only mean anything if the questions that carry them actually
 * exist, and until this file was extracted the only copy of them was a TypeScript
 * array the backend could not read.
 *
 * The mapping below is deliberately faithful: it reconstructs the exact objects
 * this module used to build inline, including omitting `type` and `numericAnswer`
 * for non-numeric questions rather than setting them to `"mcq"`/`null`. Callers
 * such as `isNumericQuestion` test for `"numeric"`, and the runner treats a
 * present-but-null `numericAnswer` as a real key. `topic` is still a required
 * `MockTestQuestion` field, so the subject stands in for it where the source
 * data has no finer-grained topic.
 */
interface RawQuestion {
  ref: string;
  subject: string;
  topic: string;
  text: string;
  type: "mcq" | "numeric";
  options: string[];
  correctIndex: number;
  numericAnswer: number | null;
  tolerance: number;
  explanation: string;
}

interface RawPaper {
  slug: string;
  title: string;
  examLabel: string;
  examSlug: string;
  /** Slug of the real `exams` row, used by the backend seed only. */
  examRef: string | null;
  subject: string | null;
  difficulty: string;
  durationMinutes: number;
  attemptsAllowed: number;
  marksPerCorrect: number;
  marksPerWrong: number;
  resultVisibility: string;
  testType: string;
  description: string;
  instructions: string | null;
  questions: RawQuestion[];
}

const PAPERS = bank.papers as RawPaper[];

function toBankItem(q: RawQuestion): QuestionBankItem {
  return {
    id: q.ref,
    subject: q.subject,
    topic: q.topic,
    text: q.text,
    ...(q.type === "numeric" ? { type: "numeric" as const } : {}),
    options: q.options,
    correctIndex: q.correctIndex,
    ...(q.numericAnswer === null ? {} : { numericAnswer: q.numericAnswer }),
    explanation: q.explanation,
  };
}

/**
 * Flat bank in paper order. `getTestQuestions` resolves a paper's `questionIds`
 * through this list, so the position of each entry is load-bearing: the paper is
 * served to the student exactly as printed, subject by subject.
 */
export const QUESTION_BANK: QuestionBankItem[] = PAPERS.flatMap((p) =>
  p.questions.map(toBankItem),
);

const bySubject = (subject: string) => QUESTION_BANK.filter((q) => q.subject === subject);

function pickDeterministic(seed: string, items: QuestionBankItem[], count: number): QuestionBankItem[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    let h = 0;
    const s = seed + i;
    for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function seedId(slug: string, subject: string): string {
  return slug + "::" + subject;
}

/**
 * "Hardcore JEE Mock Test — Paper 2" (JEE Main 2026 pattern).
 *
 * Transcribed from `data/Hardcore_JEE_Mock_Paper_2_2026.pdf`, which the paper
 * itself describes as an original practice bank and *not* an official JEE
 * paper. Marking is JEE Main's: +4 correct, −1 incorrect, 0 unattempted, for
 * 75 questions × 4 = 300 marks in 180 minutes. Every subject carries 20 MCQs
 * followed by 5 numerical-value questions.
 *
 * Ordering is load-bearing: `MOCK_TESTS` derives its `questionIds` from the
 * array order, so the paper is served to the student exactly as printed.
 */
export const MOCK_TESTS: MockTest[] = PAPERS.map((p) => {
  const ids = p.questions.map((q) => q.ref);
  return {
    id: p.slug,
    slug: p.slug,
    title: p.title,
    exam: p.examLabel,
    examSlug: p.examSlug,
    // A three-subject paper has no single subject; the backend stores NULL for
    // the same reason and each question carries its own.
    subject: p.subject ?? "Full Syllabus",
    difficulty: (p.difficulty === "easy" ? "Easy" : p.difficulty === "hard" ? "Hard" : "Medium") as
      MockTest["difficulty"],
    questionCount: p.questions.length,
    durationMins: p.durationMinutes,
    description: p.description,
    topics: Array.from(new Set(p.questions.map((q) => q.subject))),
    attempts: 0,
    marksPerCorrect: p.marksPerCorrect,
    marksPerWrong: p.marksPerWrong,
    questionIds: ids,
  };
});

export const MOCK_EXAM_GROUPS: { exam: string; slug: string }[] = [];

export function getMockTest(slug: string): MockTest | undefined {
  return MOCK_TESTS.find((t) => t.slug === slug);
}

export function isNumericQuestion(q: MockTestQuestion): boolean {
  return q.type === "numeric";
}

/** Marks for a test, falling back to the +3 / −1 default it has always used. */
export function resolveMarks(test: MockTest): { correct: number; wrong: number } {
  return { correct: test.marksPerCorrect ?? 3, wrong: test.marksPerWrong ?? 1 };
}

export function getTestQuestions(test: MockTest): MockTestQuestion[] {
  if (test.questionIds?.length) {
    const ordered = test.questionIds
      .map((id) => QUESTION_BANK.find((q) => q.id === id))
      .filter((q): q is QuestionBankItem => q !== undefined);
    if (ordered.length) return ordered;
  }

  const subjects = test.subject === "Full Syllabus"
    ? ["Physics", "Chemistry", "Mathematics"]
    : test.subject === "Reasoning + Quant"
      ? ["Reasoning"]
      : [test.subject];

  const pools = subjects.flatMap((s) => bySubject(s));
  const picked = pickDeterministic(seedId(test.slug, test.subject), pools, test.questionCount);
  return picked.map((q, i) => ({
    id: `${test.slug}-q${i + 1}`,
    text: q.text,
    type: q.type,
    options: q.options,
    correctIndex: q.correctIndex,
    numericAnswer: q.numericAnswer,
    explanation: q.explanation,
    topic: q.topic,
    subject: q.subject,
  }));
}

/**
 * Removed on purpose.
 *
 * This returned `pct * 0.92 + 8`, capped just under 100 — a formula that turned
 * any raw score into a confident-looking percentile. A percentile is a claim
 * about where you rank against every other test-taker, and there is no cohort
 * data in this project to support one, so every number it produced was invented.
 * Callers should show the score and the percentage obtained, which are
 * derivable from the test itself, or nothing.
 */
