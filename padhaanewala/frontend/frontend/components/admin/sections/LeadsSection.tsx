"use client";

import { useMemo, useState } from "react";
import { Eye, ShieldAlert, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, isForbidden } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import {
  SectionHeading,
  IconAction,
  FilterChips,
  BadgeForStatus,
} from "@/components/admin/primitives";

interface LeadRow {
  id: string;
  name: string;
  mobile: string;
  course: string;
  state: string;
  status: string;
}

const STATUSES = ["new", "contacted", "converted"] as const;

const nextStatus = (s: string) => (s === "new" ? "contacted" : "converted");

/**
 * Admission leads, read from `GET /api/v1/leads` (role-gated to
 * admin / super_admin / counsellor).
 *
 * When the API is unreachable or the signed-in user lacks the role, the panel
 * says so explicitly rather than silently rendering an empty table that looks
 * like "no leads exist".
 */
export function LeadsSection() {
  const { enquiries, showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, error, reload } = useAdminResource(() => adminApi.leads(), {
    forbiddenMessage: "You do not have permission to view leads.",
    unreachableMessage: "Could not reach the leads API.",
  });

  const rows = useMemo<LeadRow[] | null>(
    () =>
      data?.map((l) => ({
        id: String(l.id),
        name: l.name,
        mobile: l.mobile,
        course: "\u2014",
        state: "\u2014",
        status: l.status,
      })) ?? null,
    [data],
  );

  const advanceLead = async (row: LeadRow) => {
    const to = nextStatus(row.status);
    setBusyId(Number(row.id));
    try {
      await adminApi.updateLeadStatus(Number(row.id), to);
      reload();
      showToast({
        title: `Lead ${row.status} \u2192 ${to}`,
        description: `${row.name} moved to ${to}.`,
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not update lead",
        description: isForbidden(err) ? "You lack permission for this action." : "Please retry.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  // Local enquiries captured in this browser session, shown as a supplement.
  const local = useMemo<LeadRow[]>(
    () =>
      enquiries.map((e) => ({
        id: e.id,
        name: e.name,
        mobile: e.mobile,
        course: e.course,
        state: e.state || "—",
        status: e.status,
      })),
    [enquiries],
  );

  const all = useMemo(() => {
    const seen = new Set((rows ?? []).map((r) => r.id));
    return [...(rows ?? []), ...local.filter((r) => !seen.has(r.id))];
  }, [rows, local]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const l of all) by[l.status] = (by[l.status] ?? 0) + 1;
    return by;
  }, [all]);

  const filtered = status === "all" ? all : all.filter((l) => l.status === status);

  return (
    <div>
      <SectionHeading
        title="Admission leads"
        description="Track and convert incoming enquiries"
        count={all.length}
      />
      <div className="mb-4">
        <FilterChips
          options={STATUSES}
          value={status}
          onChange={setStatus}
          counts={counts as Partial<Record<string, number>>}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {all.length ? (
        <DataTable
          columns={[
            {
              key: "name",
              header: "Name",
              render: (e) => <span className="font-semibold text-gray-900">{e.name}</span>,
            },
            { key: "mobile", header: "Mobile" },
            { key: "course", header: "Course" },
            { key: "state", header: "State" },
            {
              key: "status",
              header: "Status",
              render: (e) => <Badge variant={BadgeForStatus(e.status)}>{e.status}</Badge>,
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (e) => (
                <div className="flex items-center justify-end gap-1">
                  {e.status !== "converted" && (
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      disabled={busyId === Number(e.id)}
                      onClick={() => advanceLead(e)}
                    >
                      <UserCheck className="h-3.5 w-3.5" />{" "}
                      {e.status === "new" ? "Contact" : "Convert"}
                    </Button>
                  )}
                  <IconAction
                    title="View lead"
                    onClick={() =>
                      showToast({
                        title: "View lead",
                        description: `Full profile for ${e.name}.`,
                        variant: "info",
                      })
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </IconAction>
                </div>
              ),
            },
          ]}
          rows={filtered}
          searchKeys={["name", "mobile", "course", "state"]}
          searchPlaceholder="Search leads..."
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">
            No leads yet. Enquiries from the &quot;Get Admission Help&quot; forms will appear here
            instantly.
          </p>
        </div>
      )}
    </div>
  );
}
