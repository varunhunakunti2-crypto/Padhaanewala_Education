"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import {
  ownershipOptions,
  scholarshipCategories,
} from "@/data/scholarships";

export type ScholarshipFilterState = {
  q: string;
  category: string;
  ownership: string;
  sort: string;
};

const sortOptions = [
  { value: "deadline", label: "Deadline (soonest)" },
  { value: "amount", label: "Highest amount" },
  { value: "name", label: "Name (A–Z)" },
];

const categoryOptions = scholarshipCategories.map((c) => ({ value: c, label: c }));

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export default function ScholarshipFilters({
  current,
}: {
  current: ScholarshipFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [category, setCategory] = useState(current.category);
  const [ownership, setOwnership] = useState(current.ownership);
  const [sort, setSort] = useState(current.sort);

  function apply(next: Partial<ScholarshipFilterState>) {
    const params = new URLSearchParams();
    const merged: ScholarshipFilterState = {
      q,
      category,
      ownership,
      sort,
      ...next,
    };
    if (merged.q) params.set("q", merged.q);
    if (merged.category && merged.category !== "All") params.set("category", merged.category);
    if (merged.ownership) params.set("ownership", merged.ownership);
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
        <span className="sr-only">Search scholarships</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search scholarship, provider or eligibility"
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
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-40">
        <span className="sr-only">Provider type</span>
        <select
          value={ownership}
          onChange={(e) => {
            setOwnership(e.target.value);
            apply({ ownership: e.target.value });
          }}
          className={fieldClass}
        >
          {ownershipOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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
          className={fieldClass}
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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