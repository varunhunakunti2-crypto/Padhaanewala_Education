"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Library, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import {
  ApiError,
  QUESTION_TYPES,
  adminApi,
  isForbidden,
  type AdminQuestionFacets,
  type AdminQuestionListItem,
  type AdminQuestionPaper,
  type QuestionType,
} from "@/lib/api";
import {
  buildQuestionPayload,
  emptyQuestionForm,
  nextSortOrder,
  questionFormFromRow,
  questionPayloadFromRow,
  type FieldErrors,
  type QuestionFormValues,
} from "@/lib/question-form";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { FieldSet, Textarea } from "@/components/admin/fields";
import { IconAction, SectionHeading } from "@/components/admin/primitives";

const DASH = "—";

/**
 * The admin question bank.
 *
 * Replaces a stub that read "No question bank is connected" — which was false.
 * The `test_questions` table exists, the nested CRUD under
 * `/mock-tests/{ref}/questions` has existed for a while, and the seeded JEE paper
 * holds 75 real questions. What was missing was the *read*: a question could only
 * be reached by already knowing which paper it was in. `GET /api/v1/questions`
 * and `/api/v1/questions/facets` are that read, and this panel is the editor on
 * top of them.
 *
 * Four decisions worth stating, because each could reasonably have gone the other
 * way:
 *
 *  - **Filters go to the server.** The route caps `limit` at 100, so filtering
 *    the rows already in memory would quietly hide everything past the first
 *    page — and a paper-scoped view would have been a worse bank, not a
 *    temporary limitation. It also means the counts shown are real counts.
 *  - **A question belongs to exactly one paper.** `test_questions.mock_test_id` is
 *    `NOT NULL`, so there is no "which papers use this" and no reuse between
 *    papers. The paper is therefore shown on every row and the editor writes
 *    through that paper's nested route rather than a flat one that would have
 *    implied reuse it cannot deliver.
 *  - **Subject and topic come from the facets endpoint.** They are authored
 *    content. Hardcoding them means every new paper has to be remembered here,
 *    and until someone remembers, the dropdown offers a subject matching nothing.
 *  - **Every write re-reads.** No optimistic updates: an `mcq` whose key fell
 *    outside its options comes back as a 422 with a sentence naming the problem,
 *    and showing that verbatim is more useful than a local guess.
 */

interface QuestionRow {
  id: string;
  paper: string;
  stem: string;
  type: string;
  subject: string;
  topic: string;
  difficulty: string;
  marks: string;
  active: boolean;
}

function toRow(q: AdminQuestionListItem): QuestionRow {
  return {
    id: String(q.id),
    paper: q.paper_name,
    // Truncated for the table; the editor shows it whole. A full stem makes
    // every row the same height and buries the columns that differ.
    stem:
      q.question_text.length > 120
        ? `${q.question_text.slice(0, 120).trimEnd()}…`
        : q.question_text,
    type: q.question_type,
    subject: q.subject || DASH,
    topic: q.topic || DASH,
    difficulty: q.difficulty || DASH,
    marks: q.marks,
    active: q.is_active,
  };
}

/** Badge variants are the design system's, not Tailwind colour names. */
const DIFFICULTY_TONE: Record<string, "green" | "blue" | "amber" | "purple"> = {
  easy: "green",
  medium: "blue",
  hard: "amber",
  expert: "purple",
};

function typeTone(type: string): "blue" | "amber" | "gray" {
  if (type === "mcq") return "blue";
  if (type === "numeric") return "amber";
  return "gray";
}

/**
 * Turn an ApiError into something an editor can act on.
 *
 * The 422 from `_check_gradeable` is a sentence about a specific field
 * ("correct_answer 'c' is not one of the options"). Flattening that to "Please
 * retry" throws away the only clue about which box to look at.
 */
function describeError(err: unknown, fallback: string): string {
  if (isForbidden(err)) {
    return "You do not have permission to author questions. This needs a content_manager or admin role.";
  }
  if (err instanceof ApiError) {
    if (typeof err.detail === "string" && err.detail.trim()) return err.detail;
    if (err.status === 404) return "That paper or question no longer exists.";
    if (err.status === 0) return "Could not reach the API.";
  }
  return fallback;
}

function FieldErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}

interface Filters {
  paper: string;
  subject: string;
  topic: string;
  difficulty: string;
  question_type: string;
  is_active: string;
  q: string;
}

const NO_FILTER: Filters = {
  paper: "",
  subject: "",
  topic: "",
  difficulty: "",
  question_type: "",
  is_active: "",
  q: "",
};

