"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import {
  fetchMyCollegeSubmissions,
  fetchStateNames,
  resolveStateId,
  submitCollegeSuggestion,
  updateCollegeSuggestion,
  withdrawCollegeSuggestion,
  type CollegeSubmission,
} from "@/lib/api";
import {
  EMPTY_COLLEGE_SUBMISSION_FORM,
  SUBMISSION_FIELD_MAX,
  SUBMISSION_NAME_MAX,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  buildSubmissionPayload,
  describeSubmissionError,
  isRevisable,
  submissionFormFromRecord,
  type CollegeSubmissionFormValues,
} from "@/lib/college-submission-form";

/**
 * The signed-in side of the college submission workflow, presented as the
 * college owner's "add your college" tool (`/add-college`; `/suggest-college`
 * redirects there).
 *
 * Two jobs on one screen:
 *
 *  1. **Add a college.** A submission is *proposed*, never asserted — the
 *     screen says so, because an owner who expects their college to appear
 *     instantly would read the review step as the form having failed. On
 *     success the response's status is always `pending`, and the college only
 *     reaches the public catalogue once a reviewer approves it.
 *  2. **Track your own submissions.** The list shows the reviewer's decision
 *     and note, and lets the owner edit or withdraw a row while it is still
 *     `pending` or `changes_requested` — the two states where doing so does not
 *     discard a reviewer's work.
 *
 * Everything shown here is the account's own data: the read is `/my`, scoped to
 * the signed-in user.
 */

type StateOptions =
  | { status: "loading" }
  | { status: "ready"; options: string[] }
  /** The lookup failed, so the field degrades to free text rather than blocking. */
  | { status: "unavailable" };

