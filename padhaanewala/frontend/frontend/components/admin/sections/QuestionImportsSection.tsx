"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import {
  ApiError,
  CONTENT_ROLES,
  adminApi,
  isForbidden,
  type AdminQuestionPaper,
  type ImportDraft,
  type ImportJob,
  type ImportResponse,
} from "@/lib/api";
import {
  EMPTY_IMPORT_FORM,
  PDF_IMPORT_ACCEPT_ATTRIBUTE,
  PDF_IMPORT_DEFAULT_PER_CHUNK,
  buildDraftUpdate,
  buildImportUpload,
  confirmPdfBytes,
  describeImportError,
  draftFormFromDraft,
  draftOptionsWithKey,
  formatImportBytes,
  importMaxBytes,
  validateImportPdf,
  type DraftFieldErrors,
  type DraftFormValues,
  type ImportFormValues,
} from "@/lib/question-import-form";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { FieldSet, Textarea } from "@/components/admin/fields";
import { IconAction, SectionHeading } from "@/components/admin/primitives";

/**
 * PDF import and draft review.
 *
 * The backend has had `POST /question-imports/pdf` since this feature was built --
 * a job row, a background generation pass, a draft per question, and approve /
 * reject / discard -- with no client ever calling it. A content admin could not
 * put a scanned paper into the bank, which is the whole reason the endpoint
 * exists. This panel is that call path, and it lives inside the question bank
 * rather than as a section of its own because every one of these questions lands
 * in the bank: approving here changes what the table below shows.
 *
 * Decisions worth stating, because each could reasonably have gone the other way:
 *
 *  - **Nothing is published by generating.** A draft arrives `pending` and
 *    `is_active = false`, and the student query (`_PUBLISHABLE`) cannot see it.
 *    The panel says so, because a batch that looked published would be worse than
 *    one that looked stuck.
 *  - **Polling, not a progress stream.** The 202 answers immediately and the job
 *    is a row that outlives the tab, so this re-reads `GET /question-imports/{id}`
 *    every few seconds and stops at a terminal status. It gives up after
 *    {@link POLL_ATTEMPTS} rather than polling forever: a job stranded by a worker
 *    restart sits at `processing` forever, and an interval that never ends is how
 *    a browser tab ends up making a request every five seconds all afternoon.
 *  - **Discard warns before it removes published questions.** The route deletes
 *    every draft in the job, including the approved ones -- so on a half-reviewed
 *    batch it takes live questions out of the paper. "Discard" reading like
 *    clearing a queue would be a lie.
 *  - **Rejecting is reversible.** The backend allows re-approving, so the reject
 *    button on a rejected draft reads as a mistake to undo rather than a verdict.
 *  - **The edit dialog is mounted only while open**, matching `QuestionEditor` in
 *    `QuestionsSection`, so the form state has no reset-on-close case to get wrong.
 */

/** How often a `processing` job is re-read. */
const POLL_MS = 5000;

/**
 * Roughly five minutes of polling before the panel stops and says so.
 *
 * A 200-page paper at 12,000 characters a chunk is a lot of sequential generation,
 * so this is generous rather than tight -- but bounded, because the failure mode of
 * an unbounded poll is a tab that never stops asking.
 */
const POLL_ATTEMPTS = 60;

/** Badge variants are the design system's, not Tailwind colour names. */
const STATUS_TONE: Record<string, "gray" | "blue" | "green" | "red"> = {
  processing: "blue",
  ready: "green",
  failed: "red",
};

const REVIEW_TONE: Record<string, "yellow" | "green" | "red"> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
};

/** `review_status` values the bulk action is allowed to touch. */
const isPending = (draft: ImportDraft) => draft.review_status === "pending";

/**
 * Turn a rejected call in this flow into something an admin can act on.
 *
 * `describeImportError` in `lib/question-import-form.ts` covers the statuses the
 * *upload* route raises (403 / 413 / 422 / 503). The draft routes add two worth
 * naming, and both are about wording rather than status:
 *
 *  - A 422 from `_check_gradeable_mcq` arrives as a sentence about a specific
 *    field — `correct_answer 'c' is not one of the options`. Flattening that to
 *    "Please retry" throws away the only clue about which box to look at.
 *  - A 404 here means the job or draft is gone, which in practice means someone
 *    discarded the batch. "That draft no longer exists" is more use than a bare
 *    status.
 */
