"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/context/AppContext";
import { adminApi } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading, FilterChips } from "@/components/admin/primitives";

/** Audit trail from `GET /api/v1/audit-logs` (super_admin / admin only). */
export function AuditSection() {
  const { data, error } = useAdminResource(
    () => adminApi.auditLogs(),
    {
      forbiddenMessage: "You do not have permission to view audit logs.",
      unreachableMessage: "Could not reach the audit API.",
    },
  );

  const logs = useMemo(
    () => data ?? null,
    [data],
  );
  const { showToast } = useApp();
  const [actor, setActor] = useState<string | "all">("all");

  const actors = useMemo(
    () => Array.from(new Set((logs ?? []).map((l) => l.user_email ?? "system"))).sort(),
    [logs],
  );

  const rows = (logs ?? []).filter((l) => actor === "all" || (l.user_email ?? "system") === actor);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const l of logs ?? []) {
      const key = l.user_email ?? "system";
      by[key] = (by[key] ?? 0) + 1;
    }
    return by;
  }, [logs]);

  const exportCsv = () => {
    if (!rows.length) return;
    const header = "id,action,entity_type,entity_id,actor,created_at";
    const body = rows
      .map((l) =>
        [
          l.id,
          JSON.stringify(l.action),
          l.entity_type ?? "",
          l.entity_id ?? "",
          l.user_email ?? "system",
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
        description="Every admin action, tracked"
        count={logs?.length}
        action={
          <Button type="button" size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {actors.length > 0 && (
        <div className="mb-4">
          <FilterChips
            options={actors}
            value={actor}
            onChange={setActor}
            counts={counts as Partial<Record<string, number>>}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No audit entries recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{l.action}</p>
                <p className="text-xs text-slate-400">
                  by {l.user_email ?? "system"}
                  {l.entity_type ? ` · ${l.entity_type}#${l.entity_id ?? "—"}` : ""}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(l.created_at).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