/**
 * Serialise the filters into a query string.
 *
 * Empty means "no filter", not "match the empty string": `subject=` would be sent
 * literally and the panel would look broken. `is_active` is a tri-state, which is
 * why it is a string here and only reaches the wire when it is "true" or "false".
 *
 * Deliberately carries no `limit=`. `adminApi.questions` walks the pages, and
 * `tests/page-size-contract.test.ts` fails an admin section that writes its own
 * page size — the rule that stops a panel repeating the `?limit=1000` bug, where
 * the request 422'd and the panel rendered as "no data".
 */
function filterQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === "") continue;
    params.set(key, value);
  }
  return params.toString();
}

function hasAnyFilter(filters: Filters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

export function QuestionsSection() {
  const { showToast } = useApp();
  // `filters` is what the editor controls; `applied` is what has been sent. Two
  // pieces of state rather than one because the list is fetched, not filtered
  // client-side — a request per keystroke would hammer the API and flicker the
  // loading state on every character.
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const [applied, setApplied] = useState<Filters>(NO_FILTER);
  const [facets, setFacets] = useState<AdminQuestionFacets | null>(null);
  const [facetError, setFacetError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminQuestionListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // The facets are reference data, loaded once and after writes, not through
  // `useAdminResource` — that hook reloads with the list and would refetch them
  // on every filter change for values that only change when a question is saved.
  const loadFacets = useCallback(() => {
    let ignore = false;
    adminApi
      .questionFacets()
      .then((next) => {
        if (ignore) return;
        setFacets(next);
        setFacetError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setFacets(null);
        setFacetError(describeError(err, "Could not load the filter options."));
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(loadFacets, [loadFacets]);

  const { data, error, loading, reload } = useAdminResource<AdminQuestionListItem>(
    () => adminApi.questions(filterQuery(applied)),
    {
      forbiddenMessage:
        "You do not have permission to view the question bank. This needs a content_manager or admin role.",
      unreachableMessage: "Could not reach the questions API.",
    },
  );

  const rows = useMemo(() => (data ?? []).map(toRow), [data]);
  const byId = useMemo(() => {
    const map = new Map<number, AdminQuestionListItem>();
    for (const q of data ?? []) map.set(q.id, q);
    return map;
  }, [data]);

  const papers = facets?.papers ?? [];
  const activeCount = useMemo(
    () => (data ?? []).filter((q) => q.is_active).length,
    [data],
  );
  const filtered = hasAnyFilter(applied);

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilters(NO_FILTER);
    setApplied(NO_FILTER);
  };

  const toggleActive = async (row: AdminQuestionListItem) => {
    setBusyId(row.id);
    try {
      await adminApi.updateQuestion(
        row.paper_slug,
        row.id,
        questionPayloadFromRow(row, { is_active: !row.is_active }),
      );
      reload();
      showToast({
        title: row.is_active ? "Question deactivated" : "Question reactivated",
        description: row.is_active
          ? "Out of the paper, but every attempt that answered it keeps its result."
          : "Back in the paper.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not change the question",
        description: describeError(err, "Please retry."),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeQuestion = async (row: AdminQuestionListItem) => {
    setBusyId(row.id);
    try {
      await adminApi.deleteQuestion(row.paper_slug, row.id);
      reload();
      loadFacets();
      showToast({
        title: "Question removed",
        description:
          "Soft deleted, so attempts that answered it keep their results. It is still listed under the Inactive filter.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not remove the question",
        description: describeError(err, "Please retry."),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  // A new question goes into whatever paper the list is currently filtered to,
  // which is nearly always the intent; otherwise the editor opens on the first
  // paper and says so.
  const startingPaper = papers.find((p) => p.slug === filters.paper) ?? papers[0];

  return (
    <div>
      <SectionHeading
        title="Question bank"
        description="Author and maintain questions across every mock test"
        count={data?.length}
        action={
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> New question
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
        <div>
          <Label htmlFor="q-filter-paper">Paper</Label>
          <Select
            id="q-filter-paper"
            value={filters.paper}
            onChange={(e) => setFilter("paper", e.target.value)}
          >
            <option value="">All papers</option>
            {papers.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.question_count})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-filter-subject">Subject</Label>
          <Select
            id="q-filter-subject"
            value={filters.subject}
            onChange={(e) => setFilter("subject", e.target.value)}
          >
            <option value="">All subjects</option>
            {(facets?.subjects ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-filter-topic">Topic</Label>
          <Select
            id="q-filter-topic"
            value={filters.topic}
            onChange={(e) => setFilter("topic", e.target.value)}
          >
            <option value="">All topics</option>
            {(facets?.topics ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-filter-type">Type</Label>
          <Select
            id="q-filter-type"
            value={filters.question_type}
            onChange={(e) => setFilter("question_type", e.target.value)}
          >
            <option value="">All types</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-filter-difficulty">Difficulty</Label>
          <Select
            id="q-filter-difficulty"
            value={filters.difficulty}
            onChange={(e) => setFilter("difficulty", e.target.value)}
          >
            <option value="">Any difficulty</option>
            {(facets?.difficulties ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-filter-active">Status</Label>
          <Select
            id="q-filter-active"
            value={filters.is_active}
            onChange={(e) => setFilter("is_active", e.target.value)}
          >
            <option value="">Active and inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="q-filter-search">Search the question text</Label>
          <Input
            id="q-filter-search"
            value={filters.q}
            placeholder="Search stems…"
            onChange={(e) => setFilter("q", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setApplied(filters);
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            Searches the stem only. Use the subject and topic filters for those.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" size="sm" onClick={() => setApplied(filters)}>
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasAnyFilter(filters) && !hasAnyFilter(applied)}
          >
            Clear
          </Button>
        </div>
      </div>

      {facetError && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {facetError} The paper, type and status filters still work.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          Loading questions…
        </div>
      ) : rows.length ? (
        <>
          <p className="mb-2 text-xs text-slate-500">
            {activeCount} active of {rows.length} shown
            {filtered ? " (filtered)" : ""}. Each question belongs to exactly one paper.
          </p>
          <DataTable
            columns={[
              {
                key: "stem",
                header: "Question",
                render: (r) => <span className="text-gray-900">{r.stem}</span>,
              },
              { key: "paper", header: "Paper" },
              {
                key: "type",
                header: "Type",
                render: (r) => <Badge variant={typeTone(r.type)}>{r.type}</Badge>,
              },
              { key: "subject", header: "Subject" },
              { key: "topic", header: "Topic" },
              {
                key: "difficulty",
                header: "Difficulty",
                render: (r) => (
                  <Badge variant={DIFFICULTY_TONE[r.difficulty] ?? "gray"}>
                    {r.difficulty}
                  </Badge>
                ),
              },
              { key: "marks", header: "Marks" },
              {
                key: "active",
                header: "Status",
                render: (r) =>
                  r.active ? (
                    <Badge variant="green">active</Badge>
                  ) : (
                    <Badge variant="yellow">inactive</Badge>
                  ),
              },
              {
                key: "actions",
                header: "",
                className: "text-right",
                render: (r) => {
                  // The table row is a projection; the write path needs the full
                  // record. If the two ever disagree the action is withheld
                  // rather than fired against a half-known question.
                  const source = byId.get(Number(r.id));
                  if (!source) return null;
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        title={source.is_active ? "Deactivate" : "Reactivate"}
                        disabled={busyId === source.id}
                        onClick={() => void toggleActive(source)}
                      >
                        {source.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </IconAction>
                      <IconAction title="Edit question" onClick={() => setEditing(source)}>
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                      <IconAction
                        title="Remove from paper"
                        disabled={busyId === source.id}
                        onClick={() => void removeQuestion(source)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    </div>
                  );
                },
              },
            ]}
            rows={rows}
            searchKeys={["stem", "paper", "subject", "topic"]}
            searchPlaceholder="Filter these results…"
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <Library className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {filtered ? "No questions match these filters." : "No questions yet."}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            {filtered
              ? "The bank has questions, but none match this combination. Clear the filters to see all of them."
              : "A question needs a paper and a stem, and — for it to be scorable — options and a key for an mcq."}
          </p>
          {filtered && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {creating && (
        <QuestionEditor
          papers={papers}
          defaultPaper={startingPaper}
          suggestions={facets}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
            loadFacets();
          }}
        />
      )}

      {editing && (
        <QuestionEditor
          question={editing}
          suggestions={facets}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            loadFacets();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Question editor ------------------------------ */

/**
 * Create or edit one question.
 *
 * Mounted only while open, so the form state belongs to the modal and there is no
 * reset-on-close case to get wrong. Suggestions are passed in rather than read
 * from module state so that re-picking a paper cannot remount the editor and
 * discard half-typed input.
 */
function QuestionEditor({
  question,
  papers = [],
  defaultPaper,
  suggestions,
  onClose,
  onSaved,
}: {
  question?: AdminQuestionListItem;
  papers?: AdminQuestionPaper[];
  defaultPaper?: AdminQuestionPaper;
  suggestions?: AdminQuestionFacets | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useApp();
  const isEdit = question !== undefined;

  const [values, setValues] = useState<QuestionFormValues>(() =>
    question
      ? questionFormFromRow(question)
      : emptyQuestionForm(nextSortOrder(defaultPaper)),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // On create the paper is a choice and can change until it is saved; on edit it
  // is fixed, because a question's identity is its (paper, id) pair and the
  // nested route refuses a question addressed through the wrong paper. Held here
  // rather than in the form values because the request body has no paper field —
  // the route carries it.
  const [chosenPaper, setChosenPaper] = useState(defaultPaper?.slug ?? "");
  const targetPaper = isEdit ? question!.paper_slug : chosenPaper;
  const targetName = isEdit
    ? question!.paper_name
    : (papers.find((p) => p.slug === chosenPaper)?.name ?? "the paper");

  const set = <K extends keyof QuestionFormValues>(
    key: K,
    value: QuestionFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as it is touched, so a corrected box is not
    // still labelled wrong.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const setOption = (index: number, value: string) => {
    const options = [...values.options];
    const previous = options[index];
    options[index] = value;
    // Re-point the key when the option carrying it is edited. Otherwise the key
    // silently stops matching — the radio the author picked now points at text
    // that no longer exists — and the save 422s for a reason they cannot see.
    const correct = values.correct_answer === previous ? value : values.correct_answer;
    setValues((prev) => ({ ...prev, options, correct_answer: correct }));
  };

  const save = async () => {
    if (!isEdit && !targetPaper) {
      setFormError("Choose which paper this question belongs to.");
      return;
    }
    const built = buildQuestionPayload(values);
    if (!built.ok) {
      setErrors(built.errors);
      setFormError("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      if (isEdit) {
        // Re-send is_active: the route's body is the full question and an omitted
        // key leaves the column alone, so dropping it here would leave the row as
        // it is — which is correct, but only because the editor never toggles it.
        await adminApi.updateQuestion(question!.paper_slug, question!.id, {
          ...built.value,
          is_active: question!.is_active,
        });
      } else {
        await adminApi.createQuestion(targetPaper, built.value);
      }
      showToast({
        title: isEdit ? "Question updated" : "Question added",
        description: isEdit
          ? "The change is live in the paper."
          : `Added to ${targetName}.`,
        variant: "success",
      });
      onSaved();
    } catch (err) {
      setFormError(describeError(err, "Could not save the question."));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Whether there is nowhere to save a new question.
   *
   * `papers` comes from the facets endpoint, which lists papers holding zero
   * questions too, so a count of 0 here means no paper exists at all -- not the
   * far more common "every paper is still empty". The distinction matters:
   * treating the empty paper as unavailable is what made the first question of a
   * new paper unauthororable. Editing is exempt because the paper already exists
   * and is implied by the row that was opened.
   */
  const noPapers = !isEdit && papers.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit question" : "New question"}
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {formError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            {formError}
          </p>
        )}

        {!isEdit && (
          <div>
            <Label htmlFor="q-paper-choice">Paper</Label>
            <Select
              id="q-paper-choice"
              value={chosenPaper}
              onChange={(e) => {
                setChosenPaper(e.target.value);
                setFormError(null);
              }}
            >
              <option value="">Choose a paper…</option>
              {papers.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} ({p.question_count} questions)
                </option>
              ))}
            </Select>
            {noPapers && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                There is no published paper to save this into. Create a mock test, then
                add its first question here.
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="q-text">Question</Label>
          <Textarea
            id="q-text"
            rows={3}
            value={values.question_text}
            onChange={(v) => set("question_text", v)}
          />
          {errors.question_text && (
            <FieldErrorText>{errors.question_text}</FieldErrorText>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="q-type-choice">Type</Label>
            <Select
              id="q-type-choice"
              value={values.question_type}
              onChange={(e) => set("question_type", e.target.value as QuestionType)}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              {values.question_type === "essay"
                ? "Never auto-graded — routed to manual review."
                : values.question_type === "numeric"
                  ? "Auto-graded against the numeric answer, within tolerance."
                  : "Auto-graded against the chosen option."}
            </p>
          </div>
          <div>
            <Label htmlFor="q-diff">Difficulty</Label>
            <Input
              id="q-diff"
              list="q-difficulties"
              value={values.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
            />
            <datalist id="q-difficulties">
              {["easy", "medium", "hard", "expert"].map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </div>

        {values.question_type === "mcq" && (
          <FieldSet
            legend="Options"
            note="Mark the correct one. It has to match an option exactly: a key that is not among the options is accepted by the database and then marks every submission of this question wrong, permanently."
          >
            {errors.options && <FieldErrorText>{errors.options}</FieldErrorText>}
            <div className="space-y-2">
              {values.options.map((option, index) => (
                <div key={`q-option-${index}`} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="q-correct-answer"
                    checked={option !== "" && values.correct_answer === option}
                    onChange={() => set("correct_answer", option)}
                    aria-label={`Mark option ${index + 1} correct`}
                  />
                  <Input
                    id={`q-option-${index}`}
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    onChange={(e) => setOption(index, e.target.value)}
                  />
                  <IconAction
                    title="Remove this option"
                    onClick={() =>
                      set(
                        "options",
                        values.options.filter((_, i) => i !== index),
                      )
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
              onClick={() => set("options", [...values.options, ""])}
            >
              <Plus className="h-3.5 w-3.5" /> Add option
            </Button>
            {errors.correct_answer && (
              <FieldErrorText>{errors.correct_answer}</FieldErrorText>
            )}
          </FieldSet>
        )}

        {values.question_type === "numeric" && (
          <FieldSet
            legend="Numeric answer"
            note="Leave both blank to save a draft. The question is then routed to manual review rather than marked wrong."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-numeric">Answer</Label>
                <Input
                  id="q-numeric"
                  inputMode="decimal"
                  value={values.numeric_answer}
                  onChange={(e) => set("numeric_answer", e.target.value)}
                />
                {errors.numeric_answer && (
                  <FieldErrorText>{errors.numeric_answer}</FieldErrorText>
                )}
              </div>
              <div>
                <Label htmlFor="q-tolerance">Tolerance</Label>
                <Input
                  id="q-tolerance"
                  inputMode="decimal"
                  value={values.tolerance}
                  onChange={(e) => set("tolerance", e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Absolute margin. 0 means an exact match.
                </p>
                {errors.tolerance && <FieldErrorText>{errors.tolerance}</FieldErrorText>}
              </div>
            </div>
          </FieldSet>
        )}

        <FieldSet
          legend="Classification"
          note="Suggestions come from what is already in the bank. Blank is fine — a blank box is stored as null, not as an empty string."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="q-subject-input">Subject</Label>
              <Input
                id="q-subject-input"
                list="q-subjects"
                value={values.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
              <datalist id="q-subjects">
                {(suggestions?.subjects ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {errors.subject && <FieldErrorText>{errors.subject}</FieldErrorText>}
            </div>
            <div>
              <Label htmlFor="q-topic-input">Topic</Label>
              <Input
                id="q-topic-input"
                list="q-topics"
                value={values.topic}
                onChange={(e) => set("topic", e.target.value)}
              />
              <datalist id="q-topics">
                {(suggestions?.topics ?? []).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {errors.topic && <FieldErrorText>{errors.topic}</FieldErrorText>}
            </div>
          </div>
        </FieldSet>

        <FieldSet legend="Scoring">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="q-marks">Marks</Label>
              <Input
                id="q-marks"
                inputMode="decimal"
                value={values.marks}
                onChange={(e) => set("marks", e.target.value)}
              />
              {errors.marks && <FieldErrorText>{errors.marks}</FieldErrorText>}
            </div>
            <div>
              <Label htmlFor="q-negative">Negative marks</Label>
              <Input
                id="q-negative"
                inputMode="decimal"
                value={values.negative_marks}
                onChange={(e) => set("negative_marks", e.target.value)}
              />
              {errors.negative_marks && (
                <FieldErrorText>{errors.negative_marks}</FieldErrorText>
              )}
            </div>
            <div>
              <Label htmlFor="q-order">Position in paper</Label>
              <Input
                id="q-order"
                inputMode="numeric"
                value={values.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
              {errors.sort_order && (
                <FieldErrorText>{errors.sort_order}</FieldErrorText>
              )}
            </div>
          </div>
        </FieldSet>

        <div>
          <Label htmlFor="q-explanation">Explanation</Label>
          <Textarea
            id="q-explanation"
            rows={3}
            value={values.explanation}
            onChange={(v) => set("explanation", v)}
          />
          {errors.explanation && (
            <FieldErrorText>{errors.explanation}</FieldErrorText>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={saving || noPapers}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add question"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