const OWNERSHIP_OPTIONS = ["Government", "Private", "Deemed", "Autonomous"] as const;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SuggestCollegePanel() {
  const { showToast } = useApp();

  const [form, setForm] = useState<CollegeSubmissionFormValues>({
    ...EMPTY_COLLEGE_SUBMISSION_FORM,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const [states, setStates] = useState<StateOptions>({ status: "loading" });

  const [mine, setMine] = useState<CollegeSubmission[] | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingWithdraw, setPendingWithdraw] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchStateNames()
      .then((options) => {
        if (!active) return;
        setStates(options.length > 0 ? { status: "ready", options } : { status: "unavailable" });
      })
      .catch(() => {
        if (active) setStates({ status: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    // Any setState here stays inside the promise callbacks: clearing the error
    // synchronously in the effect body is the cascading-render pattern the
    // `react-hooks/set-state-in-effect` rule rejects (and what `useAdminResource`
    // deliberately avoids by seeding `loading` and only writing in `.then`).
    fetchMyCollegeSubmissions()
      .then((rows) => {
        if (ignore) return;
        setMine(rows);
        setMineError(null);
      })
      .catch((err: unknown) => {
        if (!ignore) setMineError(describeSubmissionError(err));
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const set = (key: keyof CollegeSubmissionFormValues, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_COLLEGE_SUBMISSION_FORM });
    setEditingId(null);
    setFormError(null);
  }, []);

  const startEdit = (row: CollegeSubmission) => {
    setForm(submissionFormFromRecord(row));
    setEditingId(row.id);
    setFormError(null);
    setSubmittedName(null);
    // The form is the first thing on the page; bring it into view so the student
    // is not left looking at the row they clicked.
    if (typeof document !== "undefined") {
      document.getElementById("suggest-college-form")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;

    // Resolve the chosen state name to its id where the lookup succeeded; the
    // name is still sent either way, so an unmatched or unavailable state is not
    // lost. `resolveStateId` returns null for a blank or unknown name.
    const stateId = await resolveStateId(form.proposed_state_name);
    const built = buildSubmissionPayload({
      ...form,
      proposed_state_id: stateId === null ? "" : String(stateId),
    });
    if (!built.ok) {
      setFormError(built.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId !== null) {
        await updateCollegeSuggestion(editingId, built.payload);
        showToast({
          variant: "success",
          title: "Submission updated",
          description: "It is back in the review queue.",
        });
      } else {
        await submitCollegeSuggestion(built.payload);
        setSubmittedName(built.payload.proposed_name);
        showToast({
          variant: "success",
          title: "College submitted for review",
          description: "A reviewer will verify it shortly.",
        });
      }
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(describeSubmissionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (row: CollegeSubmission) => {
    setPendingWithdraw(null);
    setBusyId(row.id);
    try {
      await withdrawCollegeSuggestion(row.id);
      showToast({ variant: "info", title: "Submission withdrawn", description: row.proposed_name });
      if (editingId === row.id) resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Could not withdraw",
        description: describeSubmissionError(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  const editing = editingId !== null;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
      <div
        id="suggest-college-form"
        className="scroll-mt-28 rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5 sm:p-8"
      >
        <h2 className="font-display text-xl font-extrabold text-gray-900">
          {editing ? "Edit your submission" : "Add your college"}
        </h2>
        <p className="mt-1 mb-6 text-sm text-gray-500">
          {editing
            ? "Saving sends it back to the review queue."
            : "For college owners and representatives. Tell us about your college and a reviewer will verify it before it appears on the site."}
        </p>

        {submittedName && !editing ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-green-100 bg-green-50/70 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="text-sm">
              <p className="font-semibold text-gray-900">Submission received.</p>
              <p className="text-gray-600">
                <span className="font-medium">{submittedName}</span> is now pending review.
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sc-name" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-purple-500" /> College name *
            </Label>
            <Input
              id="sc-name"
              value={form.proposed_name}
              onChange={(e) => set("proposed_name", e.target.value)}
              placeholder="e.g. Coastal Institute of Technology"
              maxLength={SUBMISSION_NAME_MAX}
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-official">Official name (optional)</Label>
            <Input
              id="sc-official"
              value={form.proposed_official_name}
              onChange={(e) => set("proposed_official_name", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_official_name}
              placeholder="As printed on the prospectus"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-type">Institution type (optional)</Label>
            <Input
              id="sc-type"
              value={form.proposed_college_type}
              onChange={(e) => set("proposed_college_type", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_college_type}
              placeholder="e.g. Engineering"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-ownership">Ownership (optional)</Label>
            <Select
              id="sc-ownership"
              value={form.proposed_ownership}
              onChange={(e) => set("proposed_ownership", e.target.value)}
            >
              <option value="">Not recorded</option>
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-university">University (optional)</Label>
            <Input
              id="sc-university"
              value={form.proposed_university_name}
              onChange={(e) => set("proposed_university_name", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_university_name}
              placeholder="Affiliating university"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-state">State (optional)</Label>
            {states.status === "unavailable" ? (
              <>
                <Input
                  id="sc-state"
                  value={form.proposed_state_name}
                  onChange={(e) => set("proposed_state_name", e.target.value)}
                  maxLength={SUBMISSION_FIELD_MAX.proposed_state_name}
                  placeholder="Type the state"
                />
                <p className="text-xs text-gray-500">
                  We could not load the state list, so please type it in.
                </p>
              </>
            ) : (
              <Select
                id="sc-state"
                value={form.proposed_state_name}
                onChange={(e) => set("proposed_state_name", e.target.value)}
              >
                <option value="">Not recorded</option>
                {(states.status === "ready" ? states.options : []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-city">City (optional)</Label>
            <Input
              id="sc-city"
              value={form.proposed_city}
              onChange={(e) => set("proposed_city", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_city}
              placeholder="e.g. Mangaluru"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sc-address">Address (optional)</Label>
            <Input
              id="sc-address"
              value={form.proposed_address}
              onChange={(e) => set("proposed_address", e.target.value)}
              placeholder="Street, area, landmark"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-website">Website (optional)</Label>
            <Input
              id="sc-website"
              type="url"
              inputMode="url"
              value={form.proposed_website}
              onChange={(e) => set("proposed_website", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_website}
              placeholder="https://example.edu.in"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-email">Email (optional)</Label>
            <Input
              id="sc-email"
              type="email"
              inputMode="email"
              value={form.proposed_email}
              onChange={(e) => set("proposed_email", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_email}
              placeholder="office@example.edu.in"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-phone">Phone (optional)</Label>
            <Input
              id="sc-phone"
              value={form.proposed_phone}
              onChange={(e) => set("proposed_phone", e.target.value)}
              maxLength={SUBMISSION_FIELD_MAX.proposed_phone}
              placeholder="Office phone"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sc-overview">About the college (optional)</Label>
            <textarea
              id="sc-overview"
              value={form.proposed_overview}
              onChange={(e) => set("proposed_overview", e.target.value)}
              rows={3}
              placeholder="What makes this college worth listing?"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sc-notes">Note for the reviewer (optional)</Label>
            <textarea
              id="sc-notes"
              value={form.submitter_notes}
              onChange={(e) => set("submitter_notes", e.target.value)}
              rows={2}
              placeholder="Anything the reviewer should know"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* aria-live so a rejected form is announced, not just shown. */}
          <p aria-live="polite" className="min-h-5 text-sm text-red-600 sm:col-span-2">
            {formError ?? ""}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="accent" size="lg" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {editing ? "Saving…" : "Submitting…"}
                </span>
              ) : (
                <>
                  <Send className="h-4 w-4" /> {editing ? "Save changes" : "Submit for review"}
                </>
              )}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" size="lg" onClick={resetForm} disabled={submitting}>
                Cancel edit
              </Button>
            )}
          </div>
        </form>
      </div>

      <div>
        <h2 className="font-display text-xl font-extrabold text-gray-900">Your submissions</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Colleges you have added, and where each one stands in review.
        </p>

        {mineError ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{mineError}</p>
        ) : mine === null ? (
          <p className="px-1 py-6 text-sm text-slate-400">Loading your submissions…</p>
        ) : mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
            You have not added a college yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {mine.map((row) => {
              const revisable = isRevisable(row.status);
              const busy = busyId === row.id;
              return (
                <li key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{row.proposed_name}</p>
                      <p className="text-xs text-slate-500">
                        Submitted {formatDate(row.created_at)}
                        {row.proposed_city ? ` · ${row.proposed_city}` : ""}
                      </p>
                    </div>
                    <Badge variant={SUBMISSION_STATUS_TONE[row.status]}>
                      {SUBMISSION_STATUS_LABEL[row.status]}
                    </Badge>
                  </div>

                  {row.reviewer_notes ? (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{row.reviewer_notes}</span>
                    </p>
                  ) : null}

                  {row.status === "approved" && row.college_slug && row.college_is_active !== false ? (
                    <a
                      href={`/colleges/${row.college_slug}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800"
                    >
                      View the published college <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : row.status === "approved" && row.college_slug ? (
                    // The link is real but the college is archived, and
                    // `/colleges/{slug}` filters on `is_active` — so rendering
                    // the anchor would only 404. Say what happened instead.
                    <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>
                        Your suggestion was approved, but this college is not currently
                        published in the catalogue.
                      </span>
                    </p>
                  ) : null}

                  {revisable ? (
                    <div className="mt-3 flex items-center justify-end gap-2">
                      {pendingWithdraw === row.id ? (
                        <>
                          <span className="mr-auto text-xs font-medium text-slate-500">
                            Withdraw this suggestion?
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void withdraw(row)}
                            className="inline-flex h-8 items-center rounded-lg bg-red-500 px-3 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            Withdraw
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingWithdraw(null)}
                            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPendingWithdraw(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Withdraw
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {pendingWithdraw !== null && (
          // Announce the inline confirmation for a screen reader, since it
          // replaces the Withdraw button the user just pressed.
          <span aria-live="polite" className="sr-only">
            Confirm withdrawal
          </span>
        )}
      </div>
    </div>
  );
}
