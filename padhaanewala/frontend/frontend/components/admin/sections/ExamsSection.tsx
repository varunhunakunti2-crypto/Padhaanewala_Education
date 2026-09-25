"use client";


import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EXAMS } from "@/lib/data/exams";

const EXAM_TYPES = Array.from(new Set(EXAMS.map((e) => e.type))).sort() as string[];

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

export function ExamsSection() {
  const [type, setType] = useState<string | "all">("all");
  const all = EXAMS.map((e) => ({ ...e, id: e.slug }));
  const rows = type === "all" ? all : all.filter((e) => e.type === type);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const e of EXAMS) by[e.type] = (by[e.type] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Examinations" description="Manage entrance exams, stages and dates" count={EXAMS.length} action={<AddButton label="Add exam" />} />
      <div className="mb-4">
        <FilterChips options={EXAM_TYPES as readonly string[]} value={type} onChange={setType} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "shortName", header: "Exam", render: (e) => <Link href={`/exams/${e.slug}`} className="font-semibold text-purple-700 hover:underline">{e.shortName}</Link> },
            { key: "type", header: "Type" },
            { key: "level", header: "Level" },
            { key: "stage", header: "Stage", render: (e) => <Badge variant={e.stage === "Registration Open" ? "green" : e.stage === "Results Declared" ? "gray" : "yellow"}>{e.stage}</Badge> },
            { key: "duration", header: "Duration" },
            { key: "actions", header: "", className: "text-right", render: (e) => <RowActions item={e.shortName} noun="exam" /> },
          ]}
          rows={rows}
          searchKeys={["name", "shortName"]}
          searchPlaceholder="Search exams..."
        />
    </div>
  );
}
