"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  Edit3,
  Eye,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Plus,
  RefreshCw,
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

export interface LeadRow {
  id: string;
  name: string;
  mobile: string;
  email: string;
  course: string;
  state: string;
  city: string;
  counsellor: string;
  followUp: string;
  status: string;
  createdAt: string;
}

const DASH = "—";

/** `2026-03-04` -> `4 Mar 2026`. Date-only, so no timezone shift. */
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
    email: l.email || DASH,
    course: l.course_name || DASH,
    state: [l.state_name, l.city].filter(Boolean).join(", ") || DASH,
    city: l.city || DASH,
    counsellor: l.assigned_counsellor || DASH,
    followUp: l.follow_up_date || DASH,
    status: l.status,
    createdAt: l.created_at || "",
  };
}

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
 * Admission leads management section:
 * Full end-to-end CRM with lead capture (+ Add Lead), assignment to counsellors,
 * pipeline status updates, follow-up scheduling, timestamped notes, and CSV export.
 */
export function LeadsSection() {
  const { enquiries, showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [counsellorFilter, setCounsellorFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, error, reload } = useAdminResource(() => adminApi.leads(), {
    forbiddenMessage: "You do not have permission to view leads.",
    unreachableMessage: "Could not reach the leads API.",
  });

  const [counsellors, setCounsellors] = useState<AdminCounsellor[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .counsellors()
      .then((roster) => {
        if (!cancelled) setCounsellors(roster || []);
      })
      .catch(() => {
        if (!cancelled) setCounsellors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<LeadRow[] | null>(() => (data ? data.map(toRow) : null), [data]);

  // Local enquiries captured in this browser session (as backup/offline supplement)
  const local = useMemo<LeadRow[]>(
    () =>
      enquiries.map((e) => ({
        id: e.id,
        name: e.name,
        mobile: e.mobile,
        email: DASH,
        course: e.course || DASH,
        state: e.state || DASH,
        city: DASH,
        counsellor: DASH,
        followUp: DASH,
        status: e.status,
        createdAt: e.date || "",
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

  const stats = useMemo(() => {
    const total = all.length;
    const newLeads = all.filter((l) => l.status === "new").length;
    const inProgress = all.filter(
      (l) => l.status === "contacted" || l.status === "qualified" || l.status === "proposal",
    ).length;
    const converted = all.filter((l) => l.status === "won").length;
    return { total, newLeads, inProgress, converted };
  }, [all]);

  const filtered = useMemo(() => {
    let result = all;
    if (status !== "all") {
      result = result.filter((l) => l.status === status);
    }
    if (counsellorFilter !== "all") {
      result = result.filter((l) => l.counsellor === counsellorFilter);
    }
    return result;
  }, [all, status, counsellorFilter]);

  const advanceLead = async (row: LeadRow) => {
    const to = nextLeadStatus(row.status);
    if (!to) return;
    const numId = Number(row.id);
    if (Number.isNaN(numId)) {
      showToast({
        title: "Local lead updated",
        description: `${row.name} marked as ${to}.`,
        variant: "info",
      });
      return;
    }
    setBusyId(numId);
    try {
      await adminApi.updateLeadStatus(numId, to);
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

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await adminApi.deleteLead(id);
      setDeleteConfirmId(null);
      if (openId === id) setOpenId(null);
      reload();
      showToast({
        title: "Lead deleted",
        description: "The lead record was removed permanently.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not delete lead",
        description: describeError(err, "Failed to delete lead."),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      showToast({ title: "No leads to export", variant: "warning" });
      return;
    }
    const headers = ["ID", "Name", "Mobile", "Email", "Course", "Location", "Counsellor", "Follow-up", "Status", "Created At"];
    const csvRows = filtered.map((r) => [
      `"${r.id}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.mobile}"`,
      `"${r.email}"`,
      `"${r.course.replace(/"/g, '""')}"`,
      `"${r.state.replace(/"/g, '""')}"`,
      `"${r.counsellor.replace(/"/g, '""')}"`,
      `"${r.followUp}"`,
      `"${r.status}"`,
      `"${r.createdAt}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `padhaanewala-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ title: "Exported leads to CSV", variant: "success" });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          title="Admission leads"
          description="Manage pipeline, counsellor assignments, and student follow-ups"
          count={all.length}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={reload}
            title="Refresh leads from server"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={exportCsv}
            disabled={!filtered.length}
            title="Download CSV export"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Leads</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
          <p className="mt-0.5 text-xs text-slate-400">All captured enquiries</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider dark:text-blue-300">New Uncontacted</p>
          <p className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-100">{stats.newLeads}</p>
          <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-300/80">Pending initial response</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider dark:text-amber-300">In Pipeline</p>
          <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-100">{stats.inProgress}</p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-300/80">Contacted & qualified</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider dark:text-emerald-300">Won / Enrolled</p>
          <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-100">{stats.converted}</p>
          <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-300/80">Successfully converted</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          options={LEAD_STATUSES}
          value={status}
          onChange={setStatus}
          counts={counts as Partial<Record<string, number>>}
        />

        {counsellors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Counsellor:</span>
            <select
              value={counsellorFilter}
              onChange={(e) => setCounsellorFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none"
            >
              <option value="all">All Counsellors</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
              header: "Student",
              render: (e) => (
                <div>
                  <span className="font-semibold text-gray-900">{e.name}</span>
                  {e.email && e.email !== DASH && (
                    <span className="block text-xs text-slate-400">{e.email}</span>
                  )}
                </div>
              ),
            },
            {
              key: "mobile",
              header: "Mobile",
              render: (e) => (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-700">{e.mobile}</span>
                  <a
                    href={`tel:${e.mobile}`}
                    className="text-slate-400 hover:text-emerald-600"
                    title="Call"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/91${e.mobile.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-emerald-600"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                </div>
              ),
            },
            { key: "course", header: "Course" },
            { key: "state", header: "Location" },
            {
              key: "counsellor",
              header: "Counsellor",
              render: (e) =>
                e.counsellor !== DASH ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {e.counsellor}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600">Unassigned</span>
                ),
            },
            {
              key: "followUp",
              header: "Follow-up",
              render: (e) => (
                <span className="text-xs text-slate-600">
                  {e.followUp !== DASH ? formatDate(e.followUp) : DASH}
                </span>
              ),
            },
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
                const isNumeric = !Number.isNaN(Number(e.id));
                return (
                  <div className="flex items-center justify-end gap-1.5">
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
                    {isNumeric && (
                      <IconAction
                        title="View & manage lead"
                        onClick={() => setOpenId(Number(e.id))}
                      >
                        <Eye className="h-4 w-4" />
                      </IconAction>
                    )}
                    {isNumeric && (
                      <IconAction
                        title="Delete lead"
                        onClick={() => setDeleteConfirmId(Number(e.id))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                      </IconAction>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={filtered}
          searchKeys={["name", "mobile", "email", "course", "state", "city", "counsellor"]}
          searchPlaceholder="Search by name, phone, course, counsellor..."
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-base font-semibold text-slate-700">No leads recorded yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Enquiries from &quot;Get Admission Help&quot; forms will appear here instantly, or you can add one manually.
          </p>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" /> Create First Lead
          </Button>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          counsellors={counsellors}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            reload();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <Modal
          open
          onClose={() => !deleting && setDeleteConfirmId(null)}
          title="Delete Admission Lead"
          className="sm:max-w-md"
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this lead? This will permanently remove all associated notes and status history.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deleting}
              onClick={() => handleDelete(deleteConfirmId)}
            >
              <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Lead Workspace Modal */}
      {openId !== null && (
        <LeadWorkspace
          key={openId}
          enquiryId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onDelete={() => {
            setOpenId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- Add Lead Modal ----------------------------- */

function AddLeadModal({
  counsellors,
  onClose,
  onSuccess,
}: {
  counsellors: AdminCounsellor[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [city, setCity] = useState("");
  const [qualification, setQualification] = useState("12th Pass");
  const [source, setSource] = useState("Admin Entry");
  const [message, setMessage] = useState("");
  const [ageBand, setAgeBand] = useState<"18_plus" | "under_18">("18_plus");
  const [guardianContact, setGuardianContact] = useState("");
  const [assignCounsellorId, setAssignCounsellorId] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError("Please provide a valid student name (at least 2 letters).");
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, "");
    if (cleanMobile.length < 10) {
      setError("Please provide a valid 10-digit mobile number.");
      return;
    }
    if (ageBand === "under_18" && !guardianContact.trim()) {
      setError("Guardian contact phone/email is required when student is under 18.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await adminApi.createLead({
        name: name.trim(),
        mobile: cleanMobile,
        email: email.trim() || null,
        city: city.trim() || null,
        qualification: qualification.trim() || null,
        message: message.trim() ? `[Course: ${course || "Any"}] ${message.trim()}` : (course ? `Course: ${course}` : null),
        source: source || "Admin Entry",
        age_band: ageBand,
        guardian_contact: ageBand === "under_18" ? guardianContact.trim() : null,
      });

      // If counsellor specifically picked, assign them immediately
      if (assignCounsellorId && created.id) {
        try {
          await adminApi.assignLead(created.id, Number(assignCounsellorId));
        } catch {
          // assignment failure is non-fatal to lead creation
        }
      }

      showToast({
        title: "Lead created successfully",
        description: `${name} has been added to admission leads.`,
        variant: "success",
      });
      onSuccess();
    } catch (err) {
      setError(describeError(err, "Could not create lead. Please check details and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add New Admission Lead" className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-name">Full Name *</Label>
            <Input
              id="lead-name"
              required
              value={name}
              placeholder="e.g. Rahul Sharma"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lead-mobile">Mobile Number *</Label>
            <Input
              id="lead-mobile"
              required
              type="tel"
              value={mobile}
              placeholder="10-digit phone number"
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-email">Email Address</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              placeholder="rahul@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lead-city">City / State</Label>
            <Input
              id="lead-city"
              value={city}
              placeholder="e.g. Mumbai, Maharashtra"
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-course">Interested Course</Label>
            <Input
              id="lead-course"
              value={course}
              placeholder="e.g. B.Tech Computer Science, MBA"
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lead-qual">Current Qualification</Label>
            <Select
              id="lead-qual"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
            >
              <option value="10th Pass">10th Pass</option>
              <option value="12th Pass">12th Pass</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Graduate">Graduate</option>
              <option value="Postgraduate">Postgraduate</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-source">Lead Source</Label>
            <Select
              id="lead-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="Admin Entry">Admin Manual Entry</option>
              <option value="Inbound Phone Call">Inbound Phone Call</option>
              <option value="Walk-in">Campus Walk-in</option>
              <option value="WhatsApp">WhatsApp Inquiry</option>
              <option value="Referral">Student Referral</option>
              <option value="Education Fair">Education Fair / Event</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="lead-assignee">Assign Counsellor</Label>
            <Select
              id="lead-assignee"
              value={assignCounsellorId}
              onChange={(e) => setAssignCounsellorId(e.target.value)}
            >
              <option value="">Auto-assign (Round Robin)</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.active_leads}/{c.max_leads} leads)
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-age">Age Category</Label>
            <Select
              id="lead-age"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value as "18_plus" | "under_18")}
            >
              <option value="18_plus">18 years or older</option>
              <option value="under_18">Under 18 (Minor)</option>
            </Select>
          </div>
          {ageBand === "under_18" && (
            <div>
              <Label htmlFor="lead-guardian">Parent/Guardian Contact *</Label>
              <Input
                id="lead-guardian"
                required
                value={guardianContact}
                placeholder="Parent phone or email"
                onChange={(e) => setGuardianContact(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="lead-message">Student Notes / Query</Label>
          <textarea
            id="lead-message"
            rows={2}
            value={message}
            placeholder="Details about colleges interested in, score, budget..."
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-purple-400 focus:outline-none"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={submitting}>
            <UserCheck className="h-4 w-4" /> {submitting ? "Adding Lead…" : "Save Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------- Lead Workspace ----------------------------- */

function LeadWorkspace({
  enquiryId,
  onClose,
  onChanged,
  onDelete,
}: {
  enquiryId: number;
  onClose: () => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const { showToast } = useApp();

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

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editMessage, setEditMessage] = useState("");

  const answered = loaded !== null && loaded.id === enquiryId;
  const lead = answered ? loaded.lead : null;
  const loadError = answered ? loaded.error : null;
  const loading = !answered;

  const [assigneeOverride, setAssigneeOverride] = useState<string | null>(null);
  const assignedTo =
    assigneeOverride ?? (lead && counsellors ? counsellorIdFor(lead, counsellors) : "");

  const applyLead = useCallback(
    (id: number, next: AdminLeadDetail | null, error: string | null) => {
      setLoaded({ id, lead: next, error });
      setFollowUp(next?.follow_up_date ? next.follow_up_date.slice(0, 10) : "");
      if (next) {
        setEditName(next.name || "");
        setEditMobile(next.mobile || "");
        setEditEmail(next.email || "");
        setEditCity(next.city || "");
        setEditQualification(next.qualification || "");
        setEditMessage(next.message || "");
      }
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
            ? "Only an admin can reassign leads. You can still add notes and change status."
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

  const saveFollowUpDate = (targetDate: string | null) => {
    void run(
      () => adminApi.setLeadFollowUp(enquiryId, targetDate),
      (result) => {
        onChanged();
        showToast({
          title: "Follow-up updated",
          description: result.follow_up_date
            ? `${result.name} is scheduled for ${formatDate(result.follow_up_date)}.`
            : `${result.name} has no follow-up scheduled.`,
          variant: "success",
        });
      },
      "Could not update follow-up date.",
    );
  };

  const setPresetFollowUp = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const dateStr = d.toISOString().slice(0, 10);
    setFollowUp(dateStr);
    saveFollowUpDate(dateStr);
  };

  const changeStatus = (next: LeadStatus) => {
    if (!lead || next === lead.status) return;
    void run(
      () => adminApi.updateLeadStatus(enquiryId, next),
      (result) => {
        onChanged();
        showToast({
          title: `Status: ${lead.status} → ${next}`,
          description: `${result.name} moved to ${next}.`,
          variant: "success",
        });
      },
      "Could not update status.",
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
      const refreshed = await fetchLead(enquiryId);
      applyLead(enquiryId, refreshed.lead, refreshed.error);
      showToast({ title: "Note added", variant: "success" });
    } catch (err) {
      setFormError(describeError(err, "Could not add note."));
    } finally {
      setSaving(false);
    }
  };

  const saveEditedDetails = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await adminApi.updateLeadDetails(enquiryId, {
        name: editName.trim() || undefined,
        mobile: editMobile.trim() || undefined,
        email: editEmail.trim() || undefined,
        city: editCity.trim() || undefined,
        qualification: editQualification.trim() || undefined,
        message: editMessage.trim() || undefined,
      });
      applyLead(enquiryId, updated, null);
      setIsEditing(false);
      onChanged();
      showToast({ title: "Student details updated", variant: "success" });
    } catch (err) {
      setFormError(describeError(err, "Could not update details."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={lead ? lead.name : "Lead"}
      className="sm:max-w-3xl"
    >
      {loading && !lead ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading lead details…</p>
      ) : loadError ? (
        <div className="py-6 text-center">
          <p className="text-sm text-amber-700">{loadError}</p>
          <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !lead ? null : (
        <div className="space-y-6">
          {/* Header Contact Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-4 dark:from-purple-950/30 dark:to-indigo-950/30">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-gray-900 dark:text-white">
                  {lead.name}
                </span>
                <Badge variant={BadgeForStatus(lead.status)}>{lead.status}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Lead #{lead.id} · Created {formatDateTime(lead.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`tel:${lead.mobile}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-300 dark:ring-emerald-800"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={`https://wa.me/91${lead.mobile.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-300 dark:ring-emerald-800"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              {lead.email && lead.email !== DASH && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-200 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-300 dark:ring-blue-800"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              )}
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 className="h-3.5 w-3.5" /> {isEditing ? "Cancel Edit" : "Edit Details"}
              </Button>
            </div>
          </div>

          {/* Edit Details Form */}
          {isEditing ? (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                Edit Student Details
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-name">Student Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-mobile">Mobile Number</Label>
                  <Input
                    id="edit-mobile"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-qual">Qualification</Label>
                  <Input
                    id="edit-qual"
                    value={editQualification}
                    onChange={(e) => setEditQualification(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-msg">Message / Details</Label>
                  <Input
                    id="edit-msg"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" size="xs" variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" size="xs" variant="primary" disabled={saving} onClick={saveEditedDetails}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            /* Student Readout Grid */
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/50">
              <Field label="Mobile" value={lead.mobile} />
              <Field label="Email" value={lead.email || DASH} />
              <Field label="Course" value={lead.course_name || DASH} />
              <Field label="College" value={lead.college_name || DASH} />
              <Field
                label="Location"
                value={[lead.state_name, lead.city].filter(Boolean).join(", ") || DASH}
              />
              <Field label="Qualification" value={lead.qualification || DASH} />
              <Field label="Lead Source" value={lead.source || DASH} />
              <Field label="Follow-up Date" value={formatDate(lead.follow_up_date)} />
              <Field label="Created" value={formatDateTime(lead.created_at)} />
            </dl>
          )}

          {lead.message && (
            <div className="rounded-xl border border-slate-200/60 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Student Query</p>
              <p className="mt-1 whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}

          {/* CRM Workflow Controls */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Counsellor Assignment */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Label htmlFor="lead-assignee">Assigned Counsellor</Label>
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
                      {c.name} ({c.active_leads}/{c.max_leads} leads)
                      {c.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </Select>
              )}
              <div className="mt-3 flex gap-2">
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
                            description: `${result.name} is now unassigned.`,
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

            {/* Follow-up & Status */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Label htmlFor="lead-follow-up">Follow-up Schedule</Label>
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
                  onClick={() => saveFollowUpDate(followUp === "" ? null : followUp)}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Set
                </Button>
                {lead.follow_up_date && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    title="Clear date"
                    disabled={saving}
                    onClick={() => {
                      setFollowUp("");
                      saveFollowUpDate(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => setPresetFollowUp(1)}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 hover:bg-purple-100 hover:text-purple-700"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setPresetFollowUp(3)}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 hover:bg-purple-100 hover:text-purple-700"
                >
                  In 3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPresetFollowUp(7)}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 hover:bg-purple-100 hover:text-purple-700"
                >
                  In 1 Week
                </button>
              </div>

              <Label htmlFor="lead-status" className="mt-3">
                Pipeline Status
              </Label>
              <Select
                id="lead-status"
                value={lead.status}
                disabled={saving}
                onChange={(e) => changeStatus(e.target.value as LeadStatus)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {formError && (
            <p aria-live="polite" className="text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          {/* Add Follow-up Note */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Label htmlFor="lead-note">Add Follow-up Note</Label>
            <textarea
              id="lead-note"
              value={note}
              rows={2}
              maxLength={2000}
              disabled={saving}
              placeholder="What was discussed with the student, course preferences, next steps…"
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-purple-400 focus:outline-none"
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

          {/* Notes History */}
          {lead.notes.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Follow-up Notes ({lead.notes.length})
              </p>
              <ul className="space-y-2">
                {lead.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{n.note}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status Timeline */}
          {lead.status_history.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Status History
              </p>
              <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {lead.status_history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="text-slate-400">{formatDateTime(h.created_at)}</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {h.old_status ?? "new"} → {h.new_status}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Danger Zone: Delete Lead */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              Need to remove this lead? This action cannot be undone.
            </p>
            <Button
              type="button"
              size="xs"
              variant="danger"
              disabled={saving}
              onClick={() => {
                if (window.confirm(`Delete lead "${lead.name}" permanently?`)) {
                  setSaving(true);
                  adminApi
                    .deleteLead(lead.id)
                    .then(() => {
                      showToast({ title: "Lead deleted", variant: "success" });
                      onDelete();
                    })
                    .catch((err) => {
                      setFormError(describeError(err, "Failed to delete lead."));
                      setSaving(false);
                    });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Lead
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

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
      <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function counsellorIdFor(lead: AdminLeadDetail, roster: AdminCounsellor[]): string {
  if (!lead.assigned_counsellor) return "";
  const match = roster.find((c) => c.name === lead.assigned_counsellor);
  return match ? String(match.id) : "";
}
