import { colleges, courseOptions, states, type College } from "./colleges";

export type Category = "General" | "OBC" | "EWS" | "SC" | "ST";
export type OwnershipPref = "any" | "private" | "government";
export type Bucket = "highly-suitable" | "possible" | "reach" | "not-eligible";

export const categories: Category[] = ["General", "OBC", "EWS", "SC", "ST"];

export const ownershipOptions: { value: OwnershipPref; label: string }[] = [
  { value: "any", label: "Any type" },
  { value: "private", label: "Private" },
  { value: "government", label: "Government" },
];

export const bucketMeta: Record<
  Bucket,
  { label: string; description: string; badge: string; dot: string }
> = {
  "highly-suitable": {
    label: "Highly Suitable",
    description:
      "Your rank sits comfortably inside this college's expected closing range. Strong chance of admission.",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  possible: {
    label: "Possible",
    description:
      "Your rank is close to this college's expected closing range. Likely in earlier counselling rounds.",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  reach: {
    label: "Reach",
    description:
      "Your rank is beyond the expected range. It may convert only if cutoffs drop this year.",
    badge: "bg-orange-50 text-orange-700 ring-orange-600/20",
    dot: "bg-orange-500",
  },
  "not-eligible": {
    label: "Not eligible",
    description:
      "Your rank exceeds the expected cutoff for this college. Unlikely to be offered a seat.",
    badge: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
    dot: "bg-neutral-400",
  },
};

const bucketOrder: Bucket[] = ["highly-suitable", "possible", "reach", "not-eligible"];

type ScoreAnchor = [number, number];

export function estimateRank(anchors: ScoreAnchor[], score: number): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  const sorted = [...anchors].sort((a, b) => a[0] - b[0]);
  if (score <= sorted[0][0]) return Math.max(1, Math.round(sorted[0][1]));
  if (score > sorted[sorted.length - 1][0]) {
    const [sMax, rMax] = sorted[sorted.length - 1];
    return Math.round(rMax + (score - sMax) * 1.2);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const [s0, r0] = sorted[i];
    const [s1, r1] = sorted[i + 1];
    if (score >= s0 && score <= s1) {
      return Math.round(r0 + ((score - s0) / (s1 - s0)) * (r1 - r0));
    }
  }
  return null;
}

export type ExamRule = {
  slug: string;
  name: string;
  maxScore: number;
  courses: string[];
  scoreAnchors: ScoreAnchor[];
  bands: Record<Category, number>;
};

export const examRules: ExamRule[] = [
  {
    slug: "neet-ug",
    name: "NEET UG",
    maxScore: 720,
    courses: ["mbbs", "bds", "bams", "bhms", "bsc-nursing"],
    scoreAnchors: [
      [720, 1],
      [650, 8000],
      [600, 30000],
      [550, 70000],
      [500, 120000],
      [450, 180000],
      [400, 250000],
    ],
    bands: { General: 45000, OBC: 85000, EWS: 65000, SC: 160000, ST: 210000 },
  },
  {
    slug: "jee-main",
    name: "JEE Main",
    maxScore: 300,
    courses: ["b-tech-cse"],
    scoreAnchors: [
      [300, 1],
      [250, 10000],
      [200, 40000],
      [150, 90000],
      [100, 160000],
      [60, 250000],
    ],
    bands: { General: 60000, OBC: 100000, EWS: 80000, SC: 190000, ST: 250000 },
  },
  {
    slug: "kcet",
    name: "KCET (Karnataka)",
    maxScore: 180,
    courses: ["b-tech-cse", "mbbs", "bds", "bams", "bhms", "bsc-nursing", "b-pharm"],
    scoreAnchors: [
      [180, 1],
      [150, 3000],
      [120, 12000],
      [90, 30000],
      [60, 55000],
      [30, 80000],
    ],
    bands: { General: 25000, OBC: 45000, EWS: 35000, SC: 70000, ST: 90000 },
  },
  {
    slug: "cuet-ug",
    name: "CUET UG",
    maxScore: 800,
    courses: ["bca", "mca", "bba", "mba", "b-com", "llb", "b-pharm"],
    scoreAnchors: [
      [800, 1],
      [700, 10000],
      [600, 40000],
      [500, 90000],
      [400, 160000],
      [300, 250000],
    ],
    bands: { General: 50000, OBC: 90000, EWS: 70000, SC: 170000, ST: 220000 },
  },
];

export function examsForCourse(courseSlug: string): ExamRule[] {
  return examRules.filter((exam) => exam.courses.includes(courseSlug));
}

export const courseLabel = (slug: string): string =>
  courseOptions.find((c) => c.slug === slug)?.label ?? slug;

function jitter(collegeId: string): number {
  let hash = 0;
  for (let i = 0; i < collegeId.length; i++) {
    hash = (hash * 31 + collegeId.charCodeAt(i)) % 997;
  }
  return ((hash % 21) - 10) / 100;
}

export function parseFeesLakhs(fees: string): number | null {
  const match = fees.match(/([\d.]+)\s*L/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

export type PredictionInput = {
  course: string;
  exam: string;
  category: Category;
  rank: number;
  stateCode: string;
  budget: number | null;
  ownership: OwnershipPref;
  hostelRequired: boolean;
};

export type PredictionResult = {
  college: College;
  bucket: Bucket;
  confidence: number;
  closingRank: number;
  reasons: string[];
};

export function predictColleges(input: PredictionInput): PredictionResult[] {
  const exam = examRules.find((e) => e.slug === input.exam);
  if (!exam) return [];
  const preferredState = states.find((s) => s.code === input.stateCode);

  const pool = colleges.filter((college) => {
    if (!college.courses.includes(input.course)) return false;
    if (
      input.ownership !== "any" &&
      college.ownership.toLowerCase() !== input.ownership.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const results: PredictionResult[] = pool.map((college) => {
    const base = exam.bands[input.category];
    const quality = Math.max(0.6, Math.min(1, 1.5 - college.rating * 0.15));
    const closingRank = Math.max(1, Math.round(base * quality * (1 + jitter(college.id))));

    const ratio = input.rank / closingRank;
    let bucket: Bucket;
    if (ratio <= 0.8) bucket = "highly-suitable";
    else if (ratio <= 1.05) bucket = "possible";
    else if (ratio <= 1.45) bucket = "reach";
    else bucket = "not-eligible";

    let baseConfidence: number;
    let verdict: string;
    if (bucket === "highly-suitable") {
      baseConfidence = 90;
      verdict = "Rank sits comfortably below the expected closing range.";
    } else if (bucket === "possible") {
      baseConfidence = 72;
      verdict = "Rank is close to the expected closing range — likely in later rounds.";
    } else if (bucket === "reach") {
      baseConfidence = 50;
      verdict = "Rank is beyond the expected range — may convert only if cutoffs drop.";
    } else {
      baseConfidence = 26;
      verdict = "Rank is well beyond the expected cutoff for this college.";
    }

    const reasons: string[] = [verdict];

    const fees = parseFeesLakhs(college.fees);
    if (input.budget && fees && fees > input.budget) {
      if (bucket === "highly-suitable") bucket = "possible";
      else if (bucket === "possible") bucket = "reach";
      reasons.push(`Annual fees (${college.fees}) are above your ₹${input.budget} L budget.`);
    }

    if (input.hostelRequired && !college.hasHostel) {
      reasons.push("No hostel facility is available at this college.");
    }

    if (preferredState) {
      if (college.stateCode === preferredState.code) {
        reasons.push(`Located in your preferred state — ${preferredState.name}.`);
      } else {
        reasons.push(`Located in ${college.location} (outside your preferred state).`);
      }
    } else {
      reasons.push(`Located in ${college.location}.`);
    }

    reasons.push(
      `Estimated closing rank for ${exam.name} (${input.category}): #${closingRank.toLocaleString(
        "en-IN",
      )}.`,
    );

    let confidence = baseConfidence - (ratio > 0.8 ? (ratio - 0.8) * 40 : 0);
    confidence += jitter(college.id) * 25;
    confidence = Math.max(4, Math.min(97, Math.round(confidence)));

    return { college, bucket, confidence, closingRank, reasons };
  });

  return results.sort((a, b) => {
    const bucketDiff = bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket);
    return bucketDiff !== 0 ? bucketDiff : b.confidence - a.confidence;
  });
}