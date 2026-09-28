import type { Metadata } from "next";
import { ExamPlanner } from "@/components/planner/ExamPlanner";
import { BETA_NOINDEX } from "@/lib/nav";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Exam Planner — ${SITE.name}`,
  description:
    "Plan your mock tests and exam dates on a calendar, so your prep progress is visible day by day.",
  ...BETA_NOINDEX,
};

export default function PlannerPage() {
  return <ExamPlanner />;
}