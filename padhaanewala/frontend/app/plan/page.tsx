import type { Metadata } from "next";
import { ExamPlanner } from "@/components/planner/ExamPlanner";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Exam Planner",
  description:
    "Plan your mock tests and exam dates on a calendar, so your prep progress is visible day by day.",
  path: "/plan",
  noindex: true,
});

export default function PlannerPage() {
  return <ExamPlanner />;
}
