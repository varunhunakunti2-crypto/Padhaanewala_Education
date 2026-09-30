"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, CalendarDays, Clock, UserRound } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { BlogPost, BlogCategory } from "@/lib/types";

const CATEGORY_TONE: Record<BlogCategory, "purple" | "blue" | "green" | "yellow" | "orange" | "amber" | "gray" | "red"> = {
  Admissions: "purple",
  NEET: "blue",
  AYUSH: "green",
  Nursing: "red",
  Scholarships: "amber",
  Careers: "orange",
  Exams: "yellow",
  "College Guides": "gray",
  "Education News": "blue",
};

export function ArticleCard({ post, large = false }: { post: BlogPost; large?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-900/5",
        large && "md:flex-row md:items-center md:gap-6 md:p-6",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-700",
          large ? "h-40 md:h-48 md:w-72" : "h-32",
        )}
      >
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display px-4 text-center text-lg font-extrabold tracking-tight text-white/90">
            {post.category.toUpperCase()}
          </span>
        </div>
        {post.featured && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
            FEATURED
          </span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col", large && "mt-4 md:mt-0")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={CATEGORY_TONE[post.category]}>{post.category}</Badge>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <CalendarDays className="h-3 w-3" /> {formatDate(post.date)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3 w-3" /> {post.readTime}
          </span>
        </div>
        <h3
          className={cn(
            "mt-2 font-display font-extrabold text-gray-900 transition group-hover:text-purple-700",
            large ? "text-xl sm:text-2xl" : "text-lg leading-snug",
          )}
        >
          {post.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-500">{post.excerpt}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <UserRound className="h-3.5 w-3.5" /> {post.author}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-700">
            Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BlogExplorer({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: BlogCategory[];
}) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = useState<"All" | BlogCategory>("All");

  const filtered = posts.filter((p) => {
    const matchCat = cat === "All" || p.category === cat;
    const matchQ =
      !q.trim() ||
      [p.title, p.excerpt, p.author, ...p.tags].join(" ").toLowerCase().includes(q.toLowerCase().trim());
    return matchCat && matchQ;
  });

  const featured = posts.find((p) => p.featured);
  const rest = filtered.filter((p) => p.id !== featured?.id);
  const top = featured ? [featured, ...rest] : rest;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles..."
            className="pl-10"
            aria-label="Search articles"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip active={cat === "All"} label="All" onClick={() => setCat("All")} />
          {categories.map((c) => (
            <CategoryChip key={c} active={cat === c} label={c} onClick={() => setCat(c)} />
          ))}
        </div>
      </div>

      {top.slice(0, 1).map((p) => (
        <ArticleCard key={p.id} post={p} large />
      ))}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {top.slice(1).map((p) => (
          <ArticleCard key={p.id} post={p} />
        ))}
      </div>

      {!top.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          No articles match your search.
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-purple-300",
      )}
    >
      {label}
    </button>
  );
}