import type { College, PredictorInput, PredictResult } from "@/lib/types";
import { COLLEGES } from "./colleges";

const COURSE_KEYWORDS: Record<string, string[]> = {
  "b.tech": ["b.tech", "b.e.", "engineering"],
  "computer science": ["computer science", "computer", "information technology", "it"],
  "cse": ["computer science"],
  "mba": ["mba", "management", "business"],
  "bba": ["bba", "business"],
  "b.pharm": ["pharm", "pharmacy"],
  "b.sc": ["b.sc", "science"],
  "medical": ["medical", "mbbs", "nursing", "health"],
  "nursing": ["nursing"],
  "law": ["llb", "law"],
  "mechanical": ["mechanical"],
  "electronics": ["electronics", "ece", "electrical"],
  "civil": ["civil"],
};

function matchesCourse(c: College, course: string): boolean {
  if (!course) return true;
  const bears = COURSE_KEYWORDS[course.toLowerCase()] ?? [course.toLowerCase()];
  return c.courses.some((co) =>
    bears.some((b) =>
      [co.name, co.degree, co.specialization].join(" ").toLowerCase().includes(b),
    ),
  );
}

function parseBudget(budget: string): number | null {
  const m = budget.replace(/,/g, "").match(/(\d+(\.\d+)?)\s*(l|k|cr|thousand)?/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = (m[3] || "").toLowerCase();
  if (unit === "cr") return value * 10000000;
  if (unit === "l") return value * 100000;
  if (unit === "k") return value * 1000;
  return value;
}

function parseRank(exam: string, raw: string): { rank: number | null; score: number | null } {
  const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!num || Number.isNaN(num)) return { rank: null, score: null };
  const lower = raw.toLowerCase();
  if (lower.includes("percentile")) return { rank: null, score: num };
  if (lower.includes("rank") || lower.includes("air") || lower.includes("rank ")) return { rank: num, score: null };
  const mainstream = ["jee", "neet", "gate", "cat", "wbjee"].some((e) => exam.toLowerCase().includes(e));
  return mainstream ? { rank: num, score: null } : { rank: null, score: num };
}

export function predictColleges(
  input: PredictorInput,
  dataset: College[] = COLLEGES,
): PredictResult {
  const budgetMax = parseBudget(input.budget);

  let pool = dataset.filter((c) => matchesCourse(c, input.course));

  if (input.exam) {
    const exam = input.exam.toLowerCase();
    const examMatched = pool.filter((c) =>
      c.admission.entranceExams.some((e) => e.toLowerCase().includes(exam) || exam.includes(e.toLowerCase())),
    );
    if (examMatched.length) pool = examMatched;
  }

  if (input.sectorPref !== "Any") pool = pool.filter((c) => c.sector === input.sectorPref);
  if (input.state && input.state !== "All India") pool = pool.filter((c) => c.state === input.state);
  if (input.preferredCity && input.preferredCity !== "Any city") {
    pool = pool.filter((c) => c.city === input.preferredCity);
  }
  if (input.hostel === true) pool = pool.filter((c) => c.facilities.hostel === true);
  if (budgetMax !== null) pool = pool.filter((c) => Math.min(...c.courses.map((x) => x.feePerYear)) <= budgetMax);

  const { rank, score } = parseRank(input.exam, input.rankOrScore);

  const scored = pool.map((c) => {
    let s = 0;
    s += c.rating * 10;
    s += c.placement.placementRate;
    s += Math.min(c.reviewCount / 2000, 15);
    if (c.sector === "Government") s += 5;

    let tier = 0;
    const isIit = c.type.includes("Institute of National Importance") || c.gradientId === "g0";
    if (isIit && c.initials?.includes("IIT")) tier = 1;
    else if (c.type.includes("Institute of National Importance") || c.shortName.includes("IIIT")) tier = 1;
    else if (c.sector === "Government") tier = 2;
    else tier = 3;

    if (rank !== null) {
      if (tier === 1 && rank <= 5000) s += 40;
      else if (tier === 1 && rank <= 15000) s += 20;
      else if (tier === 2 && rank <= 15000) s += 35;
      else if (tier === 2 && rank <= 40000) s += 15;
      else if (tier === 3 && rank <= 100000) s += 30;
      else s -= 8;
    } else if (score !== null) {
      if (score >= 98) s += 40;
      else if (score >= 92) s += 25;
      else if (score >= 80) s += 10;
      else s -= 5;
    }

    // Previously added `matchScore(id) / 10` — a hash of the college id that
    // injected 8.8–9.9 points of pure noise into every candidate. The real
    // signals above are already weighted; adding a constant per college just
    // shuffled the ranking arbitrarily.
    return { college: c, score: s, tier };
  });

  scored.sort((a, b) => b.score - a.score);

  const highlySuitable = scored.slice(0, 5).map((x) => x.college);
  const possible = scored.slice(5, 10).map((x) => x.college);
  const reach = scored.slice(10, 16).map((x) => x.college);

  if (scored.length === 0) {
    return { highlySuitable: [], possible: [], reach: COLLEGES.slice(0, 3) };
  }

  return { highlySuitable, possible, reach };
}

export function predictorSuggestions(course: string): College[] {
  return COLLEGES.filter((c) => matchesCourse(c, course)).slice(0, 6);
}

export const PREDICTOR_QUESTIONS = [
  "What course are you targeting?",
  "Which entrance exam will you appear for?",
  "What is your expected rank or score?",
  "Select your category",
  "Which state are you from?",
  "Any preferred city?",
  "Annual budget for tuition (per year)?",
  "Government or private preference?",
  "Do you need hostel facilities?",
  "Any additional preferences?",
] as const;