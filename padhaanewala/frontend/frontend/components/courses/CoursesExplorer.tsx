"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Bookmark, Clock, IndianRupee, Building2, ArrowRight } from "lucide-react";
import { searchCourses, collegesOffering, type CourseMeta } from "@/lib/data/courses";
import { useApp } from "@/lib/context/AppContext";
import type { College } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";

const LEVELS = ["All", "UG", "PG", "Doctoral"] as const;

export default function CoursesExplorer({
  courses: catalog,
  colleges: dataset,
}: {
  /** Course catalogue resolved on the server. */
  courses?: CourseMeta[];
  /** College dataset used for the "N colleges offer this" count. */
  colleges?: College[];
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("All");
  const { isCourseSaved, toggleCourseSave } = useApp();

  const results = useMemo(() => {
    const list = searchCourses(query, catalog);
    return level === "All" ? list : list.filter((c) => c.level === level);
  }, [query, level, catalog]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Explore Courses
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 sm:text-base">
          {"Discover degrees, programs and specializations offered across India's top colleges."}
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white p-1.5 shadow-sm focus-within:border-blue-400">
          <Search className="ml-2.5 h-5 w-5 text-blue-600" />
          <label className="sr-only" htmlFor="course-search">Search courses</label>
          <input
            id="course-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course name or stream…"
            className="h-10 min-w-0 flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 focus-visible:border-none focus-visible:outline-none focus-visible:ring-0"
            style={{ outline: "none", boxShadow: "none" }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-8 pb-10">
        {results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No courses found"
            description="Try different keywords or clear your search."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((c) => {
              const colleges = collegesOffering(c.slug, dataset, catalog);
              const saved = isCourseSaved(c.slug);
              return (
                <article
                  key={c.slug}
                  className="group relative flex flex-col rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <button
                    aria-pressed={saved}
                    aria-label={saved ? `Unsave ${c.name}` : `Save ${c.name}`}
                    onClick={() => toggleCourseSave(c.slug, c.name)}
                    className={cn(
                      "absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full transition",
                      saved ? "bg-amber-400 text-white" : "text-gray-300 hover:text-amber-500",
                    )}
                  >
                    <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
                  </button>

                  <Badge variant={c.hot ? "orange" : "blue"} className="w-fit">
                    {c.level}
                  </Badge>
                  <Link href={`/courses/${c.slug}`}>
                    <h3 className="font-display mt-3 text-base font-bold leading-snug text-gray-900 group-hover:text-purple-700">
                      {c.name}
                    </h3>
                  </Link>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-3">
                    {c.description}
                  </p>

                  <dl className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-500" /> {c.duration}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="h-3.5 w-3.5 text-orange-500" />{" "}
                      {formatINR(c.avgFeeYear)}/yr average
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-purple-500" />{" "}
                      {colleges.length} colleges offering this
                    </div>
                  </dl>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <Link
                      href={`/courses/${c.slug}`}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-purple-600 text-sm font-semibold text-white transition hover:bg-purple-700"
                    >
                      View course details <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/colleges?q=${encodeURIComponent(c.degree)}`}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-purple-50 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                    >
                      Find colleges
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}