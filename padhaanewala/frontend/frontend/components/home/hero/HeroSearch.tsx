"use client";

import { SearchBar } from "@/components/home/SearchBar";

export function HeroSearch() {
  return (
    <SearchBar
      variant="hero"
      id="hero-search"
      placeholder="Search colleges, courses, cities or careers…"
    />
  );
}