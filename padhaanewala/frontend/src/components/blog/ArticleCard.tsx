import Link from "next/link";
import { ArrowRightIcon, CalendarIcon, ClockIcon } from "@/components/icons";
import type { Article } from "@/data/blog";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
        {article.category}
      </span>
      <h2 className="mt-3 text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
        {article.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{article.excerpt}</p>
      <div className="mt-auto flex items-center gap-3 border-t border-black/5 pt-4 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          {article.date}
        </span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          {article.readTime}
        </span>
        <span className="ml-auto flex items-center gap-1 font-medium text-neutral-700">
          Read <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-violet-700 to-fuchsia-700 p-8 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-10 lg:flex-row lg:items-center"
    >
      <div className="max-w-2xl">
        <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
          Featured · {article.category}
        </span>
        <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {article.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/80 sm:text-base">
          {article.excerpt}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/70">
          <span>{article.author}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {article.date}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {article.readTime}
          </span>
        </div>
      </div>
      <span className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-white px-6 text-sm font-bold text-neutral-950 transition-transform group-hover:scale-105 lg:self-auto">
        Read article
        <ArrowRightIcon className="h-4 w-4" />
      </span>
    </Link>
  );
}