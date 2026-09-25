import type { Metadata } from "next";
import { PredictorForm } from "@/components/predictor/PredictorForm";
import { resolveColleges } from "@/lib/content";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "AI College Predictor",
    description: `Enter your entrance exam rank, course preference, state and budget to get a personalised list of colleges matching your profile. Use ${SITE.name}'s AI College Predictor.`,
    openGraph: {
      title: `AI College Predictor — ${SITE.name}`,
      description:
        "Find colleges matching your rank, course and location preferences with data-driven prediction.",
    },
  };
}

export default async function PredictorPage() {
  const { data: colleges } = await resolveColleges();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="mb-8 text-center">
        <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 px-3.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 2 L2 12 h5 v8 h10 v-8 h5 Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Powered by curated data
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          AI College Predictor
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 dark:text-slate-300">
          Enter your entrance exam rank, preferred course, state and budget. We score{" "}
          {colleges.length.toLocaleString("en-IN")} colleges in our catalogue against your profile and
          rank the best fits.
        </p>
      </div>
      <PredictorForm colleges={colleges} />
    </section>
  );
}
