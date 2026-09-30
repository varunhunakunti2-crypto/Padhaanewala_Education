import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format Indian rupee amounts: 820000 -> "₹8.2 L" */
export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return `₹${amount}`;
}

/** Format full rupee value: 820000 -> "₹8,20,000" (Indian grouping) */
export function formatINRFull(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

/** Compact number: 18430 -> "18.4K", 1200000 -> "1.2M" */
export function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const GOLD = new Set(["gold", "golden", "yellow", "amber", "champagne", "orange"]);

/** Deterministic pick from an array using a seed string */
export function seededPick<T>(seed: string, arr: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function seededSlice<T>(seed: string, arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    let h = 0;
    const s = seed + i;
    for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function closestBreakpointLabel(fee: number): string {
  if (fee < 50000) return "Under ₹50K";
  if (fee < 150000) return "₹50K – ₹1.5L";
  if (fee < 300000) return "₹1.5L – ₹3L";
  if (fee < 600000) return "₹3L – ₹6L";
  return "₹6L+";
}

/**
 * Honest, data-derived strength signal for a college.
 *
 * The previous implementation was `88 + (hash(id) % 12)` — a deterministic hash
 * of the college id that produced a plausible-looking "88–99% match" badge for
 * every institution regardless of any real signal, and was presented to users as
 * a personalised score. That has been removed.
 *
 * This derives a 0–100 score from attributes actually present in the record, so
 * an institution with no placement, rating or accreditation data cannot score
 * highly. Callers must label it as a strength indicator, never as a match.
 */
export function strengthScore(college: {
  rating: number;
  reviewCount: number;
  placement: { placementRate: number };
  accreditation: string[];
  sector: string;
  founded: number;
}): number {
  let s = 0;

  // Rating is the heaviest signal, but only once it is backed by real reviews.
  if (college.rating > 0) {
    s += (college.rating / 5) * 40;
    // Confidence ramps up to 50 reviews; below that the rating is thin evidence.
    s += Math.min(college.reviewCount / 50, 1) * 10;
  }

  if (college.placement.placementRate > 0) {
    s += Math.min(college.placement.placementRate / 100, 1) * 25;
  }

  s += Math.min(college.accreditation.length, 2) * 5;
  if (college.sector === "Government") s += 5;
  if (college.founded > 0 && new Date().getFullYear() - college.founded >= 25) s += 5;

  return Math.round(Math.min(100, s));
}

export type StrengthLabel = "Excellent" | "Strong" | "Fair" | "Limited data";

export function strengthLabel(score: number): StrengthLabel {
  if (score >= 75) return "Excellent";
  if (score >= 55) return "Strong";
  if (score >= 35) return "Fair";
  return "Limited data";
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase();
}

export function formatDate(input: string): string {
  const d = new Date(input);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Neutral object brand colors for campus banners, keyed to data.gradientId */
export const BANNER_GRADIENTS: Record<string, string> = {
  g0: "from-indigo-700 via-purple-600 to-blue-600",
  g1: "from-purple-700 to-blue-500",
  g2: "from-orange-600 to-amber-400",
  g3: "from-amber-500 to-yellow-400",
  g4: "from-violet-700 to-indigo-600",
  g5: "from-blue-700 to-indigo-500",
  g6: "from-orange-700 to-amber-500",
  g7: "from-purple-800 to-violet-500",
};

export function isGoldWord(word: string): boolean {
  return GOLD.has(word.toLowerCase());
}