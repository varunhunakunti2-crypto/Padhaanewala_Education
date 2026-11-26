"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/admin/fields";
import { useApp } from "@/lib/context/AppContext";
import {
  adminApi,
  type AdminRole,
  type AdminUpdateUserPayload,
  type AdminUser,
} from "@/lib/api";
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
    (signal) => adminApi.users(query, signal),
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

  // The three row dialogs. Each holds the *user id*, not the row object, so the
  // View dialog can re-read the account from `GET /users/{id}` instead of
  // showing a snapshot taken when the page loaded — a role change made in
  // another tab would otherwise be presented as current.
  const [viewFor, setViewFor] = useState<number | null>(null);
  const [editFor, setEditFor] = useState<AdminUser | null>(null);
  const [deleteFor, setDeleteFor] = useState<AdminUser | null>(null);

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

  /**
   * Save the Edit dialog. The payload is built by the dialog and contains only
   * the fields that actually changed, so a name correction cannot accidentally
   * rewrite the address and clear its verification.
   */
  const saveIdentity = async (target: AdminUser, payload: AdminUpdateUserPayload) => {
    setMutating(true);
    try {
      await adminApi.updateUser(target.id, payload);
      showToast({
        variant: "success",
        title: "Student updated",
        description: `${payload.email ?? target.email} was saved.`,
      });
      setEditFor(null);
      reload();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not update student",
        description: err instanceof Error ? err.message : "The change was rejected.",
      });
    } finally {
      setMutating(false);
    }
  };

  /**
   * Delete an account. The backend decides what "delete" means (the schema's own
   * cascade and null-out rules); the console only asks for confirmation.
   *
   * When the deleted row was the last one on a page above the first, the list
   * steps back a page instead of reloading into an empty table — otherwise the
   * admin is left on "Page 3 of 2" with nothing in it.
   */
  const deleteStudent = async (target: AdminUser) => {
    setMutating(true);
    try {
      await adminApi.deleteUser(target.id);
      showToast({
        variant: "success",
        title: "Student deleted",
        description: `${target.email} and its dependent records were removed.`,
      });
      setDeleteFor(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not delete student",
        description: err instanceof Error ? err.message : "The delete was rejected.",
      });
    } finally {
      setMutating(false);
    }
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
                          <IconAction
                            title="View student"
                            onClick={() => setViewFor(Number(s.id))}
                            className="hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye className="h-4 w-4" />
                          </IconAction>
                          {canModify && (
                            <IconAction
                              title="Edit student"
                              onClick={() => user && setEditFor(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconAction>
                          )}
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
                          {canModify && (
                            <IconAction
                              title="Delete student"
                              onClick={() => user && setDeleteFor(user)}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconAction>
                          )}
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

          {viewFor !== null && (
            <ViewStudentDialog userId={viewFor} onClose={() => setViewFor(null)} />
          )}

          {editFor !== null && (
            <EditStudentDialog
              user={editFor}
              saving={mutating}
              onClose={() => setEditFor(null)}
              onSave={(payload) => void saveIdentity(editFor, payload)}
            />
          )}

          {deleteFor !== null && (
            <DeleteStudentDialog
              user={deleteFor}
              deleting={mutating}
              onClose={() => setDeleteFor(null)}
              onConfirm={() => void deleteStudent(deleteFor)}
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

/* ---------------------------------------------------------------- dialogs */

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * Read-only detail view.
 *
 * It reads `GET /users/{id}` rather than the row it was opened from. The list is
 * a snapshot taken when the page loaded, so a role granted in another tab would
 * otherwise be shown here as though it were current — and this dialog is the
 * screen an admin consults *before* editing or deleting the account.
 *
 * The component is mounted only while open, so closing and reopening re-reads.
 */
function ViewStudentDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const {
    data: user,
    error,
    loading,
  } = useAdminResource<AdminUser>(() => adminApi.user(userId), {
    forbiddenMessage: "You do not have permission to view this account.",
    unreachableMessage: "Could not load this account.",
  });

  return (
    <Modal open onClose={onClose} title="Student details">
      {loading && <p className="py-6 text-center text-sm text-slate-400">Loading account…</p>}
      {!loading && error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {error}
        </p>
      )}
      {!loading && !error && user && (
        <div className="space-y-4">
          <div>
            <p className="font-display text-lg font-extrabold text-gray-900">{user.display_name}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>

          <dl>
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Email verified" value={user.is_email_verified ? "Yes" : "No"} />
            <DetailRow label="Mobile" value={user.mobile ?? "—"} />
            <DetailRow label="Mobile verified" value={user.is_mobile_verified ? "Yes" : "No"} />
            <DetailRow label="Roles" value={user.roles.join(", ") || "—"} />
            <DetailRow label="Status" value={user.is_active ? "Active" : "Inactive"} />
            <DetailRow label="Registered" value={formatDateTime(user.created_at)} />
            <DetailRow label="Last sign-in" value={formatDateTime(user.last_login_at)} />
          </dl>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Identity editor.
 *
 * Only changed fields go into the payload. That matters beyond tidiness: the
 * backend clears `is_email_verified` / `is_mobile_verified` when the address or
 * number changes, so sending an unchanged value would revoke a verification for
 * no reason. A blank payload is impossible — Save stays disabled until something
 * differs — which is also why "no change to save" is not a toast here.
 */
function EditStudentDialog({
  user,
  saving,
  onClose,
  onSave,
}: {
  user: AdminUser;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AdminUpdateUserPayload) => void;
}) {
  const [name, setName] = useState(user.display_name);
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [isActive, setIsActive] = useState(user.is_active);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const digits = mobile.replace(/\D/g, "");

  const nameError = trimmedName.length < 2 ? "Enter at least 2 characters." : null;
  const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ? null
    : "Enter a valid email address.";
  const mobileError = /^[6-9]\d{9}$/.test(digits)
    ? null
    : "Enter a 10-digit Indian mobile number.";

  const payload: AdminUpdateUserPayload = {};
  if (trimmedName !== user.display_name) payload.display_name = trimmedName;
  if (trimmedEmail !== user.email) payload.email = trimmedEmail;
  if (digits !== (user.mobile ?? "")) payload.mobile = digits;
  if (isActive !== user.is_active) payload.is_active = isActive;

  const valid = !nameError && !emailError && !mobileError;
  const changed = Object.keys(payload).length > 0;

  return (
    <Modal open onClose={onClose} title={`Edit ${user.email}`}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && changed && !saving) onSave(payload);
        }}
      >
        <Field id="student-name" label="Full name" hint="Stored on the student profile and shown in this list.">
          <Input
            id="student-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(nameError)}
            autoComplete="off"
          />
          {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
        </Field>

        <Field
          id="student-email"
          label="Email"
          hint="Changing this clears the verified flag — the new address must be verified again."
        >
          <Input
            id="student-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(emailError)}
            autoComplete="off"
          />
          {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
        </Field>

        <Field
          id="student-mobile"
          label="Mobile"
          hint="10-digit Indian number. Changing it clears the verified flag."
        >
          <Input
            id="student-mobile"
            inputMode="numeric"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            error={Boolean(mobileError)}
            autoComplete="off"
          />
          {mobileError && <p className="mt-1 text-xs text-red-600">{mobileError}</p>}
        </Field>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-purple-600"
          />
          Account is active and can sign in
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || !valid || !changed}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Delete confirmation.
 *
 * The list of what disappears is stated rather than implied, because "delete"
 * on this table removes an account and every row that belonged to it. The
 * backend owns the actual rules (cascade vs. null-out); this text names the
 * ones an admin can verify from the rest of the console.
 */
function DeleteStudentDialog({
  user,
  deleting,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Delete student">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          This permanently deletes{" "}
          <span className="font-semibold text-gray-900">{user.display_name}</span> (
          <span className="font-medium">{user.email}</span>). It cannot be undone from the console.
        </p>

        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-semibold">These go with the account:</p>
          <p className="mt-1">
            Sign-in sessions, OTPs, notifications, saved colleges, reviews, test attempts, consent
            records and the student profile.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-600 text-white shadow-red-600/25 hover:bg-red-700"
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}