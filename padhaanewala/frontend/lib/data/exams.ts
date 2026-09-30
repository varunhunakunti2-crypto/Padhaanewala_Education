import type { Exam } from "@/lib/types";

export const EXAMS: Exam[] = [];

export const EXAM_STAGES = ["Registration Open", "Registration Closed", "Admit Cards Out", "Results Declared"] as const;

export function getExamBySlug(slug: string): Exam | undefined {
  return EXAMS.find((e) => e.slug === slug);
}

export function searchExams(query: string): Exam[] {
  const q = query.toLowerCase().trim();
  if (!q) return EXAMS;
  return EXAMS.filter((e) =>
    [e.name, e.shortName, e.type, e.conductingBody, ...e.coursesAccepted]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}