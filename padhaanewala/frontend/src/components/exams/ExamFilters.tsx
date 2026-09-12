"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";

export type ExamFilterState = {
  q: string;
  examType: string;
  status: string;
  sort: string;
};

const typeOptions = [
  { value: "", label: "All exams" },
  { value: "national", label: "National" },
  { value: "state", label: "State" },
];

const statusOptions = [
  { value: "", label: "Any status" },
  { value: "open", label: "Application open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "results", label: "Results out" },
];

const sortOptions = [
  { value: "date", label: "Exam date (soonest)" },
  { value: "name", label: "Name (A–Z)" },
];

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export default function ExamFilters({ current }: { current: ExamFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [examType, setExamType] = useState(current.examType);
  const [status, setStatus] = useState(current.status);
  const [sort, setSort] = useState(current.sort);

  function apply(next: Partial<ExamFilterState>) {
    const params = new URLSearchParams();
    const merged: ExamFilterState = { q, examType, status, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.examType) params.set("examType", merged.examType);
    if (merged.status) params.set("status", merged.status);
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
        <span className="sr-only">Search exams</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exam or conducting authority"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="block lg:w-36">
        <span className="sr-only">Exam type</span>
        <select
          value={examType}
          onChange={(e) => {
            setExamType(e.target.value);
            apply({ examType: e.target.value });
          }}
          className={fieldClass}
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-44">
        <span className="sr-only">Status</span>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            apply({ status: e.target.value });
          }}
          className={fieldClass}
        >
          {statusOptions.map((o) => (
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