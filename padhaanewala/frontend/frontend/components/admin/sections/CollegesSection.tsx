"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { apiFetch } from "@/lib/api";
import type { ApiCollegeListItem } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, RowActions, FilterChips } from "@/components/admin/primitives";

/**
 * Reads the real catalogue.
 *
 * This table used to render `COLLEGES` from the bundled demo dataset — 10
 * invented colleges with invented ratings, placement rates and review counts.
 * That array is now empty, so the table reads `/colleges` instead and shows only
 * fields the backend actually stores. Ratings come back as a string (or "N/A")
 * because no college has review data yet; cells with no value render as "—"
 * rather than a zero.
 */
export function CollegesSection() {
  const [sector, setSector] = useState<"Government" | "Private" | "all">("all");
  const { data, error, loading } = useAdminResource<ApiCollegeListItem>(
    () => apiFetch<ApiCollegeListItem[]>("/colleges?limit=1000"),
    { unreachableMessage: "Could not reach the colleges API." },
  );

  const all = (data ?? []).map((c) => ({ ...c, id: c.college_id }));
  const rows = sector === "all" ? all : all.filter((c) => c.ownership === sector);
  const government = all.filter((c) => c.ownership === "Government").length;

  return (
    <div>
      <SectionHeading
        title="Colleges"
        description="Institution records loaded from the catalogue API"
        count={rows.length}
      />
      <div className="mb-4">
        <FilterChips
          options={["Government", "Private"] as const}
          value={sector}
          onChange={setSector}
          counts={
            { Government: government, Private: all.length - government } as Partial<
              Record<"Government" | "Private" | "all", number>
            >
          }
        />
      </div>
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading colleges…</p>
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "College", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
            { key: "college_id", header: "Code", render: (c) => <span className="text-slate-500">{c.college_id}</span> },
            { key: "city", header: "Location", render: (c) => (c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : "—") },
            {
              key: "ownership",
              header: "Type",
              render: (c) =>
                c.ownership ? (
                  <Badge variant={c.ownership === "Government" ? "blue" : "orange"}>{c.ownership}</Badge>
                ) : (
                  "—"
                ),
            },
            { key: "college_type", header: "Institution", render: (c) => c.college_type ?? "—" },
            { key: "university_name", header: "University", render: (c) => c.university_name ?? "—" },
            { key: "has_hostel", header: "Hostel", render: (c) => (c.has_hostel == null ? "—" : c.has_hostel ? "Yes" : "No") },
            {
              key: "average_rating",
              header: "Rating",
              render: (c) => (c.total_reviews > 0 ? `${c.average_rating} ★ (${c.total_reviews})` : "—"),
            },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="college" /> },
          ]}
          rows={rows}
          searchKeys={["name", "college_id", "city", "university_name"]}
          searchPlaceholder="Search colleges..."
        />
      )}
    </div>
  );
}
