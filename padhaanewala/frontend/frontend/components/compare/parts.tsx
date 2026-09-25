"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { College } from "@/lib/types";
import { COLLEGES } from "@/lib/data/colleges";
import { BANNER_GRADIENTS } from "@/lib/utils";

export function Logo({ c, size = "h-12 w-12 rounded-xl" }: { c: College; size?: string }) {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center bg-gradient-to-br font-bold text-white shadow-sm ring-2 ring-white ${BANNER_GRADIENTS[c.gradientId] ?? BANNER_GRADIENTS.g0}`}
    >
      {c.initials}
    </span>
  );
}

interface Props {
  onAdd: (c: College) => void;
  existing: string[];
  /** College dataset resolved on the server. */
  dataset?: College[];
}

export function AddCollegeButton({ onAdd, existing, dataset }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const available = (dataset ?? COLLEGES).filter(
    (c) =>
      !existing.includes(c.id) &&
      (c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q)),
  ).slice(0, 6);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/60 p-6 transition-colors hover:border-purple-400 hover:bg-purple-50"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-purple-100 text-purple-600">
          <Plus className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-purple-700">Add college</span>
        <span className="text-xs text-purple-400">Compare up to 4</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Add college to compare"
        >
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-fade-in"
          />
          <div className="relative z-10 max-h-[86vh] w-full overflow-auto rounded-t-3xl bg-white shadow-2xl animate-fade-up sm:max-w-lg sm:rounded-2xl">
            <div className="sticky top-0 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur">
              <h2 className="font-display text-base font-bold text-gray-900">Add college to compare</h2>
            </div>
            <div className="p-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a college name…"
                autoFocus
                className="mb-4 h-10 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
              />
              <ul className="space-y-1.5">
                {available.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        onAdd(c);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-purple-50"
                    >
                      <Logo c={c} size="h-10 w-10 rounded-lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{c.shortName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {c.city}, {c.state}
                        </p>
                      </div>
                      <span className="ml-auto text-xs font-semibold text-amber-600">★ {c.rating}</span>
                    </button>
                  </li>
                ))}
                {available.length === 0 && (
                  <li className="py-6 text-center text-sm text-gray-400">No more colleges to add</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}