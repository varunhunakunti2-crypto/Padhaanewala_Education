import type { Exam } from "@/lib/types";
import { matchesTokens, searchTokens } from "./index";

export const EXAMS: Exam[] = [];

export const EXAM_STAGES = ["Registration Open", "Registration Closed", "Admit Cards Out", "Results Declared"] as const;

export function getExamBySlug(slug: string): Exam | undefined {
  return EXAMS.find((e) => e.slug === slug);
}

/**
 * Fields an exam is matched on.
 *
 * `mapExam` fills `name`, `shortName`, `conductingBody`, `type` and `overview`
 * from the API row, so those carry real text. `coursesAccepted` and
 * `collegesAccepting` are hard-coded to `[]` there and were included here
 * anyway — two permanently-empty arms of the haystack that read as if the
 * search covered them.
 */
function examHaystack(e: Exam): string {
  return [
    e.name,
    e.shortName,
    e.type,
    e.level,
    e.conductingBody,
    e.overview,
    e.eligibility,
  ].join(" ");
}

/**
 * Filter a supplied exam list by query.
 *
 * ## Why this takes the dataset
 *
 * The signature used to be `searchExams(query)` with no dataset, filtering the
 * bundled `EXAMS` — which is `[]`. `ExamsExplorer` therefore called it as
 * `list ?? searchExams(query)`, and since `app/exams/page.tsx` always passes a
 * resolved `list`, the query was **never applied**. Typing in the search box did
 * nothing on `/exams`, and the "No exams match your search" empty state was
 * unreachable except when the API itself returned nothing.
 *
 * Filtering the list it is actually given is the fix, and it also matches how
 * `searchCourses` and `searchColleges` already work.
 *
 * Tokenisation is AND, shared with the colleges path, so `"jee mains"` matches
 * an exam carrying both words in either order.
 */
export function searchExams(
  query: string,
  exams: Exam[] = EXAMS,
): Exam[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return exams;
  return exams.filter((e) => matchesTokens(examHaystack(e), tokens));
}