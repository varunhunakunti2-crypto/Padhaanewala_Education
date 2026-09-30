"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminScholarship, type AdminState } from "@/lib/api";
import {
  EMPTY_SCHOLARSHIP_FORM,
  buildScholarshipPayload,
  scholarshipFormFromDetail,
  scholarshipRefFor,
  type ScholarshipFormValues,
} from "@/lib/scholarship-form";

import { SectionHeading, FilterChips } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { ScholarshipFormFields } from "@/components/admin/sections/ScholarshipForm";

interface ScholarshipRow extends Omit<AdminScholarship, "id"> {
  id: string;
  record: AdminScholarship;
}

/**
 * Scholarships, with create / edit / delete against the real API.
 *
 * The old panel asked for `limit=200` against a route that caps `limit` at 100, so
 * every load was a 422 — which `useAdminResource` renders as "Could not reach
 * the API", indistinguishable from a server outage. `adminApi.scholarships()`
 * walks the offsets instead.
 *
 * ## The Active / Inactive filter is gone, and that is the point
 *
 * It read `is_active` off the list response and offered a filter between active
 * and inactive rows. `list_scholarships` and `get_scholarship` both filter
 * `where(Scholarship.is_active)`, so the response can only ever contain active
 * rows: the "Inactive" count was always 0 and the chip was a filter onto nothing.
 *
 * Worse, a filter that *looked* like it would show hidden schemes invites an
 * admin to conclude that a scheme is live when it is not listed. So the chips are
 * replaced by one that can only be true of the data actually present.
 *
 * ## The states list is loaded when the dialog opens
 *
 * `state_id` is a real foreign key and `ScholarshipResponse` resolves it to
 * `state_name`, so the filter reads the resolved name while the form needs the
 * raw ids. The lookup is a separate request from the table's, and only happens
 * when a form is actually on screen.
 */
type OwnershipFilter = "all" | "government" | "private" | "trust" | "institutional";

export function ScholarshipsSection() {
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");

  const crud = useCatalogCrud<AdminScholarship, ScholarshipFormValues>({
    noun: "scholarship",
    entity: "scholarship",
    load: () => adminApi.scholarships(),
    unreachableMessage: "Could not reach the scholarships API.",
    emptyValues: EMPTY_SCHOLARSHIP_FORM,
    loadDetail: (row) => adminApi.scholarship(row.id).then(scholarshipFormFromDetail),
    refFor: scholarshipRefFor,
    labelFor: (s) => s.name,
    build: buildScholarshipPayload,
    create: async (p) => adminApi.createScholarship(p),
    update: async (ref, p) => adminApi.updateScholarship(ref, p),
    remove: (ref) => adminApi.deleteScholarship(ref),
  });

  const [states, setStates] = useState<AdminState[] | null>(null);
  const [statesError, setStatesError] = useState<string | null>(null);

  // Only when a form is on screen: the table itself shows `state_name`, which the
  // list response already resolves.
  useEffect(() => {
    if (crud.dialog === null || states !== null) return;
    let ignore = false;
    adminApi
      .states()
      .then((rows) => {
        if (ignore) return;
        setStates(rows);
      })
      .catch(() => {
        if (ignore) return;
        // Swallowing this would present an empty dropdown as "there are no
        // states". The form stays usable: `state_id` is nullable.
        setStatesError("The state list could not be loaded.");
        setStates([]);
      });
    return () => {
      ignore = true;
    };
  }, [crud.dialog, states]);

  const all = useMemo<ScholarshipRow[]>(
    () =>
      crud.rows.map((s) => {
        const { id, ...rest } = s;
        return { ...rest, id: String(id), record: s };
      }),
    [crud.rows],
  );

  const rows =
    ownership === "all" ? all : all.filter((s) => s.ownership === ownership);

  // Counted from the rows actually present, so a chip can never show a category
  // the API is structurally unable to return.
  const counts = useMemo(() => {
    const by: Partial<Record<OwnershipFilter, number>> = {};
    for (const s of all) {
      const key = s.ownership as OwnershipFilter;
      if (key !== "all") by[key] = (by[key] ?? 0) + 1;
    }
    return by;
  }, [all]);

  const title =
    crud.dialog === null
      ? "Scholarship"
      : crud.dialog.mode === "create"
        ? "Add scholarship"
        : `Edit ${crud.dialog.label}`;

  return (
    <div>
      <SectionHeading
        title="Scholarships"
        description="Administer schemes, amounts and deadlines"
        count={rows.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> Add scholarship
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterChips
          options={["government", "private", "trust", "institutional"] as const}
          value={ownership}
          onChange={setOwnership}
          counts={counts}
        />
      </div>

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading scholarships…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "name",
              header: "Scholarship",
              render: (s) => <span className="font-semibold text-gray-900">{s.name}</span>,
            },
            { key: "provider", header: "Provider", render: (s) => s.provider ?? "—" },
            {
              key: "amount",
              header: "Amount",
              // A `String(255)`, not a number. See `lib/scholarship-form.ts`.
              render: (s) =>
                s.amount ? <span className="font-semibold text-green-600">{s.amount}</span> : "—",
            },
            {
              key: "application_deadline",
              header: "Deadline",
              render: (s) => s.application_deadline?.slice(0, 10) ?? "—",
            },
            { key: "state_name", header: "State", render: (s) => s.state_name ?? "—" },
            {
              key: "verification_status",
              header: "Verified",
              render: (s) =>
                s.verification_status ? (
                  <Badge variant={s.verification_status === "verified" ? "green" : "gray"}>
                    {s.verification_status}
                  </Badge>
                ) : (
                  "—"
                ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (s) => {
                const ref = scholarshipRefFor(s.record);
                return (
                  <RowCrudActions
                    noun="scholarship"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(s.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(s.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["name", "provider", "state_name", "course"]}
          searchPlaceholder="Search scholarships..."
          emptyState="No scholarships match this filter."
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
        createLabel="Create scholarship"
      >
        {crud.values && (
          <>
            {statesError && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {statesError} The state field is optional and everything else on this
                form still works.
              </p>
            )}
            <ScholarshipFormFields
              values={crud.values}
              onChange={crud.setValues}
              states={states ?? []}
              statesLoading={states === null}
              disabled={crud.submitting}
            />
          </>
        )}
      </CatalogDialog>
    </div>
  );
}
