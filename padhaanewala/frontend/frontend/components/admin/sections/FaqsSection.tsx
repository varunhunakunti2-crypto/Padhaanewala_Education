"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi } from "@/lib/api";
import type { ApiFaq } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions } from "@/components/admin/primitives";

/**
 * Reads the real FAQ table.
 *
 * This panel used to flatten `faqs` off the 10 invented colleges in the bundled
 * demo dataset, so it displayed Q&A pairs that were written for colleges which
 * never existed. It now reads `/faqs` and labels each row with the entity it
 * belongs to, because the API stores an `entity_type` / `entity_id` pair
 * instead of a resolved college name — guessing the college name from the id
 * would reintroduce exactly the kind of invention removed here.
 */
export function FaqsSection() {
  const { data, error, loading } = useAdminResource<ApiFaq>(() => adminApi.faqs() as Promise<ApiFaq[]>, {
    unreachableMessage: "Could not reach the FAQs API.",
  });
  const all = useMemo(
    () => (data ?? []).map((f) => ({ ...f, id: String(f.id), entity: `${f.entity_type} #${f.entity_id}` })),
    [data],
  );

  return (
    <div>
      <SectionHeading
        title="FAQ management"
        description="Curate college-specific answers"
        count={all.length}
        action={<AddButton label="Add FAQ" />}
      />
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading FAQs…</p>
      ) : (
        <DataTable
          columns={[
            { key: "entity", header: "Applies to", render: (f) => <Badge variant="purple">{f.entity}</Badge> },
            { key: "question", header: "Question" },
            { key: "is_active", header: "Status", render: (f) => (f.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Hidden</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (f) => <RowActions item={f.question} noun="FAQ" /> },
          ]}
          rows={all}
          searchKeys={["question", "entity"]}
          searchPlaceholder="Search FAQs..."
        />
      )}
    </div>
  );
}
