"use client";

import { useState } from "react";
import { popularSearches } from "./data";
import { MapPinIcon, SearchIcon } from "./icons";

export default function SearchBar() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Job board search action hook — wired to real search flow later.
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        role="search"
        className="flex flex-col overflow-hidden rounded-2xl border border-jh-line bg-white p-2 shadow-[0_18px_45px_-22px_rgba(7,19,40,0.35)] sm:flex-row sm:items-center"
      >
        <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 sm:border-r sm:border-jh-line">
          <SearchIcon className="h-5 w-5 shrink-0 text-jh-muted" />
          <span className="sr-only">Job keyword</span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Job Keyword"
            className="w-full bg-transparent text-sm text-jh-ink outline-none placeholder:text-jh-muted"
          />
        </label>

        <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3">
          <MapPinIcon className="h-5 w-5 shrink-0 text-jh-muted" />
          <span className="sr-only">Location</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full bg-transparent text-sm text-jh-ink outline-none placeholder:text-jh-muted"
          />
        </label>

        <button
          type="submit"
          className="mx-2 mb-2 rounded-xl bg-jh-yellow px-7 py-3 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-[#FFD93D] sm:my-0 sm:mb-0 sm:rounded-full"
        >
          Search
        </button>
      </form>

      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-jh-muted">
        <span className="font-medium text-jh-ink">Popular Searches:</span>
        {popularSearches.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => setKeyword(term)}
            className="rounded-full border border-jh-line bg-white px-3 py-1 text-xs font-medium text-jh-muted transition-colors duration-200 hover:border-jh-ink hover:text-jh-ink"
          >
            {term}
          </button>
        ))}
      </p>
    </div>
  );
}