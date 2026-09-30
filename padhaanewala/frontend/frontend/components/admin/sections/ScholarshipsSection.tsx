"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { apiFetch } from "@/lib/api";
import type { ApiScholarship } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

/**
 * Reads the real scholarship records.
 *
 * The "Renewable" column is gone: it was a boolean in the bundled demo schemes
 * with no matching database column, and there is no renewable flag on the API
 * response — so filtering on it would have been filtering on a fiction.
 * `amount` is shown only when the record has one; a scheme with an unrecorded
 * amount renders "—" rather than ₹0.
 */
export function ScholarshipsSection() {
  const [filter, setFilter] = useState<"Active" | "Inactive" | "all">("all");
  const { data, error, loading } = useAdminResource<ApiScholarship>(() =>
    apiFetch<ApiScholarship[]>("/scholarships?limit=200"),
  );

  const all = useMemo(() => (data ?? []).map((s) => ({ ...s, id: s.slug })), [data]);
  const rows = filter === "all" ? all : all.filter((s) => s.is_active === (filter === "Active"));
  const activeCount = all.filter((s) => s.is_active).length;

  return (
    <div>
      <SectionHeading
        title="Scholarships"
        description="Administer schemes, amounts and deadlines"
        count={all.length}
        action={<AddButton label="Add scholarship" />}
      />
      <div className="mb-4">
        <FilterChips
          options={["Active", "Inactive"] as const}
          value={filter}
          onChange={setFilter}
          counts={
            { Active: activeCount, Inactive: all.length - activeCount } as Partial<
              Record<"Active" | "Inactive" | "all", number>
            >
          }
        />
      </div>
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading scholarships…</p>
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Scholarship", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
            { key: "provider", header: "Provider", render: (s) => s.provider ?? "—" },
            { key: "amount", header: "Amount", render: (s) => (s.amount ? <span className="font-semibold text-green-600">{s.amount}</span> : "—") },
            { key: "application_deadline", header: "Deadline", render: (s) => s.application_deadline ?? "—" },
            { key: "state_name", header: "State", render: (s) => s.state_name ?? "—" },
            { key: "is_active", header: "Status", render: (s) => (s.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (s) => <RowActions item={s.name} noun="scholarship" /> },
          ]}
          rows={rows}
          searchKeys={["name", "provider", "state_name"]}
          searchPlaceholder="Search scholarships..."
        />
      )}
    </div>
  );
}
