"use client";


import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { MOCK_TESTS } from "@/lib/data/mockTests";
import { formatCount } from "@/lib/utils";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

export function MockTestsSection() {
  const [difficulty, setDifficulty] = useState<string | "all">("all");
  const all = MOCK_TESTS.map((t) => ({ ...t, id: t.slug }));
  const rows = difficulty === "all" ? all : all.filter((t) => t.difficulty === difficulty);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const t of MOCK_TESTS) by[t.difficulty] = (by[t.difficulty] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Mock test library" description="Publish and manage practice tests" count={MOCK_TESTS.length} action={<AddButton label="Add test" />} />
      <div className="mb-4">
        <FilterChips options={Object.keys(counts) as readonly string[]} value={difficulty} onChange={setDifficulty} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "title", header: "Test", render: (t) => <span className="font-semibold text-gray-900">{t.title}</span> },
            { key: "exam", header: "Exam", render: (t) => <Badge variant="purple">{t.exam}</Badge> },
            { key: "difficulty", header: "Difficulty", render: (t) => <Badge variant={t.difficulty === "Easy" ? "green" : t.difficulty === "Medium" ? "yellow" : "red"}>{t.difficulty}</Badge> },
            { key: "questionCount", header: "Questions" },
            { key: "attempts", header: "Attempts", render: (t) => formatCount(t.attempts) },
            { key: "actions", header: "", className: "text-right", render: (t) => <RowActions item={t.title} noun="test" /> },
          ]}
          rows={rows}
          searchKeys={["title", "exam"]}
          searchPlaceholder="Search tests..."
        />
    </div>
  );
}
