"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { courseOptions, states } from "@/data/colleges";

export type FilterState = {
  q: string;
  state: string;
  course: string;
  featured: string;
  sort: string;
};

const sortOptions = [
  { value: "featured", label: "Featured first" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "Name (A–Z)" },
];

export default function CollegeFilters({ current }: { current: FilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [state, setState] = useState(current.state);
  const [course, setCourse] = useState(current.course);
  const [featured, setFeatured] = useState(current.featured === "1");
  const [sort, setSort] = useState(current.sort);

  function apply(next: Partial<FilterState>, resetPage = true) {
    const params = new URLSearchParams();
    const merged: FilterState = { q, state, course, featured: featured ? "1" : "", sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.state) params.set("state", merged.state);
    if (merged.course) params.set("course", merged.course);
    if (merged.featured) params.set("featured", merged.featured);
    if (merged.sort) params.set("sort", merged.sort);
    if (!resetPage) params.delete("page");
    router.push(pathname + (params.toString() ? `?${params.toString()}` : ""));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q }, false);
      }}
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      <label className="flex flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 focus-within:border-neutral-900">
        <SearchIcon className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="sr-only">Search colleges</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search college, city or course"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="block lg:w-44">
        <span className="sr-only">State</span>
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            apply({ state: e.target.value });
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>

      <label className="block lg:w-52">
        <span className="sr-only">Course</span>
        <select
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            apply({ course: e.target.value });
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        >
          <option value="">All Courses</option>
          {courseOptions.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
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

      <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 py-3 text-sm font-medium text-neutral-700 select-none">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => {
            setFeatured(e.target.checked);
            apply({ featured: e.target.checked ? "1" : "" });
          }}
          className="h-4 w-4 accent-neutral-950"
        />
        Featured only
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