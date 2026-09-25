import type { Metadata } from "next";
import { ReviewsExplorer } from "@/components/reviews/ReviewsExplorer";
import { resolveColleges } from "@/lib/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "College Reviews",
  description:
    "Read and write reviews for colleges across India. See ratings for academics, placements, campus life and more from students and alumni.",
  openGraph: {
    title: `College Reviews — ${SITE.name}`,
    description:
      "Real student and alumni reviews for colleges in India. Rate and review your college.",
  },
};

export default async function ReviewsPage() {
  const { data: colleges } = await resolveColleges();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          College Reviews
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-slate-300">
          Unfiltered experiences from students and alumni across courses, placements, faculty and campus life.
        </p>
      </div>
      <ReviewsExplorer colleges={colleges} />
    </section>
  );
}