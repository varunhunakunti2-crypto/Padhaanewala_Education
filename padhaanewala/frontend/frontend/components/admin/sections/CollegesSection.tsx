"use client";


import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { COLLEGES } from "@/lib/data";
import { formatCount } from "@/lib/utils";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

export function CollegesSection() {
  const [sector, setSector] = useState<"Government" | "Private" | "all">("all");
  const rows = sector === "all" ? COLLEGES : COLLEGES.filter((c) => c.sector === sector);
  return (
    <div>
      <SectionHeading title="Colleges" description="Manage institution profiles, ratings and placement data" count={rows.length} action={<AddButton label="Add college" />} />
      <div className="mb-4">
        <FilterChips
          options={["Government", "Private"] as const}
          value={sector}
          onChange={setSector}
          counts={{ Government: COLLEGES.filter((c) => c.sector === "Government").length, Private: COLLEGES.filter((c) => c.sector === "Private").length } as Partial<Record<"Government" | "Private" | "all", number>>}
        />
      </div>
      <DataTable
          columns={[
            { key: "shortName", header: "College", render: (c) => <span className="font-semibold text-gray-900">{c.shortName}</span> },
            { key: "city", header: "Location", render: (c) => `${c.city}, ${c.state}` },
            { key: "sector", header: "Type", render: (c) => <Badge variant={c.sector === "Government" ? "blue" : "orange"}>{c.sector}</Badge> },
            { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
            { key: "placementRate", header: "Placement", render: (c) => `${c.placement.placementRate}%` },
            { key: "reviewCount", header: "Reviews", render: (c) => formatCount(c.reviewCount) },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.shortName} noun="college" /> },
          ]}
          rows={rows}
          searchKeys={["name", "shortName", "city", "state"]}
          searchPlaceholder="Search colleges..."
        />
    </div>
  );
}
