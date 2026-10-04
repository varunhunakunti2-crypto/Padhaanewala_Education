"use client";


import { useMemo, useState } from "react";
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
import { adminApi, type AdminScholarship } from "@/lib/api";
import type { ApiCollegeListItem } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { useCatalogStats, useBackendHealth } from "@/lib/useStats";
import { cn } from "@/lib/utils";

import { StatCard, Panel, BadgeForStatus } from "@/components/admin/primitives";
import type { SectionKey } from "@/components/admin/types";

/**
 * Everything on this page is derived from the live catalogue or from the signed-in
 * user's own local data.
 *
 * It previously reported a fixed "12,480 registered students (+360 this week)",
 * invented week-over-week deltas on every stat card, added a flat `+ 42` to the
 * mock-test count when the API was unreachable, ranked colleges by review count
 * under a "by views" heading, and hardcoded platform health (PostgreSQL
 * "connectivity verified", Redis "degraded", "5 req/min") that nothing here
 * actually checks. None of that data existed, so the counters now read 0 and the
 * deltas are gone.
 *
 * The two rows below System status are measured, not asserted. The PostgreSQL row
 * comes from `GET /health`, which runs a real `SELECT 1` against the database, and
 * the REST API row comes from `/api/stats`, which reports which catalogue
 * endpoints answered. A source that failed is named instead of being folded into a
 * silent zero.
 */
export function DashboardSection({ go }: { go: (s: SectionKey) => void }) {
  const { enquiries, testHistory } = useApp();
  const stats = useCatalogStats();
  const health = useBackendHealth();
  // Both of these used to be hand-written `?limit=200` and `?limit=1000` queries
  // against routes that cap `limit` at 100 — a 422 each, rendered by
  // `useAdminResource` as an unreachable API, so the deadline panel and the
  // "recently added" list were silently empty on every load. The `adminApi` walks
  // are held against the real `le=` bounds by `tests/page-size-contract.test.ts`.
  const { data: scholarships } = useAdminResource<AdminScholarship[]>(() =>
    adminApi.scholarships(),
  );
  const { data: colleges } = useAdminResource<ApiCollegeListItem[]>(() => adminApi.colleges());

  // "Now" is captured once at mount: reading the clock during render makes the
  // deadline list depend on when React happened to re-render.
  const [now] = useState(() => Date.now());

  // Only schemes that actually carry a future deadline are listed; a scholarship
  // with no date is not "upcoming", and inventing a date for it would be worse
  // than leaving it out.
  const upcoming = useMemo(() => {
    return (scholarships ?? [])
      .filter((s) => !!s.application_deadline && !s.application_deadline.startsWith("0000"))
      .map((s) => ({
        name: s.name,
        deadline: s.application_deadline as string,
        daysLeft: Math.ceil((new Date(s.application_deadline as string).getTime() - now) / 86400000),
      }))
      .filter((d) => !Number.isNaN(d.daysLeft) && d.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [scholarships, now]);

  const reviewed = useMemo(
    () =>
      (colleges ?? [])
        .filter((c) => c.total_reviews > 0)
        .sort((a, b) => b.total_reviews - a.total_reviews)
        .slice(0, 5),
    [colleges],
  );

  // Every row states something that was measured. `pending` is a real third state:
  // a health check that has not answered yet must not be rendered as healthy.
  const statusRows = useMemo(() => {
    const rows: { label: string; detail: string; tone: "good" | "bad" | "pending"; badge: string }[] = [];

    const failed = stats.failed ?? [];
    rows.push({
      label: "REST API",
      detail: stats.ok
        ? "every catalogue endpoint answered"
        : failed.length
          ? `failed: ${failed.join(", ")}`
          : "did not respond",
      tone: stats.ok ? "good" : "bad",
      badge: stats.ok ? "Healthy" : "Degraded",
    });

    if (health === null) {
      rows.push({
        label: "PostgreSQL",
        detail: "waiting for the health endpoint to answer",
        tone: "pending",
        badge: "Checking",
      });
    } else {
      const db = health.checks?.database;
      rows.push({
        label: "PostgreSQL",
        detail: db?.detail ?? health.error ?? "the health endpoint reported no database check",
        tone: db?.ok ? "good" : "bad",
        badge: db?.ok ? "Reachable" : "Unreachable",
      });
    }

    return rows;
  }, [stats, health]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Colleges" value={String(stats.colleges)} />
        <StatCard label="Courses" value={String(stats.courses)} />
        <StatCard label="Exams" value={String(stats.exams)} />
        <StatCard label="Mock tests" value={String(stats.mockTests)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Scholarships" value={String(stats.scholarships)} />
        <StatCard label="Blog posts" value={String(stats.blogs)} />
        <StatCard label="Admission leads" value={String(enquiries.length)} />
        <StatCard label="Mock tests you took" value={String(testHistory.length)} />
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
            <p className="text-sm text-slate-400">
              No scholarship deadlines in the catalogue yet. Add a scheme with a deadline and it will appear here.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Colleges with the most reviews" description="From the review table">
          {reviewed.length ? (
            <div className="space-y-3">
              {reviewed.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold",
                    i === 0 ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600",
                  )}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.city ?? "Location not recorded"}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {c.total_reviews} review{c.total_reviews === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No college has any reviews yet. This list fills in as students leave reviews.
            </p>
          )}
        </Panel>

        <Panel title="System status" description="What this panel can actually verify">
          <div className="space-y-3">
            {statusRows.map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", s.tone === "good" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                    {s.tone === "good" ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.detail}</p>
                  </div>
                </div>
                <Badge variant={s.tone === "good" ? "green" : "yellow"}>{s.badge}</Badge>
              </div>
            ))}
            <p className="px-1 text-xs leading-relaxed text-slate-400">
              {health
                ? `Measured ${health.checkedAt ? new Date(health.checkedAt).toLocaleString() : "just now"} against the backend health endpoint.`
                : "Checking the backend health endpoint\u2026"}
              {" "}Cache and rate-limit health are still not reported: no endpoint measures them yet.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------- Analytics ---------------------------------- */
