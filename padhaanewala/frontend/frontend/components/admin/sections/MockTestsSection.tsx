"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi } from "@/lib/api";
import type { ApiMockTest } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

/**
 * Reads the real mock-test table (admin-only endpoint).
 *
 * The "Attempts" column counted a number invented in the bundled demo tests —
 * there is no attempt counter in the database, so it is gone. What the record
 * actually stores is shown instead: question count, duration and total marks.
 */
export function MockTestsSection() {
  const [difficulty, setDifficulty] = useState<string | "all">("all");
  const { data, error, loading } = useAdminResource<ApiMockTest>(
    () => adminApi.mockTests() as Promise<ApiMockTest[]>,
    { unreachableMessage: "Could not reach the mock tests API." },
  );

  const all = useMemo(() => (data ?? []).map((t) => ({ ...t, id: t.slug })), [data]);
  const rows = difficulty === "all" ? all : all.filter((t) => t.difficulty === difficulty);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const t of all) if (t.difficulty) by[t.difficulty] = (by[t.difficulty] ?? 0) + 1;
    return by;
  }, [all]);

  return (
    <div>
      <SectionHeading
        title="Mock test library"
        description="Publish and manage practice tests"
        count={all.length}
        action={<AddButton label="Add test" />}
      />
      {Object.keys(counts).length > 0 ? (
        <div className="mb-4">
          <FilterChips
            options={Object.keys(counts) as readonly string[]}
            value={difficulty}
            onChange={setDifficulty}
            counts={{ ...counts } as Partial<Record<string, number>>}
          />
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading tests…</p>
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Test", render: (t) => <span className="font-semibold text-gray-900">{t.name}</span> },
            { key: "exam_name", header: "Exam", render: (t) => (t.exam_name ? <Badge variant="purple">{t.exam_name}</Badge> : "—") },
            { key: "difficulty", header: "Difficulty", render: (t) => (t.difficulty ? <Badge variant={t.difficulty === "Easy" ? "green" : t.difficulty === "Medium" ? "yellow" : "red"}>{t.difficulty}</Badge> : "—") },
            { key: "question_count", header: "Questions" },
            { key: "duration_minutes", header: "Duration", render: (t) => (t.duration_minutes ? `${t.duration_minutes} min` : "—") },
            { key: "total_marks", header: "Marks", render: (t) => t.total_marks ?? "—" },
            { key: "is_active", header: "Status", render: (t) => (t.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (t) => <RowActions item={t.name} noun="test" /> },
          ]}
          rows={rows}
          searchKeys={["name", "exam_name"]}
          searchPlaceholder="Search tests..."
        />
      )}
    </div>
  );
}
