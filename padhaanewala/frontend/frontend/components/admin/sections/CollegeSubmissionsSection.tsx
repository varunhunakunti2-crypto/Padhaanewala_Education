"use client";

import { useState } from "react";
import { Check, ExternalLink, Eye, MessageSquare, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, type CollegeSubmission, type CollegeSubmissionStatus } from "@/lib/api";
import {
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  describeSubmissionError,
} from "@/lib/college-submission-form";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading, FilterChips, IconAction } from "@/components/admin/primitives";

/** `DataTable` needs a string `id`; the API's is a number. */
interface SubmissionRow extends Omit<CollegeSubmission, "id"> {
  id: string;
  record: CollegeSubmission;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The review queue for public college suggestions.
 *
 * Reading the queue is a `CONTENT_ROLES` operation and the three review actions
 * are `ADMIN_ROLES`; both gates are enforced on the server, so this panel's
 * controls mirror them for clarity rather than as the security boundary. The
 * queue is filtered by a required `status` (there is no "every status" mode), so
 * the chips are the four real statuses and never an "All".
 *
 * Approving is the only path that writes to `colleges`: the server creates the
 * college (active, `unverified`) or links an exact-name match, and refuses a
 * second reviewer with a 409. Nothing a submitter sends reaches the catalogue
 * without this click.
 */
export function CollegeSubmissionsSection() {
  const { showToast, roles } = useApp();
  const [status, setStatus] = useState<CollegeSubmissionStatus>("pending");

  // `status` is a *server-side* filter, so it must be a `reloadKey`: without it
  // the hook never re-runs when a chip changes (its effect depends on the key,
  // not on the loader identity) and the table keeps showing the previous
  // status's rows under the newly selected chip.
  const { data, error, loading, reload } = useAdminResource<CollegeSubmission[]>(
    (signal) => adminApi.collegeSubmissions(status, signal),
    {
      forbiddenMessage: "You do not have permission to view college requests.",
      unreachableMessage: "Could not reach the submission queue.",
      reloadKey: status,
    },
  );

  const [open, setOpen] = useState<CollegeSubmission | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  // POST/PUT/DELETE on a college are `admin`/`super_admin`; a plain viewer
  // (content_manager) sees the queue read-only.
  const canReview = roles.includes("admin") || roles.includes("super_admin");

  const rows: SubmissionRow[] = (data ?? []).map((s) => {
    const { id, ...rest } = s;
    return { ...rest, id: String(id), record: s };
  });

  const openReview = (row: CollegeSubmission) => {
    setOpen(row);
    setNotes(row.reviewer_notes ?? "");
    setActionError(null);
  };

  const closeReview = () => {
    setOpen(null);
    setNotes("");
    setActionError(null);
    setPendingDelete(null);
  };

  const runAction = async (kind: "approve" | "reject" | "request-changes", row: CollegeSubmission) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const trimmed = notes.trim() === "" ? null : notes.trim();
      if (kind === "approve") {
        const updated = await adminApi.approveCollegeSubmission(row.id, trimmed);
        // Approving an already-known name *links* that college rather than
        // creating one — and if it is archived, it is not in the catalogue, so
        // "now in the catalogue" would be a lie. Only a live link (or a fresh
        // create, which is always active) is a success.
        showToast({
          variant: updated.college_is_active === false ? "info" : "success",
          title: "Submission approved",
          description:
            updated.college_is_active === false
              ? `Linked to ${updated.college_name ?? "an archived college"}, which is archived — reactivate it in Colleges to publish.`
              : updated.college_name
                ? `${updated.college_name} is now in the catalogue.`
                : "The college was created.",
        });
      } else if (kind === "reject") {
        await adminApi.rejectCollegeSubmission(row.id, trimmed);
        showToast({ variant: "info", title: "Submission rejected", description: row.proposed_name });
      } else {
        await adminApi.requestChangesCollegeSubmission(row.id, trimmed);
        showToast({
          variant: "info",
          title: "Changes requested",
          description: row.proposed_name,
        });
      }
      closeReview();
      reload();
    } catch (err) {
      // A 409 here means another reviewer acted first — surfaced, not swallowed.
      setActionError(describeSubmissionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (row: CollegeSubmission) => {
    setPendingDelete(null);
    setSubmitting(true);
    try {
      await adminApi.deleteCollegeSubmission(row.id);
      showToast({ variant: "success", title: "Submission deleted", description: row.proposed_name });
      closeReview();
      reload();
    } catch (err) {
      setActionError(describeSubmissionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="College Requests"
        description="Public suggestions awaiting review. Approving one publishes a college; nothing is published automatically."
        count={rows.length}
      />

      <div className="mb-4">
        <FilterChips
          options={SUBMISSION_STATUSES}
          value={status}
          onChange={(next) => {
            if (next !== "all") setStatus(next);
          }}
          includeAll={false}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading && rows.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading requests…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "proposed_name",
              header: "Proposed college",
              render: (s) => <span className="font-semibold text-gray-900">{s.proposed_name}</span>,
            },
            {
              key: "submitter_name",
              header: "Suggested by",
              render: (s) => <span className="text-slate-500">{s.submitter_name ?? "—"}</span>,
            },
            {
              key: "proposed_city",
              header: "Location",
              render: (s) =>
                s.proposed_city || s.proposed_state_name
                  ? [s.proposed_city, s.proposed_state_name].filter(Boolean).join(", ")
                  : "—",
            },
            {
              key: "duplicate",
              header: "Possible match",
              render: (s) =>
                s.possible_duplicate_college_name ? (
                  <Badge variant="amber">{s.possible_duplicate_college_name}</Badge>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            {
              key: "created_at",
              header: "Submitted",
              render: (s) => <span className="text-slate-500">{formatDate(s.created_at)}</span>,
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (s) => (
                <div className="flex items-center justify-end gap-1">
                  <IconAction title="Review submission" onClick={() => openReview(s.record)}>
                    <Eye className="h-4 w-4" />
                  </IconAction>
                </div>
              ),
            },
          ]}
          rows={rows}
          searchKeys={["proposed_name", "submitter_name", "proposed_city", "proposed_state_name"]}
          searchPlaceholder="Search requests..."
          emptyState={`No ${SUBMISSION_STATUS_LABEL[status].toLowerCase()} requests.`}
        />
      )}

      <Modal open={open !== null} onClose={closeReview} title="Review suggestion" className="sm:max-w-2xl">
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-gray-900">
                  {open.proposed_name}
                </h3>
                {open.proposed_official_name && (
                  <p className="text-sm text-slate-500">{open.proposed_official_name}</p>
                )}
              </div>
              <Badge variant={SUBMISSION_STATUS_TONE[open.status]}>
                {SUBMISSION_STATUS_LABEL[open.status]}
              </Badge>
            </div>

            {open.possible_duplicate_college_name && open.college_id === null ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  A similar college already exists:{" "}
                  <span className="font-semibold">{open.possible_duplicate_college_name}</span>. Check
                  whether this is the same institution before approving.
                </span>
              </p>
            ) : null}

            {open.college_id !== null ? (
              <p className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50/70 p-3 text-sm text-green-800">
                <Check className="h-4 w-4 shrink-0" />
                {open.college_slug && open.college_is_active !== false ? (
                  <>
                    Linked to{" "}
                    <a
                      href={`/colleges/${open.college_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline"
                    >
                      {open.college_name ?? "the college"} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : (
                  <>
                    Linked to{" "}
                    <span className="font-semibold">{open.college_name ?? "a college"}</span>
                    {open.college_is_active === false ? (
                      <span className="text-green-700/80">
                        — archived; reactivate it in Colleges to publish.
                      </span>
                    ) : null}
                  </>
                )}
              </p>
            ) : null}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Detail label="Type" value={open.proposed_college_type} />
              <Detail label="Ownership" value={open.proposed_ownership} />
              <Detail label="University" value={open.proposed_university_name} />
              <Detail
                label="State"
                value={open.proposed_state_name ?? (open.proposed_state_id ? `#${open.proposed_state_id}` : null)}
              />
              <Detail label="City" value={open.proposed_city} />
              <Detail label="Phone" value={open.proposed_phone} />
              <Detail label="Email" value={open.proposed_email} />
              <Detail
                label="Website"
                value={
                  open.proposed_website ? (
                    <a
                      href={open.proposed_website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-purple-700 hover:text-purple-800"
                    >
                      {open.proposed_website} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : null
                }
              />
              <Detail label="Address" value={open.proposed_address} full />
              <Detail label="Overview" value={open.proposed_overview} full />
              <Detail label="Submitter note" value={open.submitter_notes} full />
              <Detail
                label="Submitted"
                value={`${open.submitter_name ?? "Unknown"} · ${formatDate(open.created_at)}`}
                full
              />
            </dl>

            {canReview && open.status !== "approved" && open.status !== "rejected" ? (
              <div className="space-y-1.5">
                <label htmlFor="sub-review-notes" className="block text-sm font-medium text-gray-700">
                  Reviewer note (optional)
                </label>
                <textarea
                  id="sub-review-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Shared with the submitter on reject or a change request."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                />
              </div>
            ) : null}

            {/* aria-live so a refused action (e.g. a 409 race) is announced. */}
            <p aria-live="polite" className="min-h-5 text-sm text-red-600">
              {actionError ?? ""}
            </p>

            {pendingDelete === open.id ? (
              <div className="flex items-center justify-end gap-2 rounded-xl bg-red-50 p-3">
                <span className="mr-auto text-sm font-medium text-red-700">
                  Delete this suggestion permanently?
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void remove(open)}
                  className="inline-flex h-8 items-center rounded-lg bg-red-500 px-3 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canReview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="mr-auto"
                    disabled={submitting}
                    onClick={() => setPendingDelete(open.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                )}
                {canReview && open.status !== "approved" && open.status !== "rejected" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => void runAction("request-changes", open)}
                    >
                      <X className="h-3.5 w-3.5" /> Request changes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={submitting}
                      onClick={() => void runAction("reject", open)}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={submitting}
                      onClick={() => void runAction("approve", open)}
                    >
                      <Check className="h-3.5 w-3.5" /> {submitting ? "Working…" : "Approve & publish"}
                    </Button>
                  </>
                )}
                {(open.status === "approved" ||
                  open.status === "rejected" ||
                  !canReview) && (
                  <Button type="button" size="sm" variant="secondary" onClick={closeReview}>
                    Close
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** One label/value pair in the review dialog; `full` spans both columns. */
function Detail({
  label,
  value,
  full = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-gray-800">
        {value === null || value === undefined || value === "" ? (
          <span className="text-slate-400">Not provided</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
