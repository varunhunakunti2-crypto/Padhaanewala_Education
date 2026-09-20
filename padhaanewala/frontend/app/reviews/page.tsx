import { Metadata } from "next";
import { ReviewsExplorer } from "@/components/reviews/ReviewsExplorer";

export const metadata: Metadata = {
  title: "College Reviews",
  description:
    "Read and write reviews for colleges across India. See ratings for academics, placements, campus life and more from students and alumni.",
  openGraph: {
    title: "College Reviews — padhaanewala",
    description:
      "Real student and alumni reviews for colleges in India. Rate and review your college.",
  },
};

export default function ReviewsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 sm:text-4xl">
          College Reviews
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">
          Unfiltered experiences from students and alumni across courses, placements, faculty and campus life.
        </p>
      </div>
      <ReviewsExplorer />
    </section>
  );
}