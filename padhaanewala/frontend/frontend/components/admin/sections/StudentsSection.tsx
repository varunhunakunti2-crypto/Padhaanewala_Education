"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { useApp } from "@/lib/context/AppContext";
import { adminApi } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import {
  SectionHeading,
  IconAction,
  RowActions,
  FilterChips,
  BadgeForStatus,
} from "@/components/admin/primitives";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  roles: string;
  status: "Active" | "Inactive";
}

const STATUSES = ["Active", "Inactive"] as const;

/** Registered accounts from `GET /api/v1/users` (admin / super_admin only). */
export function StudentsSection() {
  const { showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const { data, error, loading } = useAdminResource(
    () => adminApi.users(),
    {
      forbiddenMessage: "You do not have permission to list users.",
      unreachableMessage: "Could not reach the users API.",
    },
  );

  const rows = useMemo<StudentRow[] | null>(
    () =>
      data?.map((u) => ({
        id: String(u.id),
        name: u.email.split("@")[0] ?? u.email,
        email: u.email,
        mobile: u.mobile ?? "\u2014",
        roles: u.roles.join(", ") || "\u2014",
        status: u.is_active ? ("Active" as const) : ("Inactive" as const),
      })) ?? null,
    [data],
  );

  const toggle = async (row: StudentRow) => {
    showToast({
      title: "Activate / deactivate",
      description: "Account status changes are not wired to this button yet.",
      variant: "info",
    });
    void row;
  };

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows ?? []) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [rows]);

  const filtered = (rows ?? []).filter((r) => status === "all" || r.status === status);

  return (
    <div>
      <SectionHeading
        title="Registered students"
        description="All student accounts across the platform"
        count={rows?.length}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading accounts…
        </p>
      ) : rows && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No user accounts found.
        </p>
      ) : (
        rows && (
          <>
            <div className="mb-4">
              <FilterChips
                options={STATUSES}
                value={status}
                onChange={setStatus}
                counts={counts as Partial<Record<string, number>>}
              />
            </div>
            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Student",
                  render: (s) => <span className="font-semibold text-gray-900">{s.name}</span>,
                },
                { key: "email", header: "Email" },
                { key: "mobile", header: "Mobile" },
                { key: "roles", header: "Roles" },
                {
                  key: "status",
                  header: "Status",
                  render: (s) => <Badge variant={BadgeForStatus(s.status)}>{s.status}</Badge>,
                },
                {
                  key: "actions",
                  header: "",
                  className: "text-right",
                  render: (s) => (
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        title={s.status === "Active" ? "Deactivate account" : "Activate account"}
                        onClick={() => toggle(s)}
                        className="hover:bg-purple-50 hover:text-purple-700"
                      >
                        {s.status === "Active" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </IconAction>
                      <RowActions item={s.name} noun="student" />
                    </div>
                  ),
                },
              ]}
              rows={filtered}
              searchKeys={["name", "email", "mobile", "roles"]}
              searchPlaceholder="Search students..."
            />
          </>
        )
      )}
    </div>
  );
}
