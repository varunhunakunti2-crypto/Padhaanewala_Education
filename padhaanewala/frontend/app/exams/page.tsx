import { Metadata } from "next";
import { ExamsExplorer } from "@/components/exams/ExamComponents";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";

export const metadata: Metadata = {
  title: "Exams",
  description:
    "Browse all major entrance examinations in India — JEE Main, JEE Advanced, NEET UG, CUET, BITSAT, GATE, CAT, CLAT and more. Check eligibility, dates, pattern and fees.",
  openGraph: {
    title: "Entrance Exams Calendar — padhaanewala",
    description:
      "Complete exam listings with registration dates, exam pattern, eligibility and official websites.",
  },
};

export default function ExamsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 sm:text-4xl">
          Entrance Exams
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">
          Track registration windows, exam dates and results for all major national and state-level
          entrance examinations in India.
        </p>
      </div>
      <ExamsExplorer />
      <AdmissionHelpBanner />
    </section>
  );
}