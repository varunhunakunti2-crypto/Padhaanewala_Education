/** Shared admin console types and constants. */

export type SectionKey =
  | "dashboard"
  | "colleges"
  | "courses"
  | "scholarships"
  | "exams"
  | "mocktests"
  | "questions"
  | "students"
  | "reviews"
  | "blogs"
  | "faqs"
  | "banners"
  | "notifications"
  | "leads"
  | "counsellors"
  | "media"
  | "seo"
  | "settings"
  | "audit"
  | "analytics";

export type StudentRow = {
  id: string;
  name: string;
  mobile: string;
  state: string;
  course: string;
  status: string;
};

export type CourseMetaLevel = "UG" | "PG" | "Doctoral" | "Diploma";

export const LEVELS: readonly CourseMetaLevel[] = ["UG", "PG", "Doctoral", "Diploma"];
