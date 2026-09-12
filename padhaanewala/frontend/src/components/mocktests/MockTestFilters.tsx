"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import {
  difficultyOptions,
  mockTestExams,
  modeOptions,
} from "@/data/mockTests";

export type MockTestFilterState = {
  q: string;
  exam: string;
  mode: string;
  difficulty: string;
  sort: string;
};

const sortOptions = [
  { value: "name", label: "Name (A–Z)" },
  { value: "duration", label: "Shortest first" },
  { value: "questions", label: "Fewest questions" },
];

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export default function MockTestFilters({
  current,
}: {
  current: MockTestFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [exam, setExam] = useState(current.exam);
  const [mode, setMode] = useState(current.mode);
  const [difficulty, setDifficulty] = useState(current.difficulty);
  const [sort, setSort] = useState(current.sort);

  function apply(next: Partial<MockTestFilterState>) {
    const params = new URLSearchParams();
    const merged: MockTestFilterState = { q, exam, mode, difficulty, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.exam && merged.exam !== "All") params.set("exam", merged.exam);
    if (merged.mode) params.set("mode", merged.mode);
    if (merged.difficulty) params.set("difficulty", merged.difficulty);
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
        <span className="sr-only">Search mock tests</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search test, exam or subject"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="block lg:w-36">
        <span className="sr-only">Exam</span>
        <select
          value={exam}
          onChange={(e) => {
            setExam(e.target.value);
            apply({ exam: e.target.value });
          }}
          className={fieldClass}
        >
          {mockTestExams.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-36">
        <span className="sr-only">Mode</span>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            apply({ mode: e.target.value });
          }}
          className={fieldClass}
        >
          {modeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-40">
        <span className="sr-only">Difficulty</span>
        <select
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            apply({ difficulty: e.target.value });
          }}
          className={fieldClass}
        >
          {difficultyOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block lg:w-36">
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