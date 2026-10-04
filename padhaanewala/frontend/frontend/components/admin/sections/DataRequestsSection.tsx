"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Inbox } from "lucide-react";

import {
  complianceApi,
  type DataRequest,
  type DataRequestStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/context/AppContext";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading, FilterChips } from "@/components/admin/primitives";

/**
 * The staff side of the DPDP data-principal queue.
 *
 * `GET /compliance/admin/requests` already returns rows ordered by `due_at`
 * ascending, which is the order the work has to be done in — the request
 * nearest to breaching the 90-day deadline is the one that needs attention
 * today, and it is not the one that arrived most recently. This panel
 * deliberately does **not** re-sort: a client-side sort by "newest first" would
 * quietly undo the one property the endpoint exists to provide.
 *
 * `due_at` is fixed by the server at intake, so the countdown here is rendered
 * from `days_remaining` as given. Recomputing it locally would produce a
 * deadline that moves every time the page is refreshed, which is not a
 * deadline.
 *
 * A terminal status cannot be reopened — the backend refuses it with a 409
 * because reopening would move `due_at`-based reporting backwards — so the
 * action list below only offers transitions from an open status.
 */

const STATUS_LABEL: Record<DataRequestStatus, string> = {
  received: "Received",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Declined",
};

const OPEN_STATUSES: ReadonlyArray<DataRequestStatus> = [
  "received",
  "acknowledged",
  "in_progress",
];

/** Legal transitions, mirroring the backend's own allowance. */
const NEXT_STATUS: Partial<Record<DataRequestStatus, DataRequestStatus[]>> = {
  received: ["acknowledged", "in_progress", "rejected"],
  acknowledged: ["in_progress", "rejected"],
  in_progress: ["completed", "rejected"],
};

const TYPE_LABEL: Record<DataRequest["request_type"], string> = {
  access: "Access — copy of my data",
  correction: "Correction",
  erasure: "Erasure",
  withdrawal: "Withdrawal of consent",
  grievance: "Grievance",
  nomination: "Nomination",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function DataRequestsSection() {
  const { showToast } = useApp();
  const { data, error, reload } = useAdminResource(() => complianceApi.adminRequests(), {
    forbiddenMessage: "You do not have permission to work the data-request queue.",
    unreachableMessage: "Could not reach the compliance API.",
  });

  const [filter, setFilter] = useState<DataRequestStatus | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  // One note per row rather than one shared box: a resolution typed while
  // looking at #7 must not be submitted against #12 by a stray click.
  const [resolution, setResolution] = useState<Record<number, string>>({});

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const by: Partial<Record<DataRequestStatus | "all", number>> = { all: rows.length };
    for (const r of rows) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const overdue = rows.filter((r) => r.overdue).length;
  const openCount = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length;

  const advance = async (row: DataRequest, status: DataRequestStatus) => {
    const note = (resolution[row.id] ?? "").trim();
    // Closing to `completed` or `rejected` without a resolution leaves the data
    // principal with a decision they cannot understand, and the record with
    // nothing to show what was decided.
    if ((status === "completed" || status === "rejected") && note.length < 5) {
      showToast({
        variant: "error",
        title: "Resolution required",
        description: "Say what was done (or why it was declined) before closing the request.",
      });
      return;
    }

    setBusyId(row.id);
    try {
      await complianceApi.updateAdminRequest(row.id, { status, resolution: note || null });
      setResolution((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await reload();
      showToast({
        variant: "success",
        title: `Request #${row.id} ${STATUS_LABEL[status].toLowerCase()}`,
        description: `Statutory deadline ${formatDate(row.due_at)}.`,
      });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not update",
        description: err instanceof Error && err.message ? err.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Data requests"
        description="DPDP s.8(5)–(6) — 90-day statutory clock, soonest deadline first"
        count={rows.length}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> Open
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold text-gray-900">{openCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Awaiting action
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold text-gray-900">
              {counts.received ?? 0}
            </p>
          </div>
          <div
            className={`rounded-xl px-4 py-3 ${
              overdue > 0
                ? "bg-red-50 dark:bg-red-950/40"
                : "bg-slate-50 dark:bg-slate-800/60"
            }`}
          >
            <p
              className={`flex items-center gap-1.5 text-xs font-medium ${
                overdue > 0 ? "text-red-600 dark:text-red-300" : "text-slate-400"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Past deadline
            </p>
            <p
              className={`mt-1 font-display text-2xl font-extrabold ${
                overdue > 0 ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-white"
              }`}
            >
              {overdue}
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-4">
          <FilterChips
            // No "all" here: `FilterChips` renders that chip itself, and
            // including it would both duplicate it and force T to widen past
            // the status union.
            options={["received", "acknowledged", "in_progress", "completed", "rejected"]}
            value={filter}
            onChange={setFilter}
            counts={counts}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          {rows.length === 0
            ? "No data-principal requests have been raised yet."
            : "Nothing with that status."}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const closed = !OPEN_STATUSES.includes(r.status);
            const options = NEXT_STATUS[r.status] ?? [];
            return (
              <div
                key={r.id}
                className={`rounded-xl border px-4 py-3.5 ${
                  r.overdue && !closed
                    ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30"
                    : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <span className="text-slate-400">#{r.id}</span>
                      {TYPE_LABEL[r.request_type]}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          closed
                            ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                            : r.overdue
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{r.details}</p>
                    {r.subject ? (
                      <p className="mt-1 text-xs text-slate-400">Subject: {r.subject}</p>
                    ) : null}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>Received {formatDate(r.received_at)}</span>
                      <span>Due {formatDate(r.due_at)}</span>
                      {!closed &&
                        (r.overdue ? (
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {Math.abs(r.days_remaining)} days overdue
                          </span>
                        ) : (
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {r.days_remaining} day{r.days_remaining === 1 ? "" : "s"} left
                          </span>
                        ))}
                      {closed && r.completed_at ? <span>Closed {formatDate(r.completed_at)}</span> : null}
                    </p>
                    {r.resolution ? (
                      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                        {r.resolution}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!closed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <input
                      type="text"
                      value={resolution[r.id] ?? ""}
                      onChange={(e) => setResolution((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Resolution note (required to close)"
                      aria-label={`Resolution for request ${r.id}`}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    {options.map((next) => (
                      <Button
                        key={next}
                        type="button"
                        size="xs"
                        variant={
                          next === "rejected"
                            ? "danger"
                            : next === "completed"
                              ? "primary"
                              : "secondary"
                        }
                        disabled={busyId === r.id}
                        onClick={() => void advance(r, next)}
                      >
                        {STATUS_LABEL[next]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
