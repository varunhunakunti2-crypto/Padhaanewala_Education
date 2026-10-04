"use client";

/**
 * The counsellor roster, from `GET /api/v1/counsellors`.
 *
 * This panel used to list four invented counsellors with invented lead counts,
 * conversion counts and star ratings (Anita Sharma: 142 leads, 61 converted,
 * 4.8 stars), then was replaced by a placeholder asserting "there is no counsellor
 * table in the database". Both were wrong: `counsellors` is a real table
 * (`app/models/user.py`), the endpoint is live, and `LeadsSection` already reads
 * this roster to populate its assign dropdown. The numbers are real now.
 *
 * Read-only on purpose. The only counsellor route is this GET — there is no
 * create, update or delete — so there is no add/edit/remove control to wire up,
 * and inventing one behind a toast would repeat the original sin. A counsellor
 * is deactivated through its linked `users` row in the Students panel.
 *
 * `active_leads` is counted by the same rule `services/lead_handoff` balances
 * on, so the capacity shown here is the capacity the round-robin assigner sees.
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { adminApi, type AdminCounsellor } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import {
  FilterChips,
  ProgressBar,
  SectionHeading,
  StatCard,
} from "@/components/admin/primitives";

type RosterFilter = "active" | "all";

/** A counsellor at or over `max_leads` cannot take another lead; the assign route 409s. */
function isAtCapacity(counsellor: AdminCounsellor): boolean {
  return counsellor.active_leads >= counsellor.max_leads;
}

function capacityPercent(counsellor: AdminCounsellor): number {
  if (counsellor.max_leads <= 0) return 100;
  return Math.round((counsellor.active_leads / counsellor.max_leads) * 100);
}

export function CounsellorsSection() {
  // Fetched with inactive rows included and filtered here, so toggling the chip
  // re-renders instantly instead of refetching, and both views come from one
  // snapshot rather than two requests that could disagree.
  const { data, error, loading } = useAdminResource(
    () => adminApi.counsellors({ includeInactive: true }),
    {
      forbiddenMessage: "Only an admin can view the counsellor roster.",
      unreachableMessage: "Could not reach the counsellors API.",
    },
  );

  const [filter, setFilter] = useState<RosterFilter>("active");

  const roster = useMemo(() => data ?? null, [data]);

  const active = useMemo(
    () => (roster ?? []).filter((c) => c.is_active),
    [roster],
  );

  const visible = useMemo(
    () => (filter === "active" ? active : (roster ?? [])),
    [filter, active, roster],
  );

  const openLeads = active.reduce((sum, c) => sum + c.active_leads, 0);
  const atCapacity = active.filter(isAtCapacity).length;

  return (
    <div>
      <SectionHeading
        title="Counsellors"
        description="Team roster and current lead load"
        count={filter === "active" ? active.length : roster?.length}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading counsellors…
        </p>
      ) : roster === null ? null : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active counsellors" value={String(active.length)} />
            <StatCard label="Deactivated" value={String(roster.length - active.length)} />
            <StatCard label="Open leads assigned" value={String(openLeads)} />
            <StatCard label="At capacity" value={String(atCapacity)} />
          </div>

          {roster.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
              No counsellors on the roster yet.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <FilterChips
                  options={["active", "all"] as const}
                  value={filter}
                  onChange={setFilter}
                  counts={{
                    active: active.length,
                    all: roster.length,
                  }}
                />
              </div>

              {visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                  No active counsellors. Every counsellor on the roster is deactivated.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Counsellor</th>
                        <th className="px-5 py-3 font-semibold">Specialization</th>
                        <th className="px-5 py-3 font-semibold">Lead load</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => {
                        const full = isAtCapacity(c);
                        return (
                          <tr key={c.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-gray-900">{c.name}</p>
                              <p className="text-xs text-slate-400">
                                Max {c.max_leads} leads
                              </p>
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {c.specialization ?? "—"}
                            </td>
                            <td className="w-56 px-5 py-4">
                              <ProgressBar
                                label={`${c.active_leads} of ${c.max_leads}`}
                                value={capacityPercent(c)}
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant={c.is_active ? "green" : "gray"}>
                                  {c.is_active ? "Active" : "Deactivated"}
                                </Badge>
                                {c.is_active && full && (
                                  <span className="text-xs font-medium text-amber-600">
                                    At capacity
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-400">
                Lead load counts enquiries still in play, excluding won, lost and closed. This
                roster is read-only — a counsellor is added or deactivated through its linked
                user account in the Students panel.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
