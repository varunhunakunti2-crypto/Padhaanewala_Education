"use client";

import { useMemo } from "react";
import { buildFacets } from "@/lib/data";
import type { College } from "@/lib/types";
import { SearchBar } from "@/components/home/SearchBar";

export function HeroSearch({ colleges }: { colleges?: College[] }) {
  // The hero used to let `SearchBar` fall back to the bundled sample dataset,
  // so a college that exists only in the API catalogue (for example
  // "RV College of Engineering") could never be suggested here. Build the
  // facets from the same resolved list the rest of the homepage renders.
  const facets = useMemo(() => buildFacets(colleges), [colleges]);

  return (
    <SearchBar
      variant="hero"
      id="hero-search"
      placeholder="Search colleges, courses, cities or careers…"
      colleges={colleges}
      facets={facets}
    />
  );
}
