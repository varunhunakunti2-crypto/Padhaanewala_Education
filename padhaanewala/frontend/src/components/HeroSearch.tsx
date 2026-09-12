"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { heroExamples } from "@/data/home";

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/colleges?q=${encodeURIComponent(q)}` : "/colleges");
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={onSubmit}
        role="search"
        className="foreground-accent flex items-center gap-2 rounded-2xl border border-white/20 bg-white/95 dark:bg-neutral-900/95 p-2 shadow-2xl backdrop-blur-xl"
      >
        <SearchIcon className="ml-2 h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-300" />
        <label htmlFor="hero-search" className="sr-only">
          Search colleges, courses, exams or locations
        </label>
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search colleges, courses, exams or locations"
          className="w-full bg-transparent text-base text-neutral-900 dark:text-white outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-400"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/70">Popular:</span>
        {heroExamples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => router.push(`/colleges?q=${encodeURIComponent(example)}`)}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}