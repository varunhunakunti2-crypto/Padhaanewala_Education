import type { Metadata } from "next";
import { BLOG_CATEGORIES } from "@/lib/data/blog";
import { BlogExplorer } from "@/components/blog/BlogExplorer";
import { AiPromoCard } from "@/components/ai/AIChat";
import { resolveBlogPosts } from "@/lib/content";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Blog & Resources",
    description:
      "Articles and guides on admissions, NEET, AYUSH, scholarships, careers, exams and college guides from the Padhaanewala editorial team.",
    openGraph: {
      title: `Blog & Resources — ${SITE.name}`,
      description:
        "Expert guides on college admissions, entrance exams, scholarships and careers in India.",
    },
  };
}

export default async function BlogPage() {
  const { data: posts } = await resolveBlogPosts();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
            Blog & Resources
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-slate-300">
            Guides, news and expert advice to help you make smarter education decisions.
          </p>
        </div>
        <div className="w-full lg:w-80">
          <AiPromoCard />
        </div>
      </div>
      <BlogExplorer posts={posts} categories={BLOG_CATEGORIES} />
    </section>
  );
}
