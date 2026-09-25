"use client";


import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

export function ScholarshipsSection() {
  const [filter, setFilter] = useState<"Yes" | "No" | "all">("all");
  const all = SCHOLARSHIPS.map((s) => ({ ...s, id: s.name }));
  const rows = filter === "all" ? all : all.filter((s) => (s.renewable === (filter === "Yes")));
  return (
    <div>
      <SectionHeading title="Scholarships" description="Administer schemes, amounts and deadlines" count={SCHOLARSHIPS.length} action={<AddButton label="Add scholarship" />} />
      <div className="mb-4">
        <FilterChips
          options={["Yes", "No"] as const}
          value={filter}
          onChange={setFilter}
          counts={{ Yes: SCHOLARSHIPS.filter((s) => s.renewable).length, No: SCHOLARSHIPS.filter((s) => !s.renewable).length } as Partial<Record<"Yes" | "No" | "all", number>>}
        />
      </div>
      <DataTable
          columns={[
            { key: "name", header: "Scholarship", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
            { key: "provider", header: "Provider" },
            { key: "amount", header: "Amount", render: (s) => <span className="font-semibold text-green-600">{s.amount}</span> },
            { key: "deadline", header: "Deadline" },
            { key: "renewable", header: "Renewable", render: (s) => (s.renewable ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (s) => <RowActions item={s.name} noun="scholarship" /> },
          ]}
          rows={rows}
          searchKeys={["name", "provider"]}
          searchPlaceholder="Search scholarships..."
        />
    </div>
  );
}
