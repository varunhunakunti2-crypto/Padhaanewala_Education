import type { Metadata } from "next";
import { ReviewsExplorer } from "@/components/reviews/ReviewsExplorer";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveColleges } from "@/lib/content";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "College Reviews",
  description:
    "Read and write reviews for colleges across India. See ratings for academics, placements, campus life and more from students and alumni.",
  path: "/reviews",
});

export default async function ReviewsPage() {
  const { data: colleges } = await resolveColleges();

  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Reviews", path: "/reviews" },
    ]),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <JsonLd data={jsonLd} />
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
