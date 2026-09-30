"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export function Pagination({ total, page, pageSize, onPage }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  for (let p = start; p <= end; p++) window.push(p);

  const btn =
    "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      <button
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={cn(btn, "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-purple-50 disabled:opacity-40")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} className={cn(btn, "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-purple-50")}>
            1
          </button>
          {start > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}

      {window.map((p) => (
        <button
          key={p}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={cn(
            btn,
            p === page
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-purple-50",
          )}
        >
          <span className="tabular-nums">{p}</span>
        </button>
      ))}

      {end < pages && (
        <>
          {end < pages - 1 && <span className="px-1 text-gray-400">…</span>}
          <button onClick={() => onPage(pages)} className={cn(btn, "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-purple-50")}>
            {pages}
          </button>
        </>
      )}

      <button
        aria-label="Next page"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className={cn(btn, "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-purple-50 disabled:opacity-40")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}