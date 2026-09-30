import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import type { SortKey } from "@/lib/types";
import { SORT_OPTIONS } from "@/lib/searchParams";

interface SortBarProps {
  total: number;
  shown: number;
  sortBy: SortKey;
  onSort: (s: SortKey) => void;
  activeFilters: number;
  onOpenFilters: () => void;
}

export function SortBar({ total, shown, sortBy, onSort, activeFilters, onOpenFilters }: SortBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        <span className="font-display font-bold text-gray-900 dark:text-white tabular-nums">{shown}</span>{" "}
        of <span className="font-display font-bold text-gray-900 dark:text-white tabular-nums">{total}</span>{" "}
        colleges
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFilters}
          className="inline-flex h-9.5 items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 active:scale-95 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-bold text-purple-700">
              {activeFilters}
            </span>
          )}
        </button>

        <label className="flex h-9.5 items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 ring-1 ring-inset ring-gray-200 dark:ring-slate-800 transition-colors shadow-sm">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
          <span className="sr-only">Sort colleges by</span>
          <select
            value={sortBy}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="cursor-pointer bg-transparent text-sm font-medium text-gray-700 dark:text-slate-200 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option
                key={o.value}
                value={o.value}
                className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              >
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}