"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { courseCategories } from "@/data/courses";

export type CourseFilterState = {
  q: string;
  category: string;
  sort: string;
};

const sortOptions = [
  { value: "name", label: "Name (A–Z)" },
  { value: "colleges", label: "Most colleges" },
];

export default function CourseFilters({ current }: { current: CourseFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [category, setCategory] = useState(current.category);
  const [sort, setSort] = useState(current.sort || "name");

  function apply(next: Partial<CourseFilterState>) {
    const params = new URLSearchParams();
    const merged: CourseFilterState = { q, category, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "name") params.set("sort", merged.sort);
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
        <span className="sr-only">Search courses</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search course or degree"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="block lg:w-56">
        <span className="sr-only">Category</span>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            apply({ category: e.target.value });
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        >
          <option value="">All Categories</option>
          {courseCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="block lg:w-44">
        <span className="sr-only">Sort</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            apply({ sort: e.target.value });
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
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