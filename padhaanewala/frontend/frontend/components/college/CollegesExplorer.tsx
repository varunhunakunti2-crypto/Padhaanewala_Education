"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { College, SearchFilters, SortKey } from "@/lib/types";
import { searchColleges, buildFacets, searchTokens, PAGE_SIZE } from "@/lib/data";
import { COLLEGES } from "@/lib/data/colleges";
import { defaultFilters, parseSearchParams, serializeSearch } from "@/lib/searchParams";
import { CollegeCard } from "@/components/college/CollegeCard";
import { FiltersPanel, countActiveFilters } from "@/components/college/FiltersPanel";
import { SortBar } from "@/components/college/SortBar";
import { Pagination } from "@/components/college/Pagination";
import { SearchBar } from "@/components/home/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip as FilterChip } from "@/components/ui/Chip";
import { SearchX } from "lucide-react";
import { cn, debounce } from "@/lib/utils";

export default function CollegesExplorer({
  colleges: dataset,
}: {
  /** College dataset resolved on the server (API, with bundled fallback). */
  colleges?: College[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Set only on mobile, and only when the filter drawer is open.
   *
   * `updateFilters` used to close the drawer on every change, so each tap on a
   * filter checkbox slammed it shut and the next one had to reopen it. Now only
   * an explicit close — the scrim, the ✕, or "Show N results" — closes it.
   */
  const [filterOpen, setFilterOpen] = useState(false);
  const isDrawerOpen = filterOpen;

  const colleges = useMemo(() => dataset?.length ? dataset : COLLEGES, [dataset]);
  const facets = useMemo(() => buildFacets(colleges), [colleges]);

  const initial = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState<SearchFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);

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

  /**
   * Push the query to the URL on a pause in typing.
   *
   * `updateFilters` writes the URL synchronously, which is right for a checkbox
   * and wrong for a keystroke: typing a five-letter query would fire five
   * `router.replace` calls, each re-rendering the route segment. The grid itself
   * filters off local state and stays instant; only the URL lags, by 300ms.
   *
   * Keyed on `[pathname, router]` and given the finished filter set as an
   * argument. It used to be keyed on `[filters, ...]` with the query as the
   * argument, which meant a brand new debouncer — with a brand new private
   * timer — on every keystroke. Nothing could cancel the previous one, so the
   * three keystrokes of "Mys" queued three `router.replace` calls and the
   * "debounce" wrote to the URL three times, each with the filter state as it
   * stood at that keystroke.
   */
  const syncQuerySoon = useMemo(
    () =>
      debounce((q: string) => {
        const qs = serializeSearch({ ...filters, query: q }, 1);
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      }, 300),
    [pathname, router, filters],
  );

  // An unmount must not leave a timer holding a stale `router` and `pathname`.
  useEffect(() => () => syncQuerySoon.cancel(), [syncQuerySoon]);

  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
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

  const activeCount = countActiveFilters(filters);
  // `searchTokens` rather than `Boolean(query)`: a whitespace-only `?q=%20%20`
  // was truthy, so the chip row and "Clear all" appeared with nothing applied.
  const hasActiveFilters = activeCount > 0 || searchTokens(filters.query).length > 0;

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
              onChange={(q) => {
                // Local state first so the grid responds on the keystroke, URL
                // on the debounce.
                setFilters((prev) => ({ ...prev, query: q }));
                setPage(1);
                syncQuerySoon(q);
              }}
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
                {searchTokens(filters.query).length > 0 && (
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
                <>
                  {total > results.length && (
                    <p className="mb-4 text-xs text-gray-500 dark:text-slate-400">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + results.length} of {total}
                    </p>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {results.map((college) => (
                      <CollegeCard key={college.id} college={college} />
                    ))}
                  </div>
                </>
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