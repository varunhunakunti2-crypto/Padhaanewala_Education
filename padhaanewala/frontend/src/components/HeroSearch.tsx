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
        className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 shadow-lg shadow-neutral-950/5"
      >
        <SearchIcon className="ml-2 h-5 w-5 shrink-0 text-neutral-400" />
        <label htmlFor="hero-search" className="sr-only">
          Search colleges, courses, exams or locations
        </label>
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search colleges, courses, exams or locations"
          className="w-full bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
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