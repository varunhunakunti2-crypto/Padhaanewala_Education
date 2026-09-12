"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { blogCategories } from "@/data/blog";

export type BlogFilterState = {
  q: string;
  category: string;
  sort: string;
};

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title (A–Z)" },
];

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export default function BlogFilters({ current }: { current: BlogFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [category, setCategory] = useState(current.category);
  const [sort, setSort] = useState(current.sort);

  function apply(next: Partial<BlogFilterState>) {
    const params = new URLSearchParams();
    const merged: BlogFilterState = { q, category, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.category && merged.category !== "All") params.set("category", merged.category);
    if (merged.sort) params.set("sort", merged.sort);
    router.push(pathname + (params.toString() ? `?${params.toString()}` : ""));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      <label className="flex flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 focus-within:border-neutral-900">
        <SearchIcon className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="sr-only">Search articles</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search articles, topics or keywords"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="block lg:w-48">
        <span className="sr-only">Category</span>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            apply({ category: e.target.value });
          }}
          className={fieldClass}
        >
          {blogCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-40">
        <span className="sr-only">Sort</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            apply({ sort: e.target.value });
          }}
          className={fieldClass}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="h-12 shrink-0 rounded-xl bg-neutral-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
      >
        Search
      </button>
    </form>
  );
}