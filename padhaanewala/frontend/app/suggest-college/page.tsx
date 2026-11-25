import type { Metadata } from "next";
import { PredictorForm } from "@/components/predictor/PredictorForm";
import { resolveColleges } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

/**
 * `/suggest-college` is the student-facing questionnaire: answer a few
 * questions and get a ranked shortlist of colleges.
 *
 * It used to redirect to `/add-college`, which is the *college owner's*
 * submission tool — a different job with a different audience. Keeping that
 * alias meant anyone following the "suggest a college" wording landed on a
 * form for adding a college to the catalogue. The two routes are now separate:
 * this one renders the predictor, and `/add-college` remains the reviewed
 * submission workflow. `noindex` avoids two near-identical public entries.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Suggest Colleges For Me",
    description:
      "Answer a short questionnaire about your course, rank, budget and preferences to get a personalised shortlist of colleges.",
    path: "/suggest-college",
    noindex: true,
  });
}

export default async function SuggestCollegePage() {
  const { data: colleges } = await resolveColleges();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="mb-8 text-center">
        <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 px-3.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
          Guided college suggestions
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Find colleges that fit you
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 dark:text-slate-300">
          Tell us what you are looking for. We score {colleges.length.toLocaleString("en-IN")}{" "}
          colleges in our catalogue and show the closest matches.
        </p>
      </div>
      <PredictorForm colleges={colleges} />
    </section>
  );
}
