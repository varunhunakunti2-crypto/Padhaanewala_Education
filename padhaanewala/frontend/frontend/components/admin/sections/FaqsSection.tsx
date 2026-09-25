"use client";


import { DataTable } from "@/components/ui/DataTable";
import { COLLEGES } from "@/lib/data";

import { SectionHeading, AddButton, RowActions } from "@/components/admin/primitives";

export function FaqsSection() {
  const faqs = COLLEGES.flatMap((c) => c.faqs.map((f) => ({ id: `${c.id}-${f.q.slice(0, 8)}`, college: c.shortName, q: f.q }))).slice(0, 10);
  return (
    <div>
      <SectionHeading title="FAQ management" description="Curate college-specific answers" count={faqs.length} action={<AddButton label="Add FAQ" />} />
      <DataTable
          columns={[
            { key: "college", header: "College" },
            { key: "q", header: "Question" },
            { key: "actions", header: "", className: "text-right", render: (f) => <RowActions item={f.q} noun="FAQ" /> },
          ]}
          rows={faqs as { id: string; college: string; q: string }[]}
          searchKeys={["q", "college"]}
          searchPlaceholder="Search FAQs..."
        />
    </div>
  );
}
