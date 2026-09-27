"use client";

import { Panel } from "@/components/admin/primitives";

/**
 * Analytics has no data source.
 *
 * This screen previously rendered a complete plausible-looking analytics
 * dashboard out of hardcoded arrays: 184.2K page views, 41.8K unique visitors,
 * a 6.2% enquiry conversion rate, a 4m 32s average session, twelve months of
 * traffic climbing from 42K to 132K, a state breakdown led by Maharashtra, a
 * visitor→admission funnel, and a 68/27/5 mobile/desktop/tablet split. None of
 * it was measured, none of it came from an API, and it did not change with any
 * real data — it was a picture of a product that had traffic.
 *
 * There is no analytics endpoint and no page-view tracking in this codebase, so
 * there is nothing honest to plot. Rather than invent a replacement, the panel
 * says what is missing. If you want this screen to work, the order is:
 * instrument the routes, store the events, expose an aggregate endpoint, then
 * render the numbers that endpoint returns.
 */
export function AnalyticsSection() {
  return (
    <div className="space-y-5">
      <Panel title="Analytics" description="Traffic, funnel and device reporting">
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-slate-700">No analytics source is connected.</p>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            This project records no page views or sessions, and exposes no analytics endpoint, so
            there is no data behind traffic, funnel or device charts. Rather than show invented
            numbers, this panel stays empty. Connect an analytics provider (or add an event table
            and an aggregate endpoint) and the figures can be rendered from real counts.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------- Catalog sections ---------------------------------- */
