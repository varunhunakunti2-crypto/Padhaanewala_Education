"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck, ShieldOff, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, type AdminRole, type AdminUser } from "@/lib/api";
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

const CONFIRM_BTN =
  "inline-flex h-7 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-50";
const CANCEL_BTN =
  "inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100";

/** Registered accounts from `GET /api/v1/users` (admin / super_admin only). */
export function StudentsSection() {
  const { showToast, roles } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [pendingAction, setPendingAction] = useState<{ userId: string; kind: "admin" | "active" } | null>(null);
  const [mutating, setMutating] = useState(false);
  const { data, error, loading, reload } = useAdminResource(
    () => adminApi.users(),
    {
      forbiddenMessage: "You do not have permission to list users.",
      unreachableMessage: "Could not reach the users API.",
    },
  );
  const { data: allRoles } = useAdminResource<AdminRole>(
    () => adminApi.roles(),
    {
      forbiddenMessage: "You do not have permission to read roles.",
      unreachableMessage: "Could not reach the roles API.",
    },
  );

  // Only a super_admin may grant or revoke the `admin` role — the backend's
  // privilege ceiling (R4.8) rejects the same request from a plain admin with
  // 403, so the button is hidden here rather than shown only to fail.
  const isSuperAdmin = roles.includes("super_admin");

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

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows ?? []) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [rows]);

  const filtered = (rows ?? []).filter((r) => status === "all" || r.status === status);

  const findUser = (row: StudentRow): AdminUser | undefined =>
    data?.find((u) => String(u.id) === row.id);

  const toggleAdmin = async (user: AdminUser) => {
    if (!allRoles) return;
    const adminRole = allRoles.find((r) => r.name === "admin");
    if (!adminRole) {
      showToast({
        variant: "error",
        title: "Admin role not provisioned",
        description: "Run scripts/seed_roles.py so the `admin` role exists.",
      });
      return;
    }
    const wasAdmin = user.roles.includes("admin");
    const nextNames = wasAdmin
      ? user.roles.filter((name) => name !== "admin")
      : [...user.roles, "admin"];
    const roleIds = nextNames
      .map((name) => allRoles.find((r) => r.name === name)?.id)
      .filter((id): id is number => id !== undefined);

    setMutating(true);
    try {
      await adminApi.updateUser(user.id, { role_ids: roleIds });
      showToast({
        variant: "success",
        title: wasAdmin ? "Admin access removed" : "Admin access granted",
        description: `${user.email} is ${wasAdmin ? "no longer" : "now"} an admin.`,
      });
      reload();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not update roles",
        description:
          err instanceof Error ? err.message : "The role change was rejected.",
      });
    } finally {
      setMutating(false);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    setMutating(true);
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      showToast({
        variant: "success",
        title: user.is_active ? "Account deactivated" : "Account activated",
        description: `${user.email} can ${user.is_active ? "no longer" : "now"} sign in.`,
      });
      reload();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not update account",
        description:
          err instanceof Error ? err.message : "The account update was rejected.",
      });
    } finally {
      setMutating(false);
    }
  };

  const executePending = async (row: StudentRow) => {
    if (!pendingAction) return;
    const { userId, kind } = pendingAction;
    setPendingAction(null);
    if (userId !== row.id) return;
    const user = findUser(row);
    if (!user) return;
    if (kind === "admin") await toggleAdmin(user);
    else await toggleActive(user);
  };

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
                  render: (s) => {
                    const user = findUser(s);
                    const isAdminUser = user?.roles.includes("admin") ?? false;
                    const isSuperAdminRow = user?.roles.includes("super_admin") ?? false;
                    // Mirror R4.9 on the client: only a super_admin may modify
                    // another super_admin account. A plain admin gets read-only
                    // rows for super_admins, matching the 403 the backend would
                    // return.
                    const canModify = isSuperAdmin || !isSuperAdminRow;
                    const isPending = pendingAction?.userId === s.id;
                    return (
                      <div className="flex items-center justify-end gap-1">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={mutating}
                              onClick={() => void executePending(s)}
                              className={CONFIRM_BTN}
                            >
                              Confirm
                            </button>
                            <button type="button" onClick={() => setPendingAction(null)} className={CANCEL_BTN}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {isSuperAdmin && (
                              <IconAction
                                title={isAdminUser ? "Remove admin" : "Make admin"}
                                onClick={() => setPendingAction({ userId: s.id, kind: "admin" })}
                                className={
                                  isAdminUser
                                    ? "hover:bg-red-50 hover:text-red-600"
                                    : "hover:bg-green-50 hover:text-green-700"
                                }
                              >
                                {isAdminUser ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                              </IconAction>
                            )}
                            {canModify && (
                              <IconAction
                                title={s.status === "Active" ? "Deactivate account" : "Activate account"}
                                onClick={() => setPendingAction({ userId: s.id, kind: "active" })}
                                className="hover:bg-purple-50 hover:text-purple-700"
                              >
                                {s.status === "Active" ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </IconAction>
                            )}
                            <RowActions item={s.name} noun="student" />
                          </>
                        )}
                      </div>
                    );
                  },
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