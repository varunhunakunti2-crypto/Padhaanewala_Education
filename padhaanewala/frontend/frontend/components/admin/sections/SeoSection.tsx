"use client";


import {
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

import { StatCard, Panel, ProgressBar } from "@/components/admin/primitives";

export function SeoSection() {
  const checks = [
    { label: "Title tags", score: 96 },
    { label: "Meta descriptions", score: 88 },
    { label: "Heading hierarchy", score: 100 },
    { label: "Image alt text", score: 74 },
    { label: "Structured data", score: 92 },
    { label: "Canonical URLs", score: 85 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Crawl errors" value="0" />
        <StatCard label="Indexed pages" value="142" delta="+6" up />
        <StatCard label="Backlinks" value="1.2K" delta="+4.2%" up />
        <StatCard label="Avg. Core Web Vitals" value="0.9s" delta="Pass" up />
      </div>
      <Panel title="On-page SEO score" description="Automated checks across the site">
        <div className="space-y-4">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              {c.score >= 90 ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <span className="text-base leading-none text-amber-500">⚠</span>
              )}
              <div className="min-w-0 flex-1">
                <ProgressBar label={c.label} value={c.score} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Sitemap & robots" description="Live crawl endpoints">
        <div className="space-y-3 text-sm">
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="font-medium text-gray-700">robots.txt</span> <Badge variant="green">Live</Badge>
          </p>
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="font-medium text-gray-700">sitemap.xml</span> <Badge variant="green">Live ({16 + 14} URLs)</Badge>
          </p>
        </div>
      </Panel>
    </div>
  );
}
