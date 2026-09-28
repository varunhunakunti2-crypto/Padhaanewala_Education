"use client";

import { useCatalogStats } from "@/lib/useStats";
import { SITE } from "@/lib/site";

/**
 * The "Quick facts" block on `/about`, reading live `COUNT(*)` values.
 *
 * This block used to be hardcoded: "Colleges listed 1,400+", "Students/month
 * 2.4 lakh+". Neither figure had a source. The catalogue holds 341 colleges, and
 * the site has no traffic analytics installed at all, so the student number was
 * not stale — it was invented. A public page that overstates its own scale by
 * 4x is a consumer-protection exposure, not a copy nit, which is why the numbers
 * are now read from the database rather than retyped.
 *
 * There is deliberately no traffic figure here. `students/month` cannot be
 * measured without analytics or request logging, and inventing one is what got
 * the page into trouble. The honest substitutes are the two things that *are*
 * countable: the catalogue, and the years of operation.
 *
 * While the request is in flight every count renders as an em dash rather than
 * `0`, because "0 colleges" and "we have not asked yet" must not look the same —
 * the exact conflation that made the old admin stats dashboard report a healthy
 * API with every number at zero.
 */
export function AboutFacts() {
  const stats = useCatalogStats();
  const measured = stats.ok || (stats.checkedAt !== undefined && stats.failed?.length === 0);

  return (
    <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
      <h3 className="text-sm font-bold text-white">Quick facts</h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-purple-200">Founded</dt>
          <dd className="font-bold text-white">{SITE.foundedYear}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-purple-200">Colleges listed</dt>
          <dd className="font-bold text-white tabular-nums">
            {measured ? stats.colleges.toLocaleString("en-IN") : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-purple-200">Courses</dt>
          <dd className="font-bold text-white tabular-nums">
            {measured ? stats.courses.toLocaleString("en-IN") : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-purple-200">Exams covered</dt>
          <dd className="font-bold text-white tabular-nums">
            {measured ? stats.exams.toLocaleString("en-IN") : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-purple-200">Headquarters</dt>
          <dd className="font-bold text-white">
            {SITE.address.locality}, India
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-purple-200/80">
        {measured
          ? "Counted from our own catalogue. Fees, cutoffs and dates should always be checked against the college's or the examination authority's own notification."
          : "Catalogue size is counted live from our own records. Reload if this stays blank."}
      </p>
    </div>
  );
}
