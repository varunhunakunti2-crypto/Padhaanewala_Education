"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminFaq } from "@/lib/api";
import { entityTypeLabel } from "@/lib/entity-options";
import {
  EMPTY_FAQ_FORM,
  buildFaqPayload,
  faqFormFromDetail,
  faqIdFor,
  type FaqFormValues,
} from "@/lib/faq-form";

import { SectionHeading } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { FaqFormFields } from "@/components/admin/sections/FaqForm";

interface FaqRow extends Omit<AdminFaq, "id"> {
  id: string;
  record: AdminFaq;
  /** `entity_type` and `entity_id` rendered as one readable label. */
  entity: string;
}

/**
 * FAQs, with create / edit / delete against the real API.
 *
 * ## Why the attachment is shown as a label rather than a name
 *
 * The API stores an `entity_type` string beside an `entity_id` integer, with no
 * foreign key to anything. `entityTypeLabel` therefore renders the stored type
 * through the picker's own label list and falls back to the raw value for a type
 * this build has never seen — an FAQ written before this panel existed must still
 * show *something*, and a blank would make a real record look unattached while
 * hiding it from a search for the thing it belongs to.
 *
 * Resolving the id to a real college name would need a lookup per distinct
 * `(type, id)` pair across every row, and would be a guess for any type with no
 * matching list. The old panel correctly refused to guess and this one does not
 * start.
 *
 * ## `/faqs` is paged and the count was lying
 *
 * The list call used to be a single unpaged-looking request that returned one
 * page. `adminApi.faqs()` walks the offsets, so the count in the heading is the
 * number of rows on the page.
 *
 * ## Delete is the one place a content manager has the higher gate
 *
 * Every other catalogue table gates `DELETE` on `ADMIN_ROLES`; `/faqs` alone
 * accepts `CONTENT_ROLES`. `CATALOG_DELETE_ROLES` holds that asymmetry and
 * `useCatalogCrud` reads it, so this panel shows a Delete button to a content
 * manager where the other four do not.
 *
 * ## The Status column was structurally always "Active"
 *
 * `list_faqs` filtered `where(FAQ.is_active)` unconditionally, so a hidden FAQ
 * appeared in no list — and because the edit dialog loads its record through
 * `GET /faqs/{id}`, which also 404'd on an inactive row, it could not be reopened
 * either. Hiding a FAQ therefore removed it from the admin console with no way
 * back short of creating a replacement, while this column kept rendering a
 * two-state badge whose "Hidden" branch was unreachable.
 *
 * Both endpoints now take `include_inactive`, gated on `CONTENT_ROLES` the same
 * way `routers/banners.py` does it, and `adminApi.faqs()` / `adminApi.faq()`
 * pass it. The gate matters: `include_inactive` was the exact shape of the
 * original Phase 1.3 finding on `banners`, where an unguarded flag published
 * draft content to anonymous callers.
 */
export function FaqsSection() {
  const crud = useCatalogCrud<AdminFaq, FaqFormValues>({
    noun: "FAQ",
    entity: "faq",
    load: () => adminApi.faqs(),
    unreachableMessage: "Could not reach the FAQs API.",
    emptyValues: EMPTY_FAQ_FORM,
    loadDetail: (row) => adminApi.faq(row.id).then(faqFormFromDetail),
    refFor: faqIdFor,
    labelFor: (f) => f.question,
    build: buildFaqPayload,
    // `FAQ` has no `name` column either; the toast shows the question.
    create: async (p) => ({ name: (await adminApi.createFaq(p)).question }),
    update: async (id, p) => ({ name: (await adminApi.updateFaq(Number(id), p)).question }),
    remove: (id) => adminApi.deleteFaq(Number(id)),
  });

  const all = useMemo<FaqRow[]>(
    () =>
      crud.rows.map((f) => {
        const { id, ...rest } = f;
        return {
          ...rest,
          id: String(id),
          record: f,
          entity: `${entityTypeLabel(f.entity_type)} #${f.entity_id}`,
        };
      }),
    [crud.rows],
  );

  const title =
    crud.dialog === null
      ? "FAQ"
      : crud.dialog.mode === "create"
        ? "Add FAQ"
        : "Edit FAQ";

  return (
    <div>
      <SectionHeading
        title="FAQ management"
        description="Curate record-specific answers"
        count={all.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> Add FAQ
            </Button>
          ) : undefined
        }
      />

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading FAQs…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "entity",
              header: "Applies to",
              render: (f) => <Badge variant="purple">{f.entity}</Badge>,
            },
            { key: "question", header: "Question" },
            { key: "display_order", header: "Order" },
            {
              key: "is_active",
              header: "Status",
              render: (f) => (f.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Hidden</Badge>),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (f) => {
                const ref = faqIdFor(f.record);
                return (
                  <RowCrudActions
                    noun="FAQ"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(f.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(f.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={all}
          searchKeys={["question", "entity"]}
          searchPlaceholder="Search FAQs..."
          emptyState="No FAQs yet."
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
        createLabel="Create FAQ"
      >
        {crud.values && (
          <FaqFormFields
            values={crud.values}
            onChange={crud.setValues}
            mode={crud.dialog?.mode ?? "create"}
            disabled={crud.submitting}
          />
        )}
      </CatalogDialog>
    </div>
  );
}