function describeImportFlowError(err: unknown): string {
  if (err instanceof ApiError) {
    if (isForbidden(err)) {
      return "You do not have permission to review drafts. This needs a content_manager or admin role.";
    }
    if (err.status === 404) {
      return "That draft is gone. Reload the job — it may have been discarded.";
    }
    if (err.status === 422 && typeof err.detail === "string" && err.detail.trim()) {
      return err.detail;
    }
  }
  return describeImportError(err);
}

/**
 * Whether a draft could be graded at all.
 *
 * The same rule the server enforces in `_check_gradeable_mcq`: an mcq needs
 * options and a key that is one of them. Checked here so the approve control can
 * be disabled and the row can say why, rather than the admin clicking and reading
 * a 422.
 */
const isGradeable = (draft: ImportDraft) => {
  const options = draft.options ?? [];
  return (
    options.length >= 2 &&
    draft.correct_answer !== null &&
    options.includes(draft.correct_answer)
  );
};

export function QuestionImportsSection({
  papers,
  onQuestionsChanged,
}: {
  /** From the bank's facets, so the picker cannot disagree with the filter above. */
  papers: AdminQuestionPaper[];
  /** Fires after a write that changes the bank's rows: an approval or a discard. */
  onQuestionsChanged?: () => void;
}) {
  const { showToast, roles } = useApp();
  // Mirrors `require_role(*CONTENT_ROLES)` on every route in the flow. A reader
  // without one of these roles is shown the job history and no controls, rather
  // than buttons that 403.
  const canWrite = CONTENT_ROLES.some((role) => roles.includes(role));

  const {
    data: jobs,
    error: listError,
    loading: listLoading,
    reload: reloadJobs,
  } = useAdminResource<ImportJob[]>(() => adminApi.questionImports(), {
    forbiddenMessage:
      "You do not have permission to see PDF imports. This needs a content_manager or admin role.",
    unreachableMessage: "Could not reach the question import API.",
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [detail, setDetail] = useState<ImportResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [editing, setEditing] = useState<ImportDraft | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<number | null>(null);
  const [gaveUpPolling, setGaveUpPolling] = useState(false);

  /** Cleared when the job list changes so a re-read picks up a new job's status. */
  const pollsLeft = useRef(POLL_ATTEMPTS);

  const loadDetail = useCallback(
    async (jobId: number) => {
      setDetailBusy(true);
      try {
        const next = await adminApi.questionImport(jobId);
        setDetail(next);
        setDetailError(null);
      } catch (err) {
        setDetailError(describeImportFlowError(err));
      } finally {
        setDetailBusy(false);
      }
    },
    [],
  );

  const openJob = async (jobId: number) => {
    pollsLeft.current = POLL_ATTEMPTS;
    setGaveUpPolling(false);
    setDetail(null);
    setDetailError(null);
    await loadDetail(jobId);
  };

  /**
   * The poll. Keyed on the job id and its status, so the timer is created once per
   * job rather than once per response, and exists exactly while a job is
   * generating.
   */
  const pollingJobId =
    detail !== null && detail.job.status === "processing" && !gaveUpPolling
      ? detail.job.id
      : null;
  useEffect(() => {
    if (pollingJobId === null) return;
    const jobId = pollingJobId;
    const timer = setInterval(() => {
      if (pollsLeft.current <= 0) {
        setGaveUpPolling(true);
        return;
      }
      pollsLeft.current -= 1;
      void loadDetail(jobId);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pollingJobId, loadDetail]);

  // The list is a summary of the same rows the detail shows, so a job reaching a
  // terminal status has to refresh both. Cheap, and it keeps the counts on the
  // collapsed row honest.
  const settledJobId =
    detail !== null && detail.job.status !== "processing" ? detail.job.id : null;
  useEffect(() => {
    if (settledJobId !== null) reloadJobs();
  }, [settledJobId, reloadJobs]);

  const drafts = useMemo(() => detail?.drafts ?? [], [detail]);
  const pendingCount = useMemo(() => drafts.filter(isPending).length, [drafts]);
  const ungradeable = useMemo(
    () => drafts.filter((d) => isPending(d) && !isGradeable(d)).length,
    [drafts],
  );

  const afterWrite = (jobId: number, message: { title: string; description?: string }) => {
    showToast({ ...message, variant: "success" });
    void loadDetail(jobId);
    reloadJobs();
    onQuestionsChanged?.();
  };

  const reviewDraft = async (draft: ImportDraft, approved: boolean) => {
    if (detail === null) return;
    setDetailBusy(true);
    try {
      await adminApi.reviewQuestionImportDraft(detail.job.id, draft.question_id, approved);
      afterWrite(detail.job.id, {
        title: approved ? "Published to the paper" : "Rejected",
        description: approved
          ? "Students on this paper will now be served this question."
          : "It stays listed as rejected, and out of the paper.",
      });
    } catch (err) {
      showToast({
        title: "Could not save that verdict",
        description: describeImportFlowError(err),
        variant: "error",
      });
    } finally {
      setDetailBusy(false);
    }
  };

  const reviewAll = async (approved: boolean) => {
    if (detail === null) return;
    setDetailBusy(true);
    try {
      const job = await adminApi.reviewAllQuestionImportDrafts(detail.job.id, approved);
      const left = job.draft_count - job.approved_count - job.rejected_count;
      showToast({
        title: approved ? "Approved the rest" : "Rejected the rest",
        // The bulk route only touches `pending` rows and skips the ones it cannot
        // grade, so the count it returns is the number that actually moved.
        description:
          left > 0
            ? `${job.approved_count} approved, ${job.rejected_count} rejected. ${left} still pending — those are missing options or an answer key.`
            : `${job.approved_count} approved, ${job.rejected_count} rejected.`,
        variant: left > 0 ? "info" : "success",
      });
      void loadDetail(detail.job.id);
      reloadJobs();
      onQuestionsChanged?.();
    } catch (err) {
      showToast({
        title: "Could not review the batch",
        description: describeImportFlowError(err),
        variant: "error",
      });
    } finally {
      setDetailBusy(false);
    }
  };

  const discard = async (jobId: number) => {
    setPendingDiscard(null);
    setDetailBusy(true);
    try {
      await adminApi.discardQuestionImport(jobId);
      setDetail(null);
      showToast({
        title: "Import discarded",
        description: "The job, its drafts and the stored PDF are gone.",
        variant: "success",
      });
      reloadJobs();
      onQuestionsChanged?.();
    } catch (err) {
      showToast({
        title: "Could not discard",
        description: describeImportFlowError(err),
        variant: "error",
      });
    } finally {
      setDetailBusy(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailError(null);
    setGaveUpPolling(false);
    pollsLeft.current = POLL_ATTEMPTS;
  };

  const busy = detailBusy;

  return (
    <div className="mb-6 rounded-2xl border border-purple-100 bg-purple-50/30 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
      <SectionHeading
        title="Import from a PDF"
        description="Upload a question paper and review the drafted questions before anything reaches students"
        count={jobs?.length}
        action={
          canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload PDF
            </Button>
          ) : undefined
        }
      />

      <p className="mb-3 text-xs text-slate-500">
        Generation only reads the PDF&apos;s text layer — a scanned paper with no text
        produces nothing. Drafts are saved unactivated and stay invisible to students
        until they are approved here.
      </p>

      {listError && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {listError}
        </p>
      )}

      {listLoading && !jobs ? (
        <p className="py-3 text-sm text-slate-400">Loading imports…</p>
      ) : (jobs ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <FileText className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No PDFs imported yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            A paper becomes questions here, rather than being typed into the bank one
            question at a time. Approving is still a human decision.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(jobs ?? []).map((job) => {
            const open = detail?.job.id === job.id;
            return (
              <li
                key={job.id}
                className={
                  "rounded-xl border bg-white p-3 dark:bg-slate-900 " +
                  (open ? "border-purple-300 dark:border-purple-700" : "border-slate-200 dark:border-slate-800")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {job.mock_test_name ?? job.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {job.filename} · {formatImportBytes(job.file_size)} ·{" "}
                      {job.page_count} {job.page_count === 1 ? "page" : "pages"} ·{" "}
                      {job.draft_count} drafted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_TONE[job.status] ?? "gray"}>
                      {job.status === "processing" && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {job.status}
                    </Badge>
                    {job.approved_count > 0 && (
                      <span className="text-xs text-slate-400">
                        {job.approved_count} approved
                        {job.rejected_count > 0 ? `, ${job.rejected_count} rejected` : ""}
                      </span>
                    )}
                    {canWrite && (
                      <IconAction
                        title={
                          open
                            ? "Hide the drafts"
                            : job.status === "processing"
                              ? "Watch this job"
                              : "Review the drafts"
                        }
                        onClick={() => (open ? closeDetail() : void openJob(job.id))}
                      >
                        <FileText className="h-4 w-4" />
                      </IconAction>
                    )}
                    {canWrite &&
                      (pendingDiscard === job.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void discard(job.id)}
                            className="inline-flex h-7 items-center rounded-lg bg-red-500 px-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            Delete {job.draft_count} too
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDiscard(null)}
                            className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <IconAction
                          title="Discard this import"
                          onClick={() => setPendingDiscard(job.id)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconAction>
                      ))}
                  </div>
                </div>

                {job.status === "failed" && job.error_message && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {job.error_message}
                  </p>
                )}

                {open && detail !== null && (
                  <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {job.status === "processing" ? (
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reading the PDF and drafting questions. This panel checks every few
                        seconds.
                        {gaveUpPolling && (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              pollsLeft.current = POLL_ATTEMPTS;
                              setGaveUpPolling(false);
                              void loadDetail(job.id);
                            }}
                          >
                            Check again
                          </Button>
                        )}
                      </p>
                    ) : detailError !== null ? (
                      <p className="text-sm text-red-600">{detailError}</p>
                    ) : drafts.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        This upload produced no drafts. The most common cause is a scanned
                        paper with no text layer.
                      </p>
                    ) : (
                      <>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            {pendingCount > 0 ? (
                              <>
                                {pendingCount} of {drafts.length} still to review.
                              </>
                            ) : (
                              <>All {drafts.length} reviewed.</>
                            )}
                            {ungradeable > 0 && (
                              <span className="ml-1 font-medium text-amber-700">
                                {ungradeable} cannot be approved: no options, or no key.
                              </span>
                            )}
                          </p>
                          {canWrite && pendingCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void reviewAll(false)}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject {pendingCount}
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                disabled={busy}
                                onClick={() => void reviewAll(true)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve {pendingCount}
                              </Button>
                            </div>
                          )}
                        </div>

                        <ul className="space-y-1.5">
                          {drafts.map((draft, index) => {
                            const gradeable = isGradeable(draft);
                            return (
                              <li
                                key={draft.question_id}
                                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-slate-800 dark:text-slate-100">
                                    <span className="mr-1.5 font-semibold text-slate-400">
                                      {index + 1}.
                                    </span>
                                    {draft.question_text}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Key: {draft.correct_answer ?? "—"} · +{draft.marks}
                                    {draft.negative_marks !== "0.00" &&
                                      ` / −${draft.negative_marks}`}
                                    {draft.subject ? ` · ${draft.subject}` : ""}
                                    {draft.difficulty ? ` · ${draft.difficulty}` : ""}
                                  </p>
                                  {!gradeable && isPending(draft) && (
                                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Missing options or an answer key — fix it, or reject it.
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant={REVIEW_TONE[draft.review_status] ?? "gray"}>
                                    {draft.review_status}
                                  </Badge>
                                  {canWrite && (
                                    <>
                                      <IconAction
                                        title="Correct this draft"
                                        onClick={() => setEditing(draft)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </IconAction>
                                      {draft.review_status === "approved" ? (
                                        <IconAction
                                          title="Reject this question"
                                          disabled={busy}
                                          onClick={() => void reviewDraft(draft, false)}
                                          className="hover:bg-red-50 hover:text-red-600"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </IconAction>
                                      ) : (
                                        <IconAction
                                          title="Approve into the paper"
                                          disabled={busy || !gradeable}
                                          onClick={() => void reviewDraft(draft, true)}
                                          className="hover:bg-emerald-50 hover:text-emerald-600"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </IconAction>
                                      )}
                                    </>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {uploadOpen && (
        <ImportUploadDialog
          papers={papers}
          onClose={() => setUploadOpen(false)}
          onUploaded={(jobId) => {
            setUploadOpen(false);
            reloadJobs();
            void openJob(jobId);
          }}
        />
      )}

      {editing !== null && detail !== null && (
        <DraftEditor
          jobId={detail.job.id}
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            showToast({
              title: "Draft updated",
              description:
                saved.review_status === "pending" && !saved.is_active
                  ? "It is back in the queue. Approve it again when it reads right."
                  : "Saved.",
              variant: "success",
            });
            void loadDetail(detail.job.id);
            onQuestionsChanged?.();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Upload ------------------------------ */

/**
 * The upload form.
 *
 * Mounted only while open. The target is a radio pair rather than two independent
 * fields because the route accepts exactly one of `mock_test_id` and
 * `new_paper_name` -- a form with two controls cannot express "exactly one", and
 * the 422 it produces arrives after the upload has already been spent.
 */
function ImportUploadDialog({
  papers,
  onClose,
  onUploaded,
}: {
  papers: AdminQuestionPaper[];
  onClose: () => void;
  onUploaded: (jobId: number) => void;
}) {
  const { showToast } = useApp();

  const [values, setValues] = useState<ImportFormValues>(EMPTY_IMPORT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickFile = async (next: File | null) => {
    setFormError(null);
    if (!next) {
      setFile(null);
      setFileError(null);
      return;
    }
    const checked = validateImportPdf(next);
    if (!checked.ok) {
      // Cleared rather than held: the form must never show a "chosen" file the
      // submit button is going to refuse.
      setFile(null);
      setFileError(checked.error);
      return;
    }
    const bytes = await confirmPdfBytes(next);
    if (!bytes.ok) {
      setFile(null);
      setFileError(bytes.error);
      return;
    }
    setFileError(null);
    setFile(next);
    if (values.new_paper_name.trim() === "") {
      setValues((v) => ({ ...v, new_paper_name: suggestPaperName(next.name) }));
    }
  };

  const submit = async () => {
    const built = buildImportUpload(values, file);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await adminApi.uploadQuestionImport(built.body);
      showToast({
        title: "Reading the PDF",
        description: created.created_paper
          ? `Created “${created.job.mock_test_name}” and started drafting into it.`
          : `Adding to ${created.job.mock_test_name}.`,
        variant: "info",
      });
      onUploaded(created.job.id);
    } catch (err) {
      setFormError(describeImportFlowError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const set = <K extends keyof ImportFormValues>(key: K, value: ImportFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFormError(null);
  };

  return (
    <Modal open onClose={onClose} title="Import questions from a PDF" className="max-w-2xl">
      <div className="space-y-4">
        <div>
          <Label htmlFor="import-file">PDF file</Label>
          <input
            id="import-file"
            type="file"
            accept={PDF_IMPORT_ACCEPT_ATTRIBUTE}
            disabled={submitting}
            onChange={(e) => {
              void pickFile(e.target.files?.[0] ?? null);
              // Cleared so choosing the same file twice fires `change` again --
              // otherwise the second attempt looks like nothing happened.
              e.target.value = "";
            }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Up to {formatImportBytes(importMaxBytes())}, and it needs a text layer — a scan
            of a paper produces nothing.
          </p>
          {file && (
            <p className="mt-1.5 text-xs font-medium text-slate-600">
              {file.name} · {formatImportBytes(file.size)}
            </p>
          )}
        </div>

        <FieldSet
          legend="Where should these questions go?"
          note="One destination only. The server rejects both at once, and a new paper starts with these as its only questions."
          disabled={submitting}
        >
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="import-target"
              checked={values.target === "new"}
              onChange={() => set("target", "new")}
            />
            Create a new paper
          </label>
          {values.target === "new" && (
            <Input
              id="import-paper-name"
              maxLength={255}
              placeholder="JEE Main 2024 — Session 1"
              value={values.new_paper_name}
              onChange={(e) => set("new_paper_name", e.target.value)}
            />
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="import-target"
              checked={values.target === "existing"}
              onChange={() => set("target", "existing")}
            />
            Add to an existing paper
          </label>
          {values.target === "existing" && (
            <>
              <Select
                id="import-paper-choice"
                value={values.mock_test_id}
                onChange={(e) => set("mock_test_id", e.target.value)}
              >
                <option value="">
                  {papers.length === 0 ? "No papers yet" : "Choose a paper…"}
                </option>
                {papers.map((p) => (
                  <option key={p.mock_test_id} value={p.mock_test_id}>
                    {p.name} ({p.question_count} questions)
                  </option>
                ))}
              </Select>
              {papers.length === 0 && (
                <p className="text-xs text-amber-700">
                  There is no paper to add to yet. Create the mock test in the Mock tests
                  panel first, then import into it.
                </p>
              )}
            </>
          )}
        </FieldSet>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="import-subject">Subject</Label>
            <Input
              id="import-subject"
              maxLength={100}
              placeholder="Physics"
              value={values.subject}
              onChange={(e) => set("subject", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Optional. On a new paper this is its subject; on an existing one it is only
              used if the paper has none.
            </p>
          </div>
          <div>
            <Label htmlFor="import-per-chunk">Questions per 12,000 characters</Label>
            <Input
              id="import-per-chunk"
              inputMode="numeric"
              placeholder={String(PDF_IMPORT_DEFAULT_PER_CHUNK)}
              value={values.per_chunk}
              onChange={(e) => set("per_chunk", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Roughly how long the resulting paper is. Blank uses the server default of{" "}
              {PDF_IMPORT_DEFAULT_PER_CHUNK}.
            </p>
          </div>
        </div>

        {/* aria-live so a rejected upload is announced, not merely shown. */}
        <p aria-live="polite" className="min-h-5 text-sm text-red-600">
          {formError ?? fileError ?? ""}
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={submitting}>
            <Sparkles className="h-4 w-4" />
            {submitting ? "Uploading…" : "Upload and draft"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * `jee-main-2024-session-1.pdf` → `JEE Main 2024 Session 1`.
 *
 * A starting point for the new-paper name, not an answer: an admin naming a paper
 * properly is doing the naming, and this only saves retyping the filename.
 */
function suggestPaperName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

/* ------------------------------ Draft editor ------------------------------ */

/**
 * Correct one draft.
 *
 * Mounted only while open, so the values belong to this dialog and there is no
 * reset-on-close case. Two rules are enforced here rather than discovered from a
 * 422:
 *
 *  - **The key follows the option carrying it** ({@link draftOptionsWithKey}).
 *    Editing the correct option's text without moving the key leaves a key that
 *    matches nothing, and the save is then rejected for a reason nobody can see.
 *  - **Only changed fields are sent.** The route validates the merged row, so a
 *    full resend is both larger and more dangerous; see `buildDraftUpdate`.
 */
function DraftEditor({
  jobId,
  draft,
  onClose,
  onSaved,
}: {
  jobId: number;
  draft: ImportDraft;
  onClose: () => void;
  onSaved: (saved: ImportDraft) => void;
}) {
  const baseline = useMemo(() => draftFormFromDraft(draft), [draft]);
  const [values, setValues] = useState<DraftFormValues>(baseline);
  const [errors, setErrors] = useState<DraftFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DraftFormValues>(key: K, value: DraftFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Cleared on touch, so a corrected box is not still labelled wrong.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    setFormError(null);
  };

  const setOption = (index: number, value: string) => {
    setValues((prev) => ({
      ...prev,
      ...draftOptionsWithKey(prev.options, prev.correct_answer, index, value),
    }));
    setErrors((prev) => (prev.options ? { ...prev, options: undefined } : prev));
    setFormError(null);
  };

  const save = async () => {
    const built = buildDraftUpdate(values, baseline);
    if (!built.ok) {
      setErrors(built.errors);
      setFormError("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    setFormError(null);

    // Nothing changed: the route would accept an empty body and return the same
    // row, so there is no reason to make the request.
    if (!built.changed) {
      onSaved(draft);
      return;
    }

    setSaving(true);
    try {
      const saved = await adminApi.updateQuestionImportDraft(
        jobId,
        draft.question_id,
        built.value,
      );
      onSaved(saved);
    } catch (err) {
      setFormError(describeImportFlowError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Correct draft" className="max-w-3xl">
      <div className="space-y-4">
        {formError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            {formError}
          </p>
        )}

        <div>
          <Label htmlFor="draft-text">Question</Label>
          <Textarea
            id="draft-text"
            rows={3}
            value={values.question_text}
            onChange={(v) => set("question_text", v)}
          />
          {errors.question_text && <FieldErrorText>{errors.question_text}</FieldErrorText>}
        </div>

        <FieldSet
          legend="Options and answer key"
          note="The key has to match an option exactly. A key that is not among the options would mark every submission of this question wrong, permanently."
          disabled={saving}
        >
          {errors.options && <FieldErrorText>{errors.options}</FieldErrorText>}
          <div className="space-y-2">
            {values.options.map((option, index) => (
              <div key={`draft-option-${index}`} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="draft-correct-answer"
                  checked={option !== "" && values.correct_answer === option}
                  onChange={() => set("correct_answer", option)}
                  aria-label={`Mark option ${index + 1} correct`}
                />
                <Input
                  id={`draft-option-${index}`}
                  value={option}
                  placeholder={`Option ${index + 1}`}
                  onChange={(e) => setOption(index, e.target.value)}
                />
                <IconAction
                  title="Remove this option"
                  disabled={saving}
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      options: prev.options.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </IconAction>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={saving}
            onClick={() => set("options", [...values.options, ""])}
          >
            Add option
          </Button>
          {errors.correct_answer && (
            <FieldErrorText>{errors.correct_answer}</FieldErrorText>
          )}
        </FieldSet>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="draft-subject">Subject</Label>
            <Input
              id="draft-subject"
              maxLength={100}
              value={values.subject}
              onChange={(e) => set("subject", e.target.value)}
            />
            {errors.subject && <FieldErrorText>{errors.subject}</FieldErrorText>}
          </div>
          <div>
            <Label htmlFor="draft-topic">Topic</Label>
            <Input
              id="draft-topic"
              maxLength={255}
              value={values.topic}
              onChange={(e) => set("topic", e.target.value)}
            />
            {errors.topic && <FieldErrorText>{errors.topic}</FieldErrorText>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="draft-difficulty">Difficulty</Label>
            <Input
              id="draft-difficulty"
              list="draft-difficulties"
              value={values.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
            />
            <datalist id="draft-difficulties">
              {["easy", "medium", "hard", "expert"].map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {errors.difficulty && <FieldErrorText>{errors.difficulty}</FieldErrorText>}
          </div>
          <div>
            <Label htmlFor="draft-marks">Marks</Label>
            <Input
              id="draft-marks"
              inputMode="decimal"
              value={values.marks}
              onChange={(e) => set("marks", e.target.value)}
            />
            {errors.marks && <FieldErrorText>{errors.marks}</FieldErrorText>}
          </div>
          <div>
            <Label htmlFor="draft-negative">Negative marks</Label>
            <Input
              id="draft-negative"
              inputMode="decimal"
              value={values.negative_marks}
              onChange={(e) => set("negative_marks", e.target.value)}
            />
            {errors.negative_marks && (
              <FieldErrorText>{errors.negative_marks}</FieldErrorText>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="draft-explanation">Explanation</Label>
          <Textarea
            id="draft-explanation"
            rows={3}
            value={values.explanation}
            onChange={(v) => set("explanation", v)}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Shown to students on the results screen, so clearing it here is a real
            change rather than a no-op.
          </p>
        </div>

        {draft.review_status === "approved" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            This question is already in the paper. Saving sends it back to pending, so
            the changed version is what students get once you approve it again.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FieldErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}