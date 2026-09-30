"use client";

import { Trash2, Scale, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { getCollegesByIds } from "@/lib/data/colleges";
import type { College } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddCollegeButton } from "@/components/compare/parts";
import ComparisonTable from "@/components/compare/ComparisonTable";
import ComparisonCards from "@/components/compare/ComparisonCards";
import { MiniChat } from "@/components/ai/MiniChat";

export default function CompareExplorer({
  colleges: dataset,
}: {
  /** College dataset resolved on the server (API, with bundled fallback). */
  colleges?: College[];
}) {
  const { compareList, toggleCompare, clearCompare, compareHistory, recordComparison, showToast } = useApp();
  const colleges = getCollegesByIds(compareList, dataset);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
            Compare Colleges
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Add up to 4 colleges and compare them side by side on every important metric.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <Scale className="h-4 w-4" /> {colleges.length}/4 selected
          </Button>
          {colleges.length > 0 && (
            <Button variant="danger" size="sm" onClick={clearCompare}>
              <Trash2 className="h-4 w-4" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {colleges.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No colleges in your comparison"
            description="Use the Compare button on any college card, or search colleges below to build your shortlist."
            actionHref="/colleges"
            actionLabel="Browse colleges"
            actionIcon={<ArrowRight className="h-4 w-4" />}
          />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <div className="hidden sm:block" />
              <div className="flex justify-end">
                <AddCollegeButton onAdd={(c) => toggleCompare(c.id, c.shortName)} existing={compareList} dataset={dataset} />
              </div>
            </div>
            <div className="hidden lg:block">
              <ComparisonTable colleges={colleges} />
            </div>
            <div className="lg:hidden">
              <ComparisonCards colleges={colleges} />
              <div className="mt-5 flex justify-center">
                <AddCollegeButton onAdd={(c) => toggleCompare(c.id, c.shortName)} existing={compareList} dataset={dataset} />
              </div>
            </div>
            <button
              onClick={() => {
                recordComparison(colleges.map((c) => c.id));
                showToast({ variant: "success", title: "Comparison saved", description: "You can find it in your dashboard under 'Comparisons'." });
              }}
              disabled={colleges.length < 2}
              className="mx-auto mt-6 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-100 disabled:opacity-50"
            >
              <Scale className="h-4 w-4" />
              Save this comparison to dashboard
            </button>
          </>
        )}
      </div>

      {compareHistory.length > 0 && colleges.length === 0 && (
        <p className="mt-6 text-center text-xs text-gray-400">
          You have {compareHistory.length} previous comparison{compareHistory.length > 1 ? "s" : ""} saved on your dashboard.
        </p>
      )}

      <div className="mt-10">
        <MiniChat colleges={colleges} />
      </div>
    </section>
  );
}