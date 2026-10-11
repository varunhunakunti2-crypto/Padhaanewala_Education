"use client";

import { useMemo } from "react";
import { adminApi, type AdminAnalytics } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { Panel, SectionHeading, StatCard } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-IN");
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

const SERIES_COLORS = [
  { label: "Leads", bar: "bg-purple-500", dot: "bg-purple-500" },
  { label: "Registrations", bar: "bg-indigo-500", dot: "bg-indigo-500" },
  { label: "Test attempts", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  { label: "Reviews", bar: "bg-amber-400", dot: "bg-amber-400" },
] as const;

/**
 * Analytics measured from the platform's own tables.
 *
 * Every figure here comes from `GET /api/v1/admin/analytics/overview`, which
 * aggregates real rows — users, enquiries, mock-test attempts, approved reviews
 * and saved colleges. Nothing is hypothesised, extrapolated or hand-placed:
 * this screen previously drew a full "traffic" dashboard out of hardcoded
 * arrays, and that is exactly the failure mode this replacement avoids.
 *
 * What it does **not** show: page views, sessions, traffic, devices or a
 * visitor funnel. This codebase records no page-view events, so there is nothing
 * honest to plot for any of those, and the panel says so rather than implying
 * otherwise.
 */
export function AnalyticsSection() {
  const { data, error, loading } = useAdminResource<AdminAnalytics>(() =>
    adminApi.analytics(),
  );

  const generatedAt = useMemo(() => {
    if (!data?.generated_at) return null;
    const t = new Date(data.generated_at).getTime();
    return Number.isNaN(t) ? null : new Date(data.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [data]);

  const series = useMemo(() => data?.series ?? [], [data]);
  const seriesMax = useMemo(() => {
    const max = { leads: 0, registrations: 0, attempts: 0, reviews: 0 };
    for (const p of series) {
      max.leads = Math.max(max.leads, p.leads);
      max.registrations = Math.max(max.registrations, p.registrations);
      max.attempts = Math.max(max.attempts, p.attempts);
      max.reviews = Math.max(max.reviews, p.reviews);
    }
    return max;
  }, [series]);

  const seriesTotals = useMemo(
    () => series.reduce(
      (acc, p) => {
        acc.leads += p.leads;
        acc.registrations += p.registrations;
        acc.attempts += p.attempts;
        acc.reviews += p.reviews;
        return acc;
      },
      { leads: 0, registrations: 0, attempts: 0, reviews: 0 },
    ),
    [series],
  );

  const windowActive = series.some((p) => p.leads + p.registrations + p.attempts + p.reviews > 0);

  return (
    <div>
      <SectionHeading
        title="Analytics"
        description="Live platform numbers measured from the database"
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Reading the analytics endpoint…
        </p>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Registered users" value={fmt(data.users.total)} />
            <StatCard label="Admission leads" value={fmt(data.leads.total)} />
            <StatCard label="Published reviews" value={fmt(data.reviews.total)} />
            <StatCard label="Saved colleges" value={fmt(data.saved_colleges)} />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active mock tests" value={fmt(data.mock_tests.papers)} />
            <StatCard label="Test attempts" value={fmt(data.mock_tests.attempts_total)} />
            <StatCard label="Completed attempts" value={fmt(data.mock_tests.attempts_completed)} />
            <StatCard
              label="Average score (completed)"
              value={data.mock_tests.average_percentage === null ? "—" : `${data.mock_tests.average_percentage}%`}
            />
          </div>

          <Panel title="Catalogue size" description="Same visibility rules as the public pages">
            <div className="flex flex-wrap gap-2">
              {[
                ["Colleges", data.catalogue.colleges],
                ["Courses", data.catalogue.courses],
                ["Exams", data.catalogue.exams],
                ["Mock tests", data.catalogue.mock_tests],
                ["Scholarships", data.catalogue.scholarships],
                ["Blog posts", data.catalogue.blogs],
              ].map(([label, value]) => (
                <span key={label} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {label}: <span className="text-gray-900">{fmt(value as number)}</span>
                </span>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel title="Admission funnel" description={`Leads by status · ${fmt(data.leads.total)} total · ${fmt(data.leads.new_7d)} new in 7 days · ${fmt(data.leads.new_30d)} in 30`}>
              {data.leads.by_status.length ? (
                <div className="space-y-4">
                  {data.leads.by_status.map((s) => {
                    const share = data.leads.total ? (s.count / data.leads.total) * 100 : 0;
                    return (
                      <div key={s.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium capitalize text-gray-700">{titleCase(s.name)}</span>
                          <span className="text-xs font-semibold text-slate-500">
                            {fmt(s.count)} · {share.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-700 to-indigo-500"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No enquiries yet. Leads will appear here as students use the admission form.
                </p>
              )}
            </Panel>

            <Panel title="Where leads come from" description="By source, most frequent first">
              {data.leads.by_source.length ? (
                <div className="space-y-2.5">
                  {data.leads.by_source.map((s) => (
                    <div key={s.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-700">{s.name}</span>
                      <span className="text-xs font-semibold text-slate-500">{fmt(s.count)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No enquiry has a recorded source yet.</p>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel title="Mock test engagement" description="Most-attempted papers">
              {data.mock_tests.top_papers.length ? (
                <div className="space-y-3">
                  {data.mock_tests.top_papers.map((p, i) => (
                    <div key={p.slug} className="flex items-center gap-3">
                      <span className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold",
                        i === 0 ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600",
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{fmt(p.attempts)} attempt{p.attempts === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No mock-test attempts yet. This list fills in as students take tests.
                </p>
              )}
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {fmt(data.mock_tests.attempts_30d)} attempts in the last 30 days.
              </p>
            </Panel>

            <Panel title="Account base" description="Who holds accounts in the platform">
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Total", data.users.total],
                  ["Active", data.users.active],
                  ["New · 30 days", data.users.new_30d],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-2 py-3">
                    <p className="font-display text-xl font-extrabold text-gray-900">{fmt(value as number)}</p>
                    <p className="text-[11px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {data.users.by_role.length ? (
                <div className="space-y-2.5">
                  {data.users.by_role.map((r) => (
                    <div key={r.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                      <span className="text-sm font-medium capitalize text-gray-700">{titleCase(r.name)}</span>
                      <span className="text-xs font-semibold text-slate-500">{fmt(r.count)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No accounts carry a role yet.</p>
              )}
            </Panel>
          </div>

          <Panel title="Activity — last 14 days" description="Real rows per day: enquiries, registrations, test submissions and published reviews">
            {windowActive ? (
              <>
                <div className="mb-3 flex flex-wrap gap-4">
                  {SERIES_COLORS.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className={cn("h-2 w-2 rounded-full", c.dot)} /> {c.label}
                    </span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {series.map((p) => {
                    const day = new Date(`${p.date}T00:00:00`);
                    const label = Number.isNaN(day.getTime())
                      ? p.date
                      : day.toLocaleDateString(undefined, { day: "numeric", month: "short" });
                    const bars = [
                      p.leads / Math.max(1, seriesMax.leads),
                      p.registrations / Math.max(1, seriesMax.registrations),
                      p.attempts / Math.max(1, seriesMax.attempts),
                      p.reviews / Math.max(1, seriesMax.reviews),
                    ] as const;
                    return (
                      <div key={p.date} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
                        {SERIES_COLORS.map((c, i) => (
                          <div key={c.label} className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full rounded-full", c.bar)}
                              style={{ width: bars[i] > 0 ? `${Math.max(4, bars[i] * 100)}%` : "0%" }}
                            />
                          </div>
                        ))}
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-400">
                          {p.leads} · {p.registrations} · {p.attempts} · {p.reviews}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Window totals — {fmt(seriesTotals.leads)} leads · {fmt(seriesTotals.registrations)} registrations ·{" "}
                  {fmt(seriesTotals.attempts)} test attempts · {fmt(seriesTotals.reviews)} reviews
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                No activity recorded in the last 14 days. This chart fills in as students register, submit
                enquiries, take mock tests and leave reviews.
              </p>
            )}
          </Panel>

          <p className="px-1 text-xs leading-relaxed text-slate-400">
            {generatedAt
              ? `Measured ${generatedAt} from the live database. `
              : "Generated timestamp unavailable. "}
            Every number above is a count of real rows in the platform&apos;s tables. This panel does not
            report traffic, sessions or devices: the platform records no page-view events, and it would
            rather leave those charts out than invent them.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No analytics data to show.
        </p>
      )}
    </div>
  );
}