"use client";

import { useCallback, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { College, SearchFilters, SortKey } from "@/lib/types";
import { searchColleges, PAGE_SIZE, buildFacets } from "@/lib/data";
import { COLLEGES } from "@/lib/data/colleges";
import { defaultFilters, parseSearchParams, serializeSearch } from "@/lib/searchParams";
import { CollegeCard } from "@/components/college/CollegeCard";
import { FiltersPanel } from "@/components/college/FiltersPanel";
import { SortBar } from "@/components/college/SortBar";
import { Pagination } from "@/components/college/Pagination";
import { SearchBar } from "@/components/home/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip as FilterChip } from "@/components/ui/Chip";
import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

function activeFilterCount(f: SearchFilters): number {
  return (
    (f.states?.length ?? 0) +
    (f.cities?.length ?? 0) +
    (f.courseNames?.length ?? 0) +
    (f.sectors?.length ?? 0) +
    (f.types?.length ?? 0) +
    (f.exams?.length ?? 0) +
    (f.accreditations?.length ?? 0) +
    (f.hostel === true ? 1 : 0) +
    (f.placementRate === true ? 1 : 0) +
    (f.minFee !== null ? 1 : 0)
  );
}

export default function CollegesExplorer({
  colleges: dataset,
}: {
  /** College dataset resolved on the server (API, with bundled fallback). */
  colleges?: College[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const colleges = useMemo(() => dataset?.length ? dataset : COLLEGES, [dataset]);
  const facets = useMemo(() => buildFacets(colleges), [colleges]);

  const initial = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState<SearchFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [filterOpen, setFilterOpen] = useState(false);

  // Re-read filters when the URL changes (browser back/forward). This is React's
  // documented "adjust state when a prop changes" pattern — the comparison and
  // reset happen during render, so no effect and no cascading render is needed.
  const [lastUrlState, setLastUrlState] = useState(initial);
  if (lastUrlState !== initial) {
    setLastUrlState(initial);
    setFilters(initial.filters);
    setPage(initial.page);
  }

  // keep URL in sync
  const syncUrl = useCallback(
    (next: SearchFilters, nextPage: number) => {
      const qs = serializeSearch(next, nextPage);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router],
  );

  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setFilterOpen(false);
      const next = { ...filters, ...patch };
      setFilters(next);
      setPage(1);
      syncUrl(next, 1);
    },
    [filters, syncUrl],
  );

  const updateSort = useCallback((sortBy: SortKey) => updateFilters({ sortBy }), [updateFilters]);
  const clearAll = useCallback(() => updateFilters(defaultFilters()), [updateFilters]);

  const goPage = useCallback(
    (p: number) => {
      setPage(p);
      syncUrl(filters, p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [filters, syncUrl],
  );

  const { colleges: results, total } = useMemo(
    () => searchColleges(filters, page, colleges),
    [filters, page, colleges],
  );

  const activeCount = activeFilterCount(filters);
  const hasActiveFilters = activeCount > 0 || Boolean(filters.query);

  return (
    <div>
      {/* header band */}
      <section className="relative z-30 bg-gradient-to-br from-purple-100/70 via-white to-blue-50/70 dark:from-purple-950/60 dark:via-slate-900 dark:to-blue-950/60 dark:border-b dark:border-purple-900/40">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-orange-300/20 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
            Explore Colleges
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Search by name, course, city or specialization and refine with
            powerful filters.
          </p>
          <div className="relative z-30 mt-5 max-w-2xl">
            <SearchBar
              initial={filters.query}
              id="colleges-search"
              colleges={colleges}
              facets={facets}
            />
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* desktop sidebar */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl bg-white ring-1 ring-purple-100/70 shadow-sm">
              <FiltersPanel
                filters={filters}
                onChange={updateFilters}
                onClear={clearAll}
                facets={facets}
              />
            </div>
          </aside>

          {/* results */}
          <div className="min-w-0 flex-1">
            <SortBar
              total={total}
              shown={Math.min(results.length, PAGE_SIZE)}
              sortBy={filters.sortBy}
              onSort={updateSort}
              activeFilters={activeCount}
              onOpenFilters={() => setFilterOpen(true)}
            />

            {/* active chips */}
            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {filters.query && (
                  <FilterChip pill onRemove={() => updateFilters({ query: "" })}>{filters.query}</FilterChip>
                )}
                {(filters.states ?? []).map((s) => (
                  <FilterChip key={s} pill onRemove={() => updateFilters({ states: filters.states.filter((x) => x !== s) })}>{s}</FilterChip>
                ))}
                {(filters.cities ?? []).map((s) => (
                  <FilterChip key={s} pill onRemove={() => updateFilters({ cities: filters.cities.filter((x) => x !== s) })}>{s}</FilterChip>
                ))}
                {(filters.courseNames ?? []).map((s) => (
                  <FilterChip key={s} pill onRemove={() => updateFilters({ courseNames: filters.courseNames.filter((x) => x !== s) })}>{`Degree: ${s}`}</FilterChip>
                ))}
                {(filters.types ?? []).map((s) => (
                  <FilterChip key={s} pill onRemove={() => updateFilters({ types: filters.types.filter((x) => x !== s) })}>{s}</FilterChip>
                ))}
                {(filters.exams ?? []).map((s) => (
                  <FilterChip key={s} pill onRemove={() => updateFilters({ exams: filters.exams.filter((x) => x !== s) })}>{s}</FilterChip>
                ))}
                {filters.hostel === true && (
                  <FilterChip pill onRemove={() => updateFilters({ hostel: null })}>Hostel</FilterChip>
                )}
                {filters.placementRate === true && (
                  <FilterChip pill onRemove={() => updateFilters({ placementRate: null })}>
                    85%+ placement
                  </FilterChip>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs font-semibold text-blue-600 hover:text-purple-700"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="mt-5">
              {results.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No colleges match your filters"
                  description="Try removing a few filters or searching with different keywords."
                  actionHref="/colleges"
                  actionLabel="Reset all filters"
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {results.map((college) => (
                    <CollegeCard key={college.id} college={college} />
                  ))}
                </div>
              )}
            </div>

            <Pagination
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPage={goPage}
            />
          </div>
        </div>
      </div>

      {/* mobile filter drawer */}
      <Suspense fallback={null}>
        <div
          aria-hidden={!filterOpen}
          className={cn(
            "fixed inset-0 z-[80] lg:hidden",
            filterOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <button
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
            className={cn(
              "absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity",
              filterOpen ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className={cn(
              "absolute inset-y-0 left-0 w-[min(22rem,88vw)] bg-white shadow-2xl transition-transform duration-300",
              filterOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <FiltersPanel
              filters={filters}
              onChange={updateFilters}
              onClear={clearAll}
              onClose={() => setFilterOpen(false)}
              facets={facets}
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}