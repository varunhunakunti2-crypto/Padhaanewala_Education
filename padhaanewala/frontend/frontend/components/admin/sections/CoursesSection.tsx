"use client";


import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { COURSES } from "@/lib/data/courses";
import { formatINR } from "@/lib/utils";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";
import { LEVELS, type CourseMetaLevel } from "@/components/admin/types";

export function CoursesSection() {
  const [level, setLevel] = useState<CourseMetaLevel | "all">("all");
  const rows = level === "all" ? COURSES.map((c) => ({ ...c, id: c.slug })) : COURSES.filter((c) => c.level === level).map((c) => ({ ...c, id: c.slug }));
  const counts = useMemo(() => {
    const by: Partial<Record<CourseMetaLevel, number>> = {};
    for (const c of COURSES) by[c.level] = (by[c.level] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Courses" description="Manage the degree & diploma catalog" count={COURSES.length} action={<AddButton label="Add course" />} />
      <div className="mb-4">
        <FilterChips options={LEVELS} value={level} onChange={setLevel} counts={{ ...counts } as Partial<Record<CourseMetaLevel | "all", number>>} />
      </div>
      <DataTable
          columns={[
            { key: "name", header: "Course", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
            { key: "level", header: "Level", render: (c) => <Badge variant="purple">{c.level}</Badge> },
            { key: "duration", header: "Duration" },
            { key: "avgFeeYear", header: "Avg. Fees", render: (c) => formatINR(c.avgFeeYear) },
            { key: "hot", header: "Status", render: (c) => (c.hot ? <Badge variant="green">Hot</Badge> : <Badge variant="gray">Standard</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="course" /> },
          ]}
          rows={rows}
          searchKeys={["name"]}
          searchPlaceholder="Search courses..."
        />
    </div>
  );
}
