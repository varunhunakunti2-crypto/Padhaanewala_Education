"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, type AdminRole, type AdminUser } from "@/lib/api";
import {
  describePageRange,
  describeRoleDelta,
  isRoleCheckboxDisabled,
  roleIdsFor,
  roleLockedReason,
} from "@/lib/user-roles";
import { useAdminResource } from "@/components/admin/useAdminResource";
import {
  SectionHeading,
  IconAction,
  RowActions,
  FilterChips,
  BadgeForStatus,
} from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

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

/** Matches the backend's `limit` ceiling; kept in step with `PAGE_SIZE`. */
const PAGE_SIZE = 25;

/** Registered accounts from `GET /api/v1/users` (admin / super_admin only). */
export function StudentsSection() {
  const { showToast, roles } = useApp();

  // Server-side query state. The previous version fetched `GET /users` once with
  // no parameters and then filtered that single response in the browser, so every
  // filter and every count described one 50-row page rather than the account base
  // — with more than 50 accounts the console silently could not see the rest.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "all">("all");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  // Debounced so each keystroke does not fire a request. 300ms is long enough to
  // coalesce a burst of typing and short enough that the list still feels live.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Every query change resets to page 1, because page 3 of the previous result set
  // is meaningless against the new one — and a stale offset can land past the end
  // of a shorter result, which renders as a mysteriously empty table. Done in the
  // handlers rather than an effect on [search, status, role]: an effect that
  // synchronously setState re-renders twice per change.
  const applyStatus = (next: (typeof STATUSES)[number] | "all") => {
    setStatus(next);
    setPage(1);
  };

  const applyRole = (next: string) => {
    setRole(next);
    setPage(1);
  };

  const applySearchInput = (next: string) => {
    setSearchInput(next);
    setPage(1);
  };

  const query = useMemo(
    () => ({
      search: search || undefined,
      role: role || undefined,
      is_active: status === "all" ? undefined : status === "Active",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [search, status, role, page],
  );

  const reloadKey = `${search}|${status}|${role}|${page}`;
  const { data, error, loading, reload } = useAdminResource(
    () => adminApi.users(query),
    {
      forbiddenMessage: "You do not have permission to list users.",
      unreachableMessage: "Could not reach the users API.",
      reloadKey,
    },
  );
  const { data: allRoles } = useAdminResource<AdminRole[]>(
    () => adminApi.roles(),
    {
      forbiddenMessage: "You do not have permission to read roles.",
      unreachableMessage: "Could not reach the roles API.",
    },
  );

  const [pendingAction, setPendingAction] = useState<{ userId: string; kind: "active" } | null>(null);
  const [roleEditorFor, setRoleEditorFor] = useState<number | null>(null);
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set());
  const [mutating, setMutating] = useState(false);

  const rows = useMemo<StudentRow[]>(
    () =>
      (data?.items ?? []).map((u) => ({
        id: String(u.id),
        // `display_name` is the student's profile name, falling back to the email
        // server-side. This used to be `email.split("@")[0]`, which is a truncated
        // address presented in the column headed "Student" as though it were a name.
        name: u.display_name || u.email,
        email: u.email,
        mobile: u.mobile ?? "—",
        roles: u.roles.join(", ") || "—",
        status: u.is_active ? ("Active" as const) : ("Inactive" as const),
      })),
    [data],
  );

  const total = data?.total ?? 0;

  const findUser = (row: StudentRow): AdminUser | undefined =>
    data?.items.find((u) => String(u.id) === row.id);

  /**
   * R4.9 on the client: a `super_admin` account is super_admin-only, so a plain
   * admin must not be offered controls that can only 403. The authoritative check
   * is server-side; this only decides whether to *render* the buttons. Note the
   * role *set* is not decided here — `GET /roles` marks each role `grantable` for
   * this caller, so the editor below cannot offer a checkbox the API rejects.
   */
  const isSuperAdmin = roles.includes("super_admin");

  const openRoleEditor = (user: AdminUser) => {
    setRoleEditorFor(user.id);
    setDraftRoles(new Set(user.roles));
  };

  const saveRoles = async (user: AdminUser) => {
    if (!allRoles) return;

    const selection = roleIdsFor(draftRoles, allRoles);
    if (!selection.ok) {
      showToast({ variant: "error", title: "Could not update roles", description: selection.error });
      return;
    }

    const delta = describeRoleDelta(user.roles, draftRoles);

    setMutating(true);
    try {
      await adminApi.updateUser(user.id, { role_ids: selection.ids });
      showToast({
        variant: "success",
        title: delta ? "Roles updated" : "No change to save",
        description: delta
          ? `${user.email}: ${delta.join(", ")}`
          : `${user.email} already holds ${[...draftRoles].join(", ")}.`,
      });
      setRoleEditorFor(null);
      reload();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not update roles",
        description: err instanceof Error ? err.message : "The role change was rejected.",
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
        description: err instanceof Error ? err.message : "The account update was rejected.",
      });
    } finally {
      setMutating(false);
    }
  };

  const executePending = async (row: StudentRow) => {
    if (!pendingAction) return;
    const { userId } = pendingAction;
    setPendingAction(null);
    if (userId !== row.id) return;
    const user = findUser(row);
    if (!user) return;
    await toggleActive(user);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <SectionHeading
        title="Registered students"
        description="All student accounts across the platform"
        count={total}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Input
              value={searchInput}
              onChange={(e) => applySearchInput(e.target.value)}
              placeholder="Search name, email or mobile..."
              aria-label="Search accounts"
            />
          </div>
          <select
            value={role}
            onChange={(e) => applyRole(e.target.value)}
            aria-label="Filter by role"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            <option value="">Every role</option>
            {(allRoles ?? []).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* No counts here on purpose. The chip counts the current page, so an
              "Inactive · 3" label would be a claim about 25 accounts presented as
              a claim about all of them. The honest number is the range below. */}
          <FilterChips options={STATUSES} value={status} onChange={applyStatus} />
          <span className="text-xs text-slate-400">
            {loading
              ? "Loading…"
              : describePageRange(total, query.offset ?? 0, PAGE_SIZE)}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading accounts…
        </p>
      ) : (
        <>
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
                  const isSuperAdminRow = user?.roles.includes("super_admin") ?? false;
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
                          <button
                            type="button"
                            onClick={() => setPendingAction(null)}
                            className={CANCEL_BTN}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {canModify && (
                            <IconAction
                              title="Edit roles"
                              onClick={() => user && openRoleEditor(user)}
                              className="hover:bg-green-50 hover:text-green-700"
                            >
                              <ShieldCheck className="h-4 w-4" />
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
            rows={rows}
            // Search, filtering and paging are all server-side now, so the table's
            // own client-side search and 8-row pager must stay off — otherwise it
            // would re-filter one page of results and report "8 records" as though
            // that were the whole account base.
            searchKeys={undefined}
            pageSize={PAGE_SIZE}
            emptyState="No accounts match these filters."
          />

          {roleEditorFor !== null && (
            <RoleEditor
              user={data?.items.find((u) => u.id === roleEditorFor)}
              roles={allRoles}
              draft={draftRoles}
              setDraft={setDraftRoles}
              saving={mutating}
              onCancel={() => setRoleEditorFor(null)}
              onSave={() => {
                const target = data?.items.find((u) => u.id === roleEditorFor);
                if (target) void saveRoles(target);
              }}
            />
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition enabled:hover:border-purple-300 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition enabled:hover:border-purple-300 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Role editor.
 *
 * `grantable` comes from `GET /roles` and is the server's own answer to "may this
 * caller add this role", computed with the same `outranks()` the write path
 * enforces. Roles the caller cannot grant are still listed — hidden, they would
 * make a role appear not to exist, and an admin would reasonably conclude the
 * account had never held it — but disabled, with the reason shown.
 *
 * A role the account already holds stays checkable even when it is not grantable:
 * restating a held role is not an escalation (R4.8 excludes it from the delta),
 * and unchecking it is a *revocation*, which R4.8's removal ceiling governs
 * separately. Locking held roles would make them impossible to remove.
 */
function RoleEditor({
  user,
  roles,
  draft,
  setDraft,
  saving,
  onCancel,
  onSave,
}: {
  user: AdminUser | undefined;
  roles: AdminRole[] | null;
  draft: Set<string>;
  setDraft: (next: Set<string>) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!user) return null;

  const held = new Set(user.roles);
  const toggle = (name: string) => {
    const next = new Set(draft);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setDraft(next);
  };

  const grantableCount = (roles ?? []).filter((r) => r.grantable).length;

  return (
    <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Roles for {user.email}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {grantableCount} of {(roles ?? []).length} roles are grantable by you. Every change
            is recorded in the audit log against your account.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" disabled={saving} onClick={onCancel} className={CANCEL_BTN}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex h-7 items-center rounded-lg bg-purple-600 px-3 text-xs font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save roles"}
          </button>
        </div>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {(roles ?? []).map((r) => {
          const isHeld = held.has(r.name);
          const disabled = isRoleCheckboxDisabled(r, user.roles);
          const lockedReason = roleLockedReason(r, user.roles);
          const checked = draft.has(r.name);
          return (
            <li key={r.id}>
              <label
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
                  disabled
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                    : "cursor-pointer border-slate-200 bg-white hover:border-purple-300",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(r.name)}
                  className="mt-0.5 h-3.5 w-3.5 accent-purple-600"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {r.name}
                    {isHeld && (
                      <span className="rounded bg-slate-100 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        current
                      </span>
                    )}
                  </span>
                  {r.description && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                      {r.description}
                    </span>
                  )}
                  {lockedReason && (
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-700">
                      {lockedReason}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}