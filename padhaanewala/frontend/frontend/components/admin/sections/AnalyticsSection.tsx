"use client";


import {
  MapPin,
  Monitor,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { StatCard, Panel, ProgressBar } from "@/components/admin/primitives";

export function AnalyticsSection() {
  const series = [42, 48, 44, 58, 66, 72, 68, 82, 91, 104, 118, 132];
  const max = Math.max(...series);
  const states = [
    { name: "Maharashtra", views: "33.2K", pct: 18 },
    { name: "Uttar Pradesh", views: "28.7K", pct: 16 },
    { name: "Karnataka", views: "21.4K", pct: 12 },
    { name: "Tamil Nadu", views: "18.9K", pct: 11 },
    { name: "Rajasthan", views: "15.3K", pct: 9 },
  ];
  const funnel = [
    { label: "Page visitors", value: "184.2K" },
    { label: "Enquiries", value: "11.4K" },
    { label: "Qualified leads", value: "6.1K" },
    { label: "Admissions", value: "3.2K" },
  ];
  const devices = [
    { label: "Mobile", icon: Smartphone, pct: 68 },
    { label: "Desktop", icon: Monitor, pct: 27 },
    { label: "Tablet", icon: Smartphone, pct: 5 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Page views" value="184.2K" delta="+12.4%" up />
        <StatCard label="Unique visitors" value="41.8K" delta="+8.1%" up />
        <StatCard label="Enquiry conversion" value="6.2%" delta="-0.4%" />
        <StatCard label="Avg. session" value="4m 32s" delta="+14s" up />
      </div>

      <Panel title="Monthly traffic (last 12 months)" description="Unique visits in thousands">
        <div className="flex items-end gap-2">
          {series.map((v, i) => (
            <div key={i} className="flex-1">
              <div className="flex h-44 items-end rounded-lg bg-slate-50 p-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-purple-700 to-indigo-500 hover:from-purple-800 focus-visible:outline-2 focus-visible:outline-purple-500"
                  style={{ height: `${(v / max) * 100}%` }}
                  title={`${v / 1000}K views`}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-400">{i + 1}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Traffic by state" description="Top 5 regions">
          <div className="space-y-4">
            {states.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{s.name}</span>
                    <span className="text-xs font-semibold text-slate-500">{s.views}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-purple-600" style={{ width: `${s.pct * 3.5}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-5">
          <Panel title="Conversion funnel" description="Visitor → admission">
            <div className="space-y-2">
              {funnel.map((f, i) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-medium text-gray-700">{f.label}</span>
                  <div className="flex h-8 flex-1 items-center overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className={cn("h-full rounded-lg transition-all", i === 0 ? "bg-purple-600/30" : i === 1 ? "bg-purple-600/50" : i === 2 ? "bg-purple-600/70" : "bg-purple-600")}
                      style={{ width: `${[100, 62, 33, 17][i]}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-bold text-gray-900">{f.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Devices" description="Share of sessions">
            <div className="space-y-4">
              {devices.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600">
                    <d.icon className="h-4 w-4" />
                  </span>
                  <ProgressBar label={d.label} value={d.pct} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Catalog sections ---------------------------------- */
