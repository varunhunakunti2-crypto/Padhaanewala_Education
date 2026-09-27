"use client";

/**
 * No counsellor records exist.
 *
 * This panel used to list four invented counsellors with invented lead counts,
 * conversion counts and star ratings (Anita Sharma: 142 leads, 61 converted,
 * 4.8★). There is no counsellor table, no endpoint and no import path for them,
 * so every number on that screen was fiction presented as performance data.
 * The panel now says so instead of rendering it.
 */
export function CounsellorsSection() {
  return (
    <div>
      <p className="font-display text-lg font-extrabold tracking-tight text-gray-900">Counsellors</p>
      <p className="mt-1 text-sm text-slate-500">Track team performance and conversions</p>
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">No counsellor records are connected.</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          There is no counsellor table in the database, so there are no lead counts, conversion
          rates or ratings to show. Those figures have to be computed from real enquiry records
          before this screen can display anything.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- Content & ops sections ---------------------------------- */
