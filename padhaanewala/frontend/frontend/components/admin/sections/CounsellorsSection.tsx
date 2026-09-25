"use client";


import { DataTable } from "@/components/ui/DataTable";
import { initialsOf } from "@/lib/utils";

import { SectionHeading, AddButton, RowActions } from "@/components/admin/primitives";
import { SAMPLE_COUNSELLORS } from "@/components/admin/fixtures";

export function CounsellorsSection() {
  return (
    <div>
      <SectionHeading title="Counsellors" description="Track team performance and conversions" count={SAMPLE_COUNSELLORS.length} action={<AddButton label="Add counsellor" />} />
      <DataTable
          columns={[
            { key: "name", header: "Counsellor", render: (c) => (
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-50 text-xs font-bold text-purple-700">{initialsOf(c.name)}</span>
                <span className="font-semibold text-gray-900">{c.name}</span>
              </span>
            ) },
            { key: "region", header: "Region" },
            { key: "leads", header: "Leads" },
            { key: "converted", header: "Converted", render: (c) => <span className="font-semibold text-green-600">{c.converted}</span> },
            { key: "conversionRate", header: "Rate", render: (c) => `${Math.round((c.converted / c.leads) * 100)}%` },
            { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="counsellor" /> },
          ]}
          rows={SAMPLE_COUNSELLORS as unknown as { id: string; name: string; region: string; leads: number; converted: number; rating: number }[]}
          searchKeys={["name", "region"]}
          searchPlaceholder="Search counsellors..."
        />
    </div>
  );
}

/* ---------------------------------- Content & ops sections ---------------------------------- */
