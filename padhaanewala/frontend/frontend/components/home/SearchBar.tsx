"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building,
  GraduationCap,
  MapPin,
  FlaskConical,
  FileText,
  Clock,
  Flame,
  TrendingUp,
  X,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { getSuggestions, POPULAR_SEARCHES, type CollegeFacets } from "@/lib/data";
import type { College, SearchSuggestion } from "@/lib/types";
import { cn, debounce } from "@/lib/utils";

const TYPE_ICON = {
  college: Building,
  course: GraduationCap,
  city: MapPin,
  specialization: FlaskConical,
  exam: FileText,
};

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  initial?: string;
  onSearch?: () => void;
  id?: string;
  variant?: "default" | "hero";
  /** Dataset + facets to suggest from; defaults to the bundled college list. */
  colleges?: College[];
  facets?: CollegeFacets;
}

export function SearchBar({
  placeholder,
  autoFocus,
  initial,
  onSearch,
  id,
  variant = "default",
  colleges,
  facets,
}: SearchBarProps) {
  const router = useRouter();
  const { recentSearches, addRecentSearch, addRecentLocation } = useApp();
  const [value, setValue] = useState(initial ?? "");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchDeferred = useMemo(
    () =>
      debounce((q: string) => {
        if (q.trim()) setSuggestions(getSuggestions(q, colleges, facets));
        else setSuggestions([]);
      }, 180),
    [colleges, facets],
  );

  useEffect(() => {
    searchDeferred(value);
  }, [value, searchDeferred]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const submit = (q: string) => {
    const query = q.trim();
    if (!query) return;
    addRecentSearch(query);
    setFocused(false);
    router.push(`/colleges?q=${encodeURIComponent(query)}`);
    onSearch?.();
  };

  const applySuggestion = (s: SearchSuggestion) => {
    addRecentSearch(s.label);
    if (s.type === "city") addRecentLocation(s.label);
    setFocused(false);
    router.push(`/colleges?q=${encodeURIComponent(s.label)}`);
    onSearch?.();
  };

  const suggestionsToShow = focused && value.trim().length > 0 ? suggestions : [];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestionsToShow.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && suggestionsToShow[highlight]) {
        applySuggestion(suggestionsToShow[highlight]!);
      } else {
        submit(value);
      }
    } else if (e.key === "Backspace" && value === "") {
      setSuggestions([]);
    }
  };

  return (
    <div ref={boxRef} className="relative z-40 w-full">
      <div
        className={cn(
          "flex items-center gap-2 bg-white transition-all",
          variant === "hero"
            ? cn(
                "h-16 rounded-full border-2 border-white/95 shadow-[0_24px_60px_-16px_rgba(2,8,28,0.5)]",
                focused
                  ? "border-white shadow-[0_0_0_3px_rgba(255,255,255,0.45),0_28px_70px_-18px_rgba(2,8,28,0.6)]"
                  : "border-white/90",
              )
            : cn(
                "h-auto rounded-2xl border-2",
                focused
                  ? "border-blue-400 shadow-lg shadow-blue-500/10"
                  : "border-gray-200 shadow-md",
              ),
        )}
      >
        <Search
          className={cn(
            "ml-4 h-5 w-5 shrink-0",
            variant === "hero" ? "text-brand" : "text-blue-600",
          )}
        />
        <label
          className="sr-only"
          htmlFor={id ?? "global-search"}
        >
          Search colleges, courses, cities or careers
        </label>
        <input
          id={id ?? "global-search"}
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setHighlight(-1), 120)}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlight(-1);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={focused}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          placeholder={placeholder ?? "Search by college, course, city or specialization…"}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent px-1 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 focus-visible:border-none focus-visible:outline-none focus-visible:ring-0",
            variant === "hero" ? "h-16" : "h-14",
          )}
          style={{ outline: "none", boxShadow: "none" }}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="mr-1 grid h-7 w-7 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {variant === "hero" ? (
          <button
            type="button"
            aria-label="Submit search"
            onClick={() => submit(value)}
            className="mr-1.5 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-warm-gradient text-white shadow-lg shadow-orange-500/40 transition hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit(value)}
            className="mr-2 hidden h-10 shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:inline-flex"
          >
            <Search className="h-4 w-4" /> Search
          </button>
        )}
      </div>

      {focused && (
        <div
          id="search-suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in"
        >
          {suggestionsToShow.length > 0 && (
            <ul role="listbox" className="max-h-80 overflow-auto p-1.5">
              {suggestionsToShow.map((s, i) => {
                const Icon = TYPE_ICON[s.type];
                const active = i === highlight;
                return (
                  <li
                    key={`${s.type}-${s.label}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySuggestion(s);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                      active
                        ? "bg-purple-50 dark:bg-purple-950/60"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        s.type === "college"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300"
                          : s.type === "course"
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
                            : s.type === "city"
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{s.label}</span>
                      {s.sub && <span className="block text-xs text-gray-400 dark:text-slate-400">{s.sub}</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-gray-300 dark:text-slate-500">
                      {s.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-100 dark:border-slate-800 p-3">
            {recentSearches.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-400">
                  <Clock className="h-3 w-3" /> Recent searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-full bg-gray-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 transition hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-400">
              <Flame className="h-3 w-3" /> Popular searches
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((s, i) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition",
                    i < 3
                      ? "bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/60"
                      : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300",
                  )}
                >
                  {i < 3 && <TrendingUp className="h-3 w-3" />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}