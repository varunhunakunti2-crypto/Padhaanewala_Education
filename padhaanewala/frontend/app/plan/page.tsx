import type { Metadata } from "next";
import { ExamPlanner } from "@/components/planner/ExamPlanner";

export const metadata: Metadata = {
  title: "Exam Planner — padhaanewala",
  description:
    "Plan your mock tests and exam dates on a calendar, so your prep progress is visible day by day.",
};

export default function PlannerPage() {
  return <ExamPlanner />;
}