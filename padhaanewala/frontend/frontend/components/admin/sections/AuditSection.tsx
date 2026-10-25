"use client";

import { useMemo, useState } from "react";
import { Download, LogIn, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/AppContext";
import {
  AUDIT_MAX_ROWS,
  AUDIT_PAGE_SIZE,
  adminApi,
  type AdminAuditLog,
} from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading } from "@/components/admin/primitives";

/**
 * The actor of an audit row.
 *
 * This reads `username`, which is the field the backend actually sends (a
 * `users.display_name`, populated by `routers/audit.py::_to_response`). It was
 * previously read as `user_email`, which does not exist on `AuditLogResponse`,
 * so every row resolved to `undefined` and fell through to "system" — the
 * actor filter collapsed to a single chip, and the CSV's `actor` column exported
 * nothing. Declared at module scope so it is a stable reference inside the
 * `useMemo` bodies below.
 */
function actorOf(log: AdminAuditLog): string {
  return log.username ?? "system";
}

/**
 * The sign-in method recorded on a `login` row, or `null` for every other
 * action. `POST /auth/login` writes `{"method": "password"}` and
 * `POST /auth/login/otp/verify` writes `{"method": "otp"}`.
 *
 * A row written before login auditing existed has no method at all, so the
 * fallback says so rather than guessing which path was used.
 */
function loginMethodOf(log: AdminAuditLog): string | null {
  if (log.action !== "login") return null;
  const method = log.new_value?.method;
  if (method === "password") return "password";
  if (method === "otp") return "one-time code";
  return "unknown method";
}

/** "Signed in" reads better in a history than the stored `login` action. */
function actionLabelOf(log: AdminAuditLog): string {
  return log.action === "login" ? "Signed in" : log.action;
}

interface AuditFilters {
  q: string;
  loginsOnly: boolean;
}

const NO_FILTERS: AuditFilters = { q: "", loginsOnly: false };

/**
 * The audit trail, with the search an investigation actually opens it for:
 * "what has this person been doing, and when did they sign in?"
 *
 * Search runs on the server (`?q=`) rather than over the fetched page. The
 * panel used to fetch the default fifty rows and filter them in the browser,
 * which is not a search of the audit trail — a person's history routinely
 * outgrows one page, and the row being looked for is usually the older one.
 * The `login` action is written by the auth routes, so `Logins only` is a
 * one-press login history.
 */
export function AuditSection() {
  const { showToast } = useApp();
  // `filters` is what the controls hold; `applied` is what has been sent. Two
  // pieces of state because the list is fetched: a request per keystroke would
  // hammer the API and flicker the panel on every character.
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(NO_FILTERS);
  const [limit, setLimit] = useState(AUDIT_PAGE_SIZE);

  const query = useMemo(
    () => ({
      q: applied.q.trim() || undefined,
      action: applied.loginsOnly ? "login" : undefined,
      limit,
    }),
    [applied, limit],
  );

  const { data, error, loading } = useAdminResource<AdminAuditLog[]>(
    () => adminApi.auditLogs(query),
    {
      // `q`, the login switch and the window are all server-side, so the reload
      // key has to change with every one of them.
      reloadKey: `${query.q ?? ""}|${query.action ?? ""}|${query.limit}`,
      forbiddenMessage: "You do not have permission to view audit logs.",
      unreachableMessage: "Could not reach the audit API.",
    },
  );

  const rows = useMemo(() => data ?? [], [data]);
  const isFiltered = applied.q.trim() !== "" || applied.loginsOnly;
  // A full window may or may not have an older page behind it; the backend does
  // not return a total, so offering the next window is the honest option. At
  // the cap the button gives way to a note instead of a dead control.
  const mayHaveOlder = rows.length >= limit;
  const canShowMore = mayHaveOlder && limit < AUDIT_MAX_ROWS;

  /** Apply a query and restart at the first window. */
  const apply = (next: AuditFilters) => {
    setApplied(next);
    setLimit(AUDIT_PAGE_SIZE);
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const header = "id,action,method,entity_type,entity_id,actor,ip_address,created_at";
    const body = rows
      .map((l) =>
        [
          l.id,
          JSON.stringify(l.action),
          JSON.stringify(loginMethodOf(l) ?? ""),
          l.entity_type ?? "",
          l.entity_id ?? "",
          JSON.stringify(actorOf(l)),
          l.ip_address ?? "",
          l.created_at,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ title: "Export ready", description: `${rows.length} rows downloaded.`, variant: "success" });
  };

  return (
    <div>
      <SectionHeading
        title="Audit logs"
        description="Sign-ins and privileged writes, newest first. Search a name to follow one person's activity."
        count={rows.length}
        action={
          <Button type="button" size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <form
        role="search"
        aria-label="Search audit logs"
        onSubmit={(e) => {
          e.preventDefault();
          apply(filters);
        }}
        className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="audit-search">Search by person</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                id="audit-search"
                value={filters.q}
                placeholder="Name, email, action or IP address…"
                autoComplete="off"
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={filters.loginsOnly}
              onClick={() => {
                const next = { ...filters, loginsOnly: !filters.loginsOnly };
                setFilters(next);
                apply(next);
              }}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition",
                filters.loginsOnly
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              <LogIn aria-hidden className="h-4 w-4" /> Logins only
            </button>
            <Button type="submit" size="md">
              Search
            </Button>
            {isFiltered && (
              <Button
                type="button"
                size="md"
                variant="ghost"
                onClick={() => {
                  setFilters(NO_FILTERS);
                  apply(NO_FILTERS);
                }}
              >
                <X aria-hidden className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Matches the person&apos;s name or email, and also the action, entity type or
          IP address. Leave it empty to see everything.
        </p>
      </form>

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading audit entries…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          {isFiltered
            ? "No audit entries match this search."
            : "No audit entries recorded yet."}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((l) => {
              const method = loginMethodOf(l);
              return (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {actionLabelOf(l)}
                      {method && (
                        <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                          {method}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      by {actorOf(l)}
                      {/* A login row's entity is the actor's own account, so the
                          id adds nothing there; the method above is the useful
                          detail instead. */}
                      {!method && l.entity_type
                        ? ` · ${l.entity_type}#${l.entity_id ?? "—"}`
                        : ""}
                      {l.ip_address ? ` · ${l.ip_address}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(l.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
              );
            })}
          </div>

          {canShowMore ? (
            <div className="mt-4 flex flex-col items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setLimit((n) => Math.min(n + AUDIT_PAGE_SIZE, AUDIT_MAX_ROWS))
                }
              >
                Show more
              </Button>
              <p className="text-xs text-slate-400">
                Showing the {rows.length} most recent matches.
              </p>
            </div>
          ) : mayHaveOlder && limit >= AUDIT_MAX_ROWS ? (
            <p className="mt-4 text-center text-xs text-slate-400">
              Showing the {AUDIT_MAX_ROWS} most recent matches. Add a name, action or
              IP to narrow the search for older entries.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
