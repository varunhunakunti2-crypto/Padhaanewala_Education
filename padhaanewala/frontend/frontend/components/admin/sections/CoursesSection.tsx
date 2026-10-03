"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminCourse } from "@/lib/api";
import {
  EMPTY_COURSE_FORM,
  buildCoursePayload,
  courseFormFromDetail,
  courseRefFor,
  type CourseFormValues,
} from "@/lib/course-form";

import { SectionHeading, FilterChips } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { CourseFormFields } from "@/components/admin/sections/CourseForm";
import { LEVELS, type CourseMetaLevel } from "@/components/admin/types";

/** `DataTable` needs a string `id`; the API's is a number. */
interface CourseRow extends Omit<AdminCourse, "id"> {
  id: string;
  record: AdminCourse;
}

/**
 * Courses, with create / edit / delete against the real catalogue API.
 *
 * Three live-contract bugs this table had, all of them invisible until the
 * response arrived:
 *
 *  1. **`limit=1000` against a route that caps at 100.** A 422 here is
 *     indistinguishable from an unreachable server, so the panel rendered
 *     "Could not reach the courses API" on every load and read as a backend
 *     outage. `adminApi.courses()` walks the offsets at a page size held against
 *     the real `le=` bound.
 *  2. **A Status column reading a field the response does not carry.**
 *     `CourseResponse` has no `is_active` at all, so `c.is_active` was always
 *     `undefined` and every course in the catalogue rendered as "Inactive". The
 *     column is gone rather than left to lie — see `lib/course-form.ts` for why
 *     the toggle is not offered anywhere instead.
 *  3. **`RowActions` was a toast.** View, Edit and Delete on every row, none of
 *     which touched anything.
 *
 * The edit dialog fetches `GET /courses/{ref}` rather than prefilling from the
 * row, because `CourseResponse` carries none of `overview`, `eligibility` or
 * `career_information` — all three of which this form edits. Prefilling from the
 * list row would render three empty boxes over real content and then null all
 * three on save.
 */
export function CoursesSection() {
  const [level, setLevel] = useState<CourseMetaLevel | "all">("all");

  const crud = useCatalogCrud<AdminCourse, CourseFormValues>({
    noun: "course",
    entity: "course",
    load: () => adminApi.courses(),
    unreachableMessage: "Could not reach the courses API.",
    emptyValues: EMPTY_COURSE_FORM,
    loadDetail: (row) => adminApi.course(row.id).then(courseFormFromDetail),
    refFor: courseRefFor,
    labelFor: (c) => c.name,
    build: buildCoursePayload,
    create: async (p) => adminApi.createCourse(p),
    update: async (ref, p) => adminApi.updateCourse(ref, p),
    remove: (ref) => adminApi.deleteCourse(ref),
  });

  const all = useMemo<CourseRow[]>(
    () =>
      crud.rows.map((c) => {
        const { id, ...rest } = c;
        return { ...rest, id: String(id), record: c };
      }),
    [crud.rows],
  );

  const rows = level === "all" ? all : all.filter((c) => c.degree === level);
  // Keyed by string, not by `CourseMetaLevel`: `Course.degree` is a free-text
  // `String(100)` column, so a level the union has never heard of is a real
  // possibility and must still be counted rather than dropped.
  const counts = useMemo(() => {
    const by: Partial<Record<string, number>> = {};
    for (const c of all) if (c.degree) by[c.degree] = (by[c.degree] ?? 0) + 1;
    return by;
  }, [all]);

  const title =
    crud.dialog === null
      ? "Course"
      : crud.dialog.mode === "create"
        ? "Add course"
        : `Edit ${crud.dialog.label}`;

  return (
    <div>
      <SectionHeading
        title="Courses"
        description="Manage the degree & diploma catalog"
        count={rows.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> Add course
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterChips
          options={LEVELS}
          value={level}
          onChange={setLevel}
          counts={counts as Partial<Record<CourseMetaLevel | "all", number>>}        />
      </div>

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading courses…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "name",
              header: "Course",
              render: (c) => <span className="font-semibold text-gray-900">{c.name}</span>,
            },
            { key: "degree", header: "Level", render: (c) => (c.degree ? <Badge variant="purple">{c.degree}</Badge> : "—") },
            { key: "category", header: "Category", render: (c) => c.category ?? "—" },
            { key: "duration", header: "Duration", render: (c) => c.duration ?? "—" },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (c) => {
                const ref = courseRefFor(c.record);
                return (
                  <RowCrudActions
                    noun="course"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(c.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(c.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["name", "category", "degree"]}
          searchPlaceholder="Search courses..."
          emptyState="No courses match this filter."
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
        createLabel="Create course"
      >
        {crud.values && (
          <CourseFormFields values={crud.values} onChange={crud.setValues} disabled={crud.submitting} />
        )}
      </CatalogDialog>
    </div>
  );
}
