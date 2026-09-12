import CollegePredictor from "@/components/predictor/CollegePredictor";
import { SparklesIcon } from "@/components/icons";

export const metadata = {
  title: "AI College Predictor",
  description:
    "Predict which colleges you can realistically get into using your exam rank or score, category, budget and preferences.",
};

export default function CollegePredictorPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
            <SparklesIcon className="h-3.5 w-3.5" />
            Free · No sign-up needed
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            College Predictor
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Enter your exam rank or score and get a realistic shortlist of
            colleges — grouped by your chances and matched to your budget,
            state and preferences.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Results are estimates based on previous year cutoff trends — not
            guaranteed admissions.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CollegePredictor />
      </section>
    </div>
  );
}