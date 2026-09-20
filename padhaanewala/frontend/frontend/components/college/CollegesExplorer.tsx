"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SearchFilters, SortKey } from "@/lib/types";
import { searchColleges, PAGE_SIZE } from "@/lib/data";
import { defaultFilters, parseSearchParams, serializeSearch } from "@/lib/searchParams";
import { CollegeCard } from "@/components/college/CollegeCard";
import { FiltersPanel } from "@/components/college/FiltersPanel";
import { SortBar } from "@/components/college/SortBar";
import { Pagination } from "@/components/college/Pagination";
import { SearchBar } from "@/components/home/SearchBar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchX, X } from "lucide-react";
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

export default function CollegesExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState<SearchFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // keep URL in sync
  const syncUrl = useCallback(
    (next: SearchFilters, nextPage: number) => {
      const qs = serializeSearch(next, nextPage);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router],
  );

  // initial simulated loading for skeleton polish
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setFilterOpen(false);
      const next = { ...filters, ...patch };
      setFilters(next);
      setPage(1);
      syncUrl(next, 1);
      setLoading(true);
      window.setTimeout(() => setLoading(false), 300);
    },
    [filters, syncUrl],
  );

  const updateSort = useCallback((sortBy: SortKey) => updateFilters({ sortBy }), [updateFilters]);
  const clearAll = useCallback(() => updateFilters(defaultFilters()), [updateFilters]);

  const goPage = useCallback(
    (p: number) => {
      setPage(p);
      syncUrl(filters, p);
      setLoading(true);
      window.setTimeout(() => setLoading(false), 250);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [filters, syncUrl],
  );

  const { colleges, total } = useMemo(() => searchColleges(filters, page), [filters, page]);

  const activeCount = activeFilterCount(filters);
  const hasActiveFilters = activeCount > 0 || Boolean(filters.query);

  return (
    <div>
      {/* header band */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-purple-100/70 via-white to-blue-50/70 dark:from-purple-950/60 dark:via-slate-900 dark:to-blue-950/60 dark:border-b dark:border-purple-900/40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-orange-300/20 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
            Explore Colleges
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Search by name, course, city or specialization and refine with
            powerful filters.
          </p>
          <div className="mt-5 max-w-2xl">
            <SearchBar
              initial={filters.query}
              id="colleges-search"
              onSearch={() => setLoading(true)}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* desktop sidebar */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl bg-white ring-1 ring-purple-100/70 shadow-sm">
              <FiltersPanel
                filters={filters}
                onChange={updateFilters}
                onClear={clearAll}
              />
            </div>
          </aside>

          {/* results */}
          <div className="min-w-0 flex-1">
            <SortBar
              total={total}
              shown={Math.min(colleges.length, PAGE_SIZE)}
              sortBy={filters.sortBy}
              onSort={updateSort}
              activeFilters={activeCount}
              onOpenFilters={() => setFilterOpen(true)}
            />

            {/* active chips */}
            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {filters.query && (
                  <Chip pill value={filters.query} onRemove={() => updateFilters({ query: "" })} />
                )}
                {(filters.states ?? []).map((s) => (
                  <Chip key={s} pill value={s} onRemove={() => updateFilters({ states: filters.states.filter((x) => x !== s) })} />
                ))}
                {(filters.cities ?? []).map((s) => (
                  <Chip key={s} pill value={s} onRemove={() => updateFilters({ cities: filters.cities.filter((x) => x !== s) })} />
                ))}
                {(filters.courseNames ?? []).map((s) => (
                  <Chip key={s} pill value={`Degree: ${s}`} onRemove={() => updateFilters({ courseNames: filters.courseNames.filter((x) => x !== s) })} />
                ))}
                {(filters.types ?? []).map((s) => (
                  <Chip key={s} pill value={s} onRemove={() => updateFilters({ types: filters.types.filter((x) => x !== s) })} />
                ))}
                {(filters.exams ?? []).map((s) => (
                  <Chip key={s} pill value={s} onRemove={() => updateFilters({ exams: filters.exams.filter((x) => x !== s) })} />
                ))}
                {filters.hostel === true && (
                  <Chip pill value="Hostel" onRemove={() => updateFilters({ hostel: null })} />
                )}
                {filters.placementRate === true && (
                  <Chip pill value="85%+ placement" onRemove={() => updateFilters({ placementRate: null })} />
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
              {loading ? (
                <SkeletonGrid count={6} />
              ) : colleges.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No colleges match your filters"
                  description="Try removing a few filters or searching with different keywords."
                  actionHref="/colleges"
                  actionLabel="Reset all filters"
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {colleges.map((college) => (
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
            />
          </div>
        </div>
      </Suspense>

      {/* hide skeleton flash */}
      <noscript>{null}</noscript>
    </div>
  );
}

function Chip({
  pill,
  value,
  onRemove,
}: {
  pill?: boolean;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
        pill
          ? "bg-purple-50 text-purple-700 ring-purple-200"
          : "bg-gray-100 text-gray-600 ring-gray-200",
      )}
    >
      {value}
      <button aria-label={`Remove ${value}`} onClick={onRemove} className="grid h-4 w-4 place-items-center rounded-full hover:bg-purple-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}