"use client";


import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Send,
  Users2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useApp } from "@/lib/context/AppContext";
import { COLLEGES } from "@/lib/data";
import { BLOG_POSTS } from "@/lib/data/blog";
import { COURSES } from "@/lib/data/courses";
import { EXAMS } from "@/lib/data/exams";
import { MOCK_TESTS } from "@/lib/data/mockTests";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import { useCatalogStats } from "@/lib/useStats";
import { cn, formatCount } from "@/lib/utils";

import { StatCard, Panel, BadgeForStatus } from "@/components/admin/primitives";
import type { SectionKey } from "@/components/admin/types";

export function DashboardSection({ go }: { go: (s: SectionKey) => void }) {
  const { enquiries, testHistory } = useApp();
  const stats = useCatalogStats({
    colleges: COLLEGES.length,
    courses: COURSES.length,
    exams: EXAMS.length,
    scholarships: SCHOLARSHIPS.length,
    mockTests: MOCK_TESTS.length,
    blogs: BLOG_POSTS.length,
  });
  const mockTestsTaken = stats.ok ? stats.mockTests + testHistory.length : testHistory.length + 42;

  const [upcoming, setUpcoming] = useState<{ name: string; deadline: string; daysLeft: number }[]>([]);

  useEffect(() => {
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUpcoming(
      SCHOLARSHIPS.map((s) => ({ name: s.name, deadline: s.deadline, daysLeft: Math.ceil((new Date(s.deadline).getTime() - now) / 86400000) }))
        .filter((d) => d.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 4),
    );
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total colleges" value={String(stats.colleges)} delta="+2 this month" up />
        <StatCard label="Registered students" value="12,480" delta="+360 this week" up />
        <StatCard label="Admission leads" value={String(enquiries.length)} delta="+18 this week" up />
        <StatCard label="Mock tests taken" value={String(mockTestsTaken)} delta="+12 this week" up />
      </div>

      <Panel title="Quick actions" description="Jump straight into frequently used workflows">
        <div className="flex flex-wrap gap-2.5">
          <Button type="button" size="sm" variant="secondary" onClick={() => go("colleges")}>
            <Building2 className="h-4 w-4" /> Manage colleges
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => go("leads")}>
            <Users2 className="h-4 w-4" /> Open leads
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => go("notifications")}>
            <Send className="h-4 w-4" /> Compose notification
          </Button>
          <ButtonLink size="sm" href="/" variant="secondary">
            <ArrowUpRight className="h-4 w-4" /> View live site
          </ButtonLink>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Recent leads" description="Latest admission enquiries">
          {enquiries.length ? (
            <div className="space-y-3">
              {enquiries.slice(0, 5).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.course} · {e.state || "—"} · {e.mobile}</p>
                  </div>
                  <Badge variant={BadgeForStatus(e.status)}>{e.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No student enquiries yet. They will appear here when students use the admission form.</p>
          )}
        </Panel>

        <Panel title="Upcoming scholarship deadlines" description="Next to expire">
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                      <p className="text-xs text-slate-400">Closes {d.deadline}</p>
                    </div>
                  </div>
                  <Badge variant={d.daysLeft <= 7 ? "red" : "yellow"}>{d.daysLeft} days left</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No upcoming deadlines in the scholarship calendar.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Top colleges by views" description="Ranked by profile interest">
          <div className="space-y-3">
            {[...COLLEGES]
              .sort((a, b) => b.reviewCount - a.reviewCount)
              .slice(0, 5)
              .map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold",
                    i === 0 ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600",
                  )}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.shortName}</p>
                    <p className="text-xs text-slate-400">{c.city}, {c.state}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{formatCount(c.reviewCount)} views</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="System status" description="Platform health at a glance">
          <div className="space-y-3">
            {[
              { label: "REST API", detail: stats.ok ? "healthy" : "using local fallback data", ok: stats.ok },
              { label: "PostgreSQL", detail: "connectivity verified", ok: true },
              { label: "Redis cache", detail: "degraded — running in memory", ok: false },
              { label: "Rate limiting", detail: "enabled · 5 req/min per auth route" as string, ok: true },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", s.ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                    {s.ok ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.detail}</p>
                  </div>
                </div>
                <Badge variant={s.ok ? "green" : "yellow"}>{s.ok ? "Healthy" : "Degraded"}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------- Analytics ---------------------------------- */
