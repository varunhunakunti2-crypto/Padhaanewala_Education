"use client";

/**
 * Placeholder demo data for admin panels that have no API wiring yet.
 * These are NOT real records — they must not be presented as live data.
 */



export const SAMPLE_STUDENTS = [
  { id: "s1", name: "Rahul Sharma", mobile: "98765 43210", state: "Maharashtra", course: "B.Tech CSE", status: "Active" },
  { id: "s2", name: "Priya Menon", mobile: "99887 76655", state: "Tamil Nadu", course: "B.Sc Nursing", status: "Active" },
  { id: "s3", name: "Arjun Bose", mobile: "91234 56780", state: "West Bengal", course: "MBA", status: "Inactive" },
  { id: "s4", name: "Sneha Iyer", mobile: "97654 32100", state: "Karnataka", course: "B.Pharm", status: "Active" },
  { id: "s5", name: "Rohit Verma", mobile: "98675 43210", state: "Rajasthan", course: "B.Tech CSE", status: "Lead" },
] as const;

export const SAMPLE_COUNSELLORS = [
  { id: "c1", name: "Anita Sharma", region: "North India", leads: 142, converted: 61, rating: 4.8 },
  { id: "c2", name: "Ravi Kumar", region: "South India", leads: 128, converted: 54, rating: 4.6 },
  { id: "c3", name: "Meera Pillai", region: "West India", leads: 156, converted: 70, rating: 4.9 },
  { id: "c4", name: "Karan Mehta", region: "East India", leads: 98, converted: 40, rating: 4.4 },
] as const;

export const SAMPLE_QUESTIONS = [
  { id: "q1", test: "JEE Main Physics", text: "The SI unit of force is:", type: "MCQ", difficulty: "Easy", topic: "Mechanics" },
  { id: "q2", test: "NEET Biology", text: "DNA replication occurs in which phase?", type: "MCQ", difficulty: "Medium", topic: "Genetics" },
  { id: "q3", test: "CAT Reasoning", text: "Which number follows: 2, 6, 12, 20, ?", type: "MCQ", difficulty: "Hard", topic: "Analogy" },
  { id: "q4", test: "MHT-CET Chemistry", text: "The pH of a 0.001 M HCl solution is:", type: "MCQ", difficulty: "Easy", topic: "Physical Chemistry" },
] as const;

export const BANNERS_DEMO = ["Admission Open CTA", "Scholarship Alert", "College Predictor Promo"];
