import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CalendarIcon, ClockIcon } from "@/components/icons";
import { articles } from "@/data/blog";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return { title: "Article Not Found" };
  return {
    title: article.title,
    description: article.excerpt,
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  const relatedArticles = articles
    .filter((a) => a.slug !== article.slug && a.category === article.category)
    .slice(0, 3);
  const moreArticles = relatedArticles.length > 0 ? relatedArticles : articles.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/blog" className="hover:text-neutral-900">
              Blog
            </Link>{" "}
            / <span className="text-neutral-900">{article.category}</span>
          </nav>

          <span className="mt-6 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            {article.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {article.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
            <span className="font-medium text-neutral-800">{article.author}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {article.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {article.readTime}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-base leading-8 text-neutral-700 sm:text-lg">{article.excerpt}</p>

        <div className="mt-8 border-t border-black/5 pt-8">
          <h2 className="text-lg font-bold tracking-tight text-neutral-950">
            Follow along with Padhaanewala
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            Stay on top of the latest admission dates, cutoffs and career guidance. Use the tools
            linked on this page — college predictor, mock tests and verified college data — to
            convert this guide into an admission plan.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/college-predictor"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              College predictor
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/mock-tests"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-950 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              Mock tests
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="border-t border-black/5 pt-10">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">
            More in {article.category}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moreArticles.map((a) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                  {a.category}
                </span>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                  {a.title}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{a.excerpt}</p>
                <p className="mt-3 text-xs text-neutral-500">
                  {a.date} · {a.readTime}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}