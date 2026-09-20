import { Metadata } from "next";
import { MockTestEngine } from "@/components/mocktests/MockTestEngine";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";

export const metadata: Metadata = {
  title: "Mock Tests",
  description:
    "Attempt free exam-style mock tests for JEE Main, NEET, CAT and more. Get instant score, percentile, topic-wise analysis and full solutions.",
  openGraph: {
    title: "Free Mock Tests — padhaanewala",
    description:
      "Practice with realistic mock tests and improve your entrance exam scores with detailed analytics.",
  },
};

export default function MockTestsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Mock Tests
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-slate-300">
          Practice full-length and section-wise mock tests with a real exam timer. View your score,
          percentile, topic-wise performance and step-by-step solutions instantly.
        </p>
      </div>
      <MockTestEngine />
      <div className="pt-6">
        <AdmissionHelpBanner />
      </div>
    </section>
  );
}