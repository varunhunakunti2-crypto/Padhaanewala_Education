import Link from "next/link";
import {
  ArticleCard,
  FeaturedArticle,
} from "@/components/blog/ArticleCard";
import BlogFilters from "@/components/blog/BlogFilters";
import Pagination from "@/components/colleges/Pagination";
import { articles } from "@/data/blog";

export const metadata = {
  title: "Admission Articles & Guides",
  description:
    "Guides on college admissions, counselling, entrance exams, scholarships and careers — written by the Padhaanewala team.",
};

const PAGE_SIZE = 9;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const category = first(sp.category);
  const sort = first(sp.sort) || "newest";
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  const hasFilters = q !== "" || (category !== "" && category !== "All");

  let results = articles.filter((article) => {
    if (category && category !== "All" && article.category !== category) return false;
    if (q) {
      const haystack = [article.title, article.excerpt, article.category, article.author]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "title") {
    results = [...results].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "oldest") {
    results = [...results].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  } else {
    results = [...results].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  }

  const featured = !hasFilters
    ? results.find((article) => article.featured) ?? null
    : null;
  const featuredIdSet = featured ? new Set([featured.id]) : new Set<string>();
  const rest = results.filter((article) => !featuredIdSet.has(article.id));

  const total = rest.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = rest.slice(start, start + PAGE_SIZE);

  const cleanParams = new URLSearchParams();
  if (q) cleanParams.set("q", q);
  if (category && category !== "All") cleanParams.set("category", category);
  if (sort) cleanParams.set("sort", sort);
  const basePath = `?${cleanParams.toString()}`;

  const activeFilters = [
    q ? `“${q}”` : "",
    category && category !== "All" ? `category: ${category}` : "",
  ].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Articles & Guides
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Clear, verified guides on admissions, counselling, exams,
            scholarships and careers for Indian students.
          </p>
          <div className="mt-7">
            <BlogFilters
              current={{ q, category: category || "All", sort }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        {featured && (
          <div className="mb-10">
            <FeaturedArticle article={featured} />
          </div>
        )}

        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0 && !featured
              ? "No articles found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} articles`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">
              Filters: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No articles found
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try a different search or reset the filters.
            </p>
            <Link
              href="/blog"
              className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Reset all filters
            </Link>
          </div>
        )}

        <div className="mt-10">
          <Pagination
            page={current}
            totalPages={totalPages}
            basePath={basePath}
            path="/blog"
          />
        </div>
      </section>
    </div>
  );
}