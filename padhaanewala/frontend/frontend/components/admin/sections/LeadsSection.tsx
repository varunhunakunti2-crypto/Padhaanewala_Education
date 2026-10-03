"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Eye,
  MessageSquarePlus,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import {
  ApiError,
  LEAD_STATUSES,
  adminApi,
  isForbidden,
  type AdminCounsellor,
  type AdminLead,
  type AdminLeadDetail,
  type LeadStatus,
} from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { nextLeadStatus } from "@/lib/lead-status";
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
  counsellor: string;
  followUp: string;
  status: string;
}

const DASH = "—";

/** `2026-03-04` -> `4 Mar 2026`. Date-only, so no timezone shift to worry about. */
function formatDate(value: string | null): string {
  if (!value) return DASH;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return DASH;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toRow(l: AdminLead): LeadRow {
  return {
    id: String(l.id),
    name: l.name,
    mobile: l.mobile,
    course: l.course_name || DASH,
    state: [l.state_name, l.city].filter(Boolean).join(", ") || DASH,
    counsellor: l.assigned_counsellor || DASH,
    followUp: l.follow_up_date || DASH,
    status: l.status,
  };
}

/**
 * The next rung of the funnel, or `null` when there isn't one. Lives in
 * `lib/lead-status.ts` so it can be tested without a DOM -- see that file for
 * why "converted" must never appear here.
 */

/**
 * Pull something human out of an ApiError without inventing a message the
 * backend never sent. A 409 from the assign endpoint means "counsellor is
 * full", which is a fact about the roster the admin can act on, so it is shown
 * verbatim instead of being flattened into "Please retry".
 */
function describeError(err: unknown, fallback: string): string {
  if (isForbidden(err)) return "You do not have permission for this action.";
  if (err instanceof ApiError) {
    if (typeof err.detail === "string" && err.detail.trim()) return err.detail;
    if (err.status === 409) return "That counsellor is at their lead limit.";
    if (err.status === 0) return "Could not reach the API.";
  }
  return fallback;
}

/**
 * Admission leads, read from `GET /api/v1/leads` (role-gated to
 * admin / super_admin / counsellor).
 *
 * The list is the overview; the lead workspace modal is where the work happens:
 * assignment, follow-up date, status and notes all call the real CRM endpoints
 * and re-read the lead afterwards, so what is on screen is the server's answer
 * rather than an optimistic guess.
 *
 * When the API is unreachable or the signed-in user lacks the role, the panel
 * says so explicitly rather than silently rendering an empty table that looks
 * like "no leads exist".
 */
export function LeadsSection() {
  const { enquiries, showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, error, reload } = useAdminResource(() => adminApi.leads(), {
    forbiddenMessage: "You do not have permission to view leads.",
    unreachableMessage: "Could not reach the leads API.",
  });

  const rows = useMemo<LeadRow[] | null>(() => (data ? data.map(toRow) : null), [data]);

  const advanceLead = async (row: LeadRow) => {
    const to = nextLeadStatus(row.status);
    // Unreachable from the UI (the button is hidden), but the ladder can return
    // null for a status the backend adds ahead of this list. Sending `null` would
    // 422, so bail out rather than issue a request known to fail.
    if (!to) return;
    setBusyId(Number(row.id));
    try {
      await adminApi.updateLeadStatus(Number(row.id), to);
      reload();
      showToast({
        title: `Lead ${row.status} → ${to}`,
        description: `${row.name} moved to ${to}.`,
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not update lead",
        description: describeError(err, "Please retry."),
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
        course: e.course || DASH,
        state: e.state || DASH,
        counsellor: DASH,
        followUp: DASH,
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
          options={LEAD_STATUSES}
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
            { key: "counsellor", header: "Counsellor" },
            { key: "followUp", header: "Follow-up" },
            {
              key: "status",
              header: "Status",
              render: (e) => <Badge variant={BadgeForStatus(e.status)}>{e.status}</Badge>,
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (e) => {
                const to = nextLeadStatus(e.status);
                return (
                  <div className="flex items-center justify-end gap-1">
                    {to && (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        disabled={busyId === Number(e.id)}
                        onClick={() => advanceLead(e)}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> {to}
                      </Button>
                    )}
                    <IconAction title="View lead" onClick={() => setOpenId(Number(e.id))}>
                      <Eye className="h-4 w-4" />
                    </IconAction>
                  </div>
                );
              },
            },
          ]}
          rows={filtered}
          searchKeys={["name", "mobile", "course", "state", "counsellor"]}
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

      {openId !== null && (
        <LeadWorkspace
          // Remounting per lead is what resets the workspace. Doing it with a
          // reset-effect instead would mean the previous lead's notes, roster
          // and half-typed follow-up were briefly on screen for the next one.
          key={openId}
          enquiryId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

/* ----------------------------- Lead workspace ----------------------------- */

/**
 * Everything you can do to one lead, in one place. Mounted only while a lead is
 * open, so `enquiryId` is always a real id and there is no "closed but still
 * holding state" case to reset.
 *
 * Each control writes through the API and then re-reads the lead, so the panel
 * always renders the server's view. Optimistic updates would be wrong here:
 * `assign` can be refused with 409 when the counsellor is full, and `status`
 * validates against a fixed vocabulary, so guessing locally would show a
 * change the server never accepted.
 */
function LeadWorkspace({
  enquiryId,
  onClose,
  onChanged,
}: {
  enquiryId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useApp();

  /**
   * The lead, its follow-up draft and the roster request all describe the same
   * thing, so they live in one record rather than three `useState` calls that
   * have to be kept in step. `loaded` is absent entirely and derived from
   * whether an answer for *this* lead has arrived — a flag that can disagree
   * with the data it describes is a bug waiting to happen.
   */
  const [loaded, setLoaded] = useState<{
    id: number;
    lead: AdminLeadDetail | null;
    error: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [counsellors, setCounsellors] = useState<AdminCounsellor[] | null>(null);
  const [rosterNote, setRosterNote] = useState<string | null>(null);

  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");

  const answered = loaded !== null && loaded.id === enquiryId;
  const lead = answered ? loaded.lead : null;
  const loadError = answered ? loaded.error : null;
  const loading = !answered;

  /**
   * The lead carries the counsellor's *name*, but the select needs an id, and
   * the roster is the only place ids are exposed. Rather than copying the
   * resolved id into state and keeping it in step, the select falls back to
   * deriving it from the lead and only uses local state once the user has
   * actually picked something. A successful save drops the override so the
   * select snaps back to whatever the server says it is — which means the
   * control cannot drift out of sync with the lead it is editing.
   */
  const [assigneeOverride, setAssigneeOverride] = useState<string | null>(null);
  const assignedTo =
    assigneeOverride ?? (lead && counsellors ? counsellorIdFor(lead, counsellors) : "");

  const applyLead = useCallback(
    (id: number, next: AdminLeadDetail | null, error: string | null) => {
      setLoaded({ id, lead: next, error });
      setFollowUp(next?.follow_up_date ? next.follow_up_date.slice(0, 10) : "");
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchLead(enquiryId).then((result) => {
      if (cancelled) return;
      applyLead(enquiryId, result.lead, result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [enquiryId, applyLead]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .counsellors()
      .then((roster) => {
        if (cancelled) return;
        setCounsellors(roster);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCounsellors([]);
        setRosterNote(
          isForbidden(err)
            ? "Only an admin can reassign leads. You can still add notes and move the status."
            : "The counsellor roster could not be loaded, so reassignment is unavailable.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (
    action: () => Promise<AdminLeadDetail>,
    success: (result: AdminLeadDetail) => void,
    fallback: string,
  ) => {
    setSaving(true);
    setFormError(null);
    try {
      const result = await action();
      applyLead(result.id, result, null);
      setAssigneeOverride(null);
      success(result);
    } catch (err) {
      setFormError(describeError(err, fallback));
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = () => {
    const next = assignedTo === "" ? null : Number(assignedTo);
    void run(
      () => adminApi.assignLead(enquiryId, next),
      (result) => {
        onChanged();
        showToast({
          title: next === null ? "Lead unassigned" : "Lead assigned",
          description:
            next === null
              ? `${result.name} is back in the unassigned queue.`
              : `${result.name} now belongs to ${result.assigned_counsellor}.`,
          variant: "success",
        });
      },
      "Could not assign this lead.",
    );
  };

  const saveFollowUp = () => {
    void run(
      () => adminApi.setLeadFollowUp(enquiryId, followUp === "" ? null : followUp),
      (result) => {
        onChanged();
        showToast({
          title: "Follow-up updated",
          description: result.follow_up_date
            ? `${result.name} is due back on ${formatDate(result.follow_up_date)}.`
            : `${result.name} has no follow-up date set.`,
          variant: "success",
        });
      },
      "Could not set the follow-up date.",
    );
  };

  const changeStatus = (next: LeadStatus) => {
    if (!lead || next === lead.status) return;
    void run(
      () => adminApi.updateLeadStatus(enquiryId, next),
      (result) => {
        onChanged();
        showToast({
          title: `Lead ${lead.status} → ${next}`,
          description: `${result.name} moved to ${next}.`,
          variant: "success",
        });
      },
      "Could not update the status.",
    );
  };

  const submitNote = async () => {
    const body = note.trim();
    if (!body) {
      setFormError("A note cannot be empty.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminApi.addLeadNote(enquiryId, body);
      setNote("");
      // Re-read rather than appending locally: `created_at` and the ordering
      // both come from the server.
      const refreshed = await fetchLead(enquiryId);
      applyLead(enquiryId, refreshed.lead, refreshed.error);
      showToast({ title: "Note added", variant: "success" });
    } catch (err) {
      setFormError(describeError(err, "Could not add the note."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={lead ? lead.name : "Lead"}
      className="sm:max-w-2xl"
    >
      {loading && !lead ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading lead…</p>
      ) : loadError ? (
        <div className="py-6 text-center">
          <p className="text-sm text-amber-700">{loadError}</p>
          <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !lead ? null : (
        <div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Mobile" value={lead.mobile} />
            <Field label="Email" value={lead.email || DASH} />
            <Field label="Source" value={lead.source || DASH} />
            <Field label="Course" value={lead.course_name || DASH} />
            <Field label="College" value={lead.college_name || DASH} />
            <Field label="Location" value={[lead.state_name, lead.city].filter(Boolean).join(", ") || DASH} />
            <Field label="Qualification" value={lead.qualification || DASH} />
            <Field label="Created" value={formatDateTime(lead.created_at)} />
            <Field label="Follow-up" value={formatDate(lead.follow_up_date)} />
          </dl>

          {lead.message && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {lead.message}
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-assignee">Assigned counsellor</Label>
              {rosterNote ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  {rosterNote}
                </p>
              ) : (
                <Select
                  id="lead-assignee"
                  value={assignedTo}
                  disabled={saving || !counsellors}
                  onChange={(e) => setAssigneeOverride(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(counsellors ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.active_leads}/{c.max_leads}
                      {c.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </Select>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={saving}
                  onClick={saveAssignment}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Save
                </Button>
                {lead.assigned_counsellor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      setAssigneeOverride("");
                      void run(
                        () => adminApi.assignLead(lead.id, null),
                        (result) => {
                          onChanged();
                          showToast({
                            title: "Lead unassigned",
                            description: `${result.name} is back in the unassigned queue.`,
                            variant: "success",
                          });
                        },
                        "Could not unassign this lead.",
                      );
                    }}
                  >
                    <UserX className="h-3.5 w-3.5" /> Unassign
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="lead-follow-up">Follow-up date</Label>
              <div className="flex gap-2">
                <Input
                  id="lead-follow-up"
                  type="date"
                  value={followUp}
                  disabled={saving}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={saving}
                  onClick={saveFollowUp}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Set
                </Button>
                {lead.follow_up_date && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-label="Clear follow-up date"
                    title="Clear follow-up date"
                    disabled={saving}
                    onClick={() => {
                      setFollowUp("");
                      void run(
                        () => adminApi.setLeadFollowUp(lead.id, null),
                        (result) => {
                          onChanged();
                          showToast({
                            title: "Follow-up cleared",
                            description: `${result.name} has no follow-up date set.`,
                            variant: "success",
                          });
                        },
                        "Could not clear the follow-up date.",
                      );
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <Label htmlFor="lead-status" className="mt-4">
                Status
              </Label>
              <Select
                id="lead-status"
                value={lead.status}
                disabled={saving}
                onChange={(e) => changeStatus(e.target.value as LeadStatus)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* aria-live so a rejected write is announced, not just shown. */}
          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-red-600">
            {formError ?? ""}
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <Label htmlFor="lead-note">Add a follow-up note</Label>
            <textarea
              id="lead-note"
              value={note}
              rows={3}
              maxLength={2000}
              disabled={saving}
              placeholder="What was discussed, what happens next…"
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={saving || note.trim().length === 0}
                onClick={() => void submitNote()}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
              </Button>
            </div>
          </div>

          {lead.notes.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-gray-900">
                Notes ({lead.notes.length})
              </p>
              <ul className="space-y-2">
                {lead.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="whitespace-pre-wrap text-slate-700">{n.note}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lead.status_history.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-gray-900">Status history</p>
              <ol className="space-y-1.5 text-sm text-slate-600">
                {lead.status_history.map((h) => (
                  <li key={h.id}>
                    <span className="text-slate-400">{formatDateTime(h.created_at)}</span>{" "}
                    — {h.old_status ?? "new"} →{" "}
                    <span className="font-medium text-gray-900">{h.new_status}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * One lead, or the reason there isn't one. A failed read is a *result*, not an
 * exception, because both the mount effect and the "note added" refresh need to
 * show the same failure in the same place.
 */
async function fetchLead(id: number): Promise<{
  lead: AdminLeadDetail | null;
  error: string | null;
}> {
  try {
    return { lead: await adminApi.getLead(id), error: null };
  } catch (err) {
    return { lead: null, error: describeError(err, "Could not load this lead.") };
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}

/** Resolve the lead's current holder to a roster id via the display name. */
function counsellorIdFor(lead: AdminLeadDetail, roster: AdminCounsellor[]): string {
  if (!lead.assigned_counsellor) return "";
  const match = roster.find((c) => c.name === lead.assigned_counsellor);
  return match ? String(match.id) : "";
}
