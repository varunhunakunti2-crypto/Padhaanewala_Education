import type { MockTest, MockTestQuestion } from "@/lib/types";

export interface QuestionBankItem {
  id: string;
  topic: string;
  subject: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUESTION_BANK: QuestionBankItem[] = [];

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

export const MOCK_TESTS: MockTest[] = [];

export const MOCK_EXAM_GROUPS: { exam: string; slug: string }[] = [];

export function getMockTest(slug: string): MockTest | undefined {
  return MOCK_TESTS.find((t) => t.slug === slug);
}

export function getTestQuestions(test: MockTest): MockTestQuestion[] {
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
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    topic: q.topic,
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