import type { Faq } from "@/lib/types";

export interface CourseDetailMeta {
  slug: string;
  eligibility: string[];
  admissionProcedure: string[];
  entranceExams: string[];
  entranceExamNote: string;
  careerOpportunities: string[];
  careerSectors: string[];
  topRecruiters: string[];
  faqs: Faq[];
  relatedSlugs: string[];
}

export const COURSE_DETAILS: Record<string, CourseDetailMeta> = {};