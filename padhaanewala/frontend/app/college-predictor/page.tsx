import { Metadata } from "next";
import { PredictorForm } from "@/components/predictor/PredictorForm";

export const metadata: Metadata = {
  title: "AI College Predictor",
  description:
    "Enter your entrance exam rank, course preference, state and budget to get a personalised list of colleges matching your profile. Use Padhaanewala's AI College Predictor.",
  openGraph: {
    title: "AI College Predictor — padhaanewala",
    description:
      "Find colleges matching your rank, course and location preferences with AI-powered prediction.",
  },
};

export default function PredictorPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8 text-center">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 2 L2 12 h5 v8 h10 v-8 h5 Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Powered by curated data
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 sm:text-4xl">
          AI College Predictor
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          Enter your entrance exam rank, preferred course, state and budget.
          Our AI engine will map your profile against 12,000+ colleges and recommend the best fits.
        </p>
      </div>
      <PredictorForm />
    </section>
  );
}