import { Metadata } from "next";
import { BLOG_CATEGORIES, BLOG_POSTS } from "@/lib/data/blog";
import { BlogExplorer } from "@/components/blog/BlogExplorer";
import { AiPromoCard } from "@/components/ai/AIChat";

export const metadata: Metadata = {
  title: "Blog & Resources",
  description:
    "Articles and guides on admissions, NEET, AYUSH, scholarships, careers, exams and college guides from the Padhaanewala editorial team.",
  openGraph: {
    title: "Blog & Resources — padhaanewala",
    description:
      "Expert guides on college admissions, entrance exams, scholarships and careers in India.",
  },
};

export default function BlogPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 sm:text-4xl">
            Blog & Resources
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            Guides, news and expert advice to help you make smarter education decisions.
          </p>
        </div>
        <div className="w-full lg:w-80">
          <AiPromoCard />
        </div>
      </div>
      <BlogExplorer posts={BLOG_POSTS} categories={BLOG_CATEGORIES} />
    </section>
  );
}