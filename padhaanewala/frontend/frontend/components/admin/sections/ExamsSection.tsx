"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminExam } from "@/lib/api";
import {
  EMPTY_EXAM_FORM,
  buildExamPayload,
  examFormFromDetail,
  type ExamFormValues,
} from "@/lib/exam-form";
import { rowRefFor } from "@/lib/form-parts";

import { SectionHeading, FilterChips } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { ExamFormFields } from "@/components/admin/sections/ExamForm";

interface ExamRow extends Omit<AdminExam, "id"> {
  id: string;
  record: AdminExam;
}

/**
 * Exams, with create / edit / delete against the real API.
 *
 * The old panel asked for `limit=200` against a route that caps `limit` at 100, so
 * every load was a 422 — rendered as "Could not reach the API" and read as a
 * backend outage. `adminApi.exams()` walks the offsets.
 *
 * ## The "Stage" and "Duration" columns were fiction, and one column was a lie
 *
 * "Registration Open" / "Results Declared" was derived from the bundled demo
 * exams; no stage is stored anywhere. "Duration" did not exist on the record.
 * Both are replaced by the dates the database actually holds.
 *
 * The Status column read `is_active` — which `ExamResponse` *does* carry, so this
 * one was honest — but it is still gone, because a row that is inactive is
 * filtered out of this very list and can therefore never render as "Inactive". A
 * column whose only possible value is "Active" is noise. `lib/exam-form.ts`
 * explains why no toggle is offered in its place.
 *
 * ## A "Syllabus" indicator, because the form cannot edit it
 *
 * `syllabus` is a JSON column and this form deliberately leaves it alone. Showing
 * whether one exists is what stops that looking like data loss: an admin who can
 * see "Syllabus: on file" knows saving this form did not remove it.
 */
export function ExamsSection() {
  const [type, setType] = useState<string | "all">("all");

  const crud = useCatalogCrud<AdminExam, ExamFormValues>({
    noun: "exam",
    entity: "exam",
    load: () => adminApi.exams(),
    unreachableMessage: "Could not reach the exams API.",
    emptyValues: EMPTY_EXAM_FORM,
    loadDetail: (row) => adminApi.exam(row.id).then(examFormFromDetail),
    refFor: rowRefFor,
    labelFor: (e) => e.name,
    build: buildExamPayload,
    create: async (p) => adminApi.createExam(p),
    update: async (ref, p) => adminApi.updateExam(ref, p),
    remove: (ref) => adminApi.deleteExam(ref),
  });

  const all = useMemo<ExamRow[]>(
    () =>
      crud.rows.map((e) => {
        const { id, ...rest } = e;
        return { ...rest, id: String(id), record: e };
      }),
    [crud.rows],
  );

  const examTypes = useMemo(
    () =>
      Array.from(new Set(all.map((e) => e.exam_type).filter((t): t is string => !!t))).sort(),
    [all],
  );

  const rows = type === "all" ? all : all.filter((e) => e.exam_type === type);
  const counts = useMemo(() => {
    const by: Partial<Record<string, number>> = {};
    for (const e of all) if (e.exam_type) by[e.exam_type] = (by[e.exam_type] ?? 0) + 1;
    return by;
  }, [all]);

  const title =
    crud.dialog === null
      ? "Exam"
      : crud.dialog.mode === "create"
        ? "Add exam"
        : `Edit ${crud.dialog.label}`;

  return (
    <div>
      <SectionHeading
        title="Examinations"
        description="Manage entrance exams and dates"
        count={rows.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> Add exam
            </Button>
          ) : undefined
        }
      />

      {examTypes.length > 0 ? (
        <div className="mb-4">
          <FilterChips
            options={examTypes as readonly string[]}
            value={type}
            onChange={setType}
            counts={counts}
          />
        </div>
      ) : null}

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading exams…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "name",
              header: "Exam",
              render: (e) => (
                <Link
                  href={`/exams/${e.slug}`}
                  className="font-semibold text-purple-700 hover:underline"
                >
                  {e.name}
                </Link>
              ),
            },
            {
              key: "exam_type",
              header: "Type",
              render: (e) => (e.exam_type ? <Badge variant="purple">{e.exam_type}</Badge> : "—"),
            },
            { key: "conducting_authority", header: "Authority", render: (e) => e.conducting_authority ?? "—" },
            {
              key: "application_deadline",
              header: "Apply by",
              render: (e) => e.application_deadline?.slice(0, 10) ?? "—",
            },
            { key: "exam_date", header: "Exam date", render: (e) => e.exam_date?.slice(0, 10) ?? "—" },
            { key: "result_date", header: "Result", render: (e) => e.result_date?.slice(0, 10) ?? "—" },
            {
              // The form cannot edit the JSON column, so this says whether one is
              // there rather than implying the admin can change it.
              key: "syllabus",
              header: "Syllabus",
              render: (e) => (
                <span className="text-xs text-slate-500">
                  {hasContent(e.syllabus) ? "On file" : "—"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (e) => {
                const ref = rowRefFor(e.record);
                return (
                  <RowCrudActions
                    noun="exam"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(e.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(e.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["name", "conducting_authority", "exam_type"]}
          searchPlaceholder="Search exams..."
          emptyState="No exams match this filter."
        />
      )}

      <CatalogDialog
        open={crud.dialog !== null}
        title={title}
        mode={crud.dialog?.mode ?? "create"}
        loading={crud.dialog?.mode === "update" && crud.values === null}
        formError={crud.formError}
        submitting={crud.submitting}
        onClose={crud.closeDialog}
        onSubmit={crud.submit}
        createLabel="Create exam"
      >
        {crud.values && (
          <ExamFormFields values={crud.values} onChange={crud.setValues} disabled={crud.submitting} />
        )}
      </CatalogDialog>
    </div>
  );
}

/**
 * Whether a JSON column the form does not edit actually holds something.
 *
 * Typed `unknown` on purpose: the schema says `dict | None` and the older
 * `ApiExam` claimed `string[]`, which the backend does not guarantee. A check that
 * handles every shape — empty object, empty array, empty string, null — is the
 * only honest way to render it.
 */
function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}
