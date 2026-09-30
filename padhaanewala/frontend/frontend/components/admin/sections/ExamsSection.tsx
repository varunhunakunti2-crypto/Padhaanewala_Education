"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { apiFetch } from "@/lib/api";
import type { ApiExam } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";

/**
 * Reads the real exam records.
 *
 * The "Stage" column (a derived "Registration Open" / "Results Declared" badge)
 * and the "Duration" column came from the bundled demo exams. The API does not
 * store a stage, and no duration field exists on the exam record, so both are
 * replaced by the dates the database actually holds. Missing dates render "—".
 */
export function ExamsSection() {
  const [type, setType] = useState<string | "all">("all");
  const { data, error, loading } = useAdminResource<ApiExam>(() =>
    apiFetch<ApiExam[]>("/exams?limit=200"),
  );

  const all = useMemo(() => (data ?? []).map((e) => ({ ...e, id: e.slug })), [data]);
  const examTypes = useMemo(
    () => Array.from(new Set(all.map((e) => e.exam_type).filter((t): t is string => !!t))).sort(),
    [all],
  );
  const rows = type === "all" ? all : all.filter((e) => e.exam_type === type);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const e of all) if (e.exam_type) by[e.exam_type] = (by[e.exam_type] ?? 0) + 1;
    return by;
  }, [all]);

  return (
    <div>
      <SectionHeading
        title="Examinations"
        description="Manage entrance exams and dates"
        count={all.length}
        action={<AddButton label="Add exam" />}
      />
      {examTypes.length > 0 ? (
        <div className="mb-4">
          <FilterChips
            options={examTypes as readonly string[]}
            value={type}
            onChange={setType}
            counts={{ ...counts } as Partial<Record<string, number>>}
          />
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading exams…</p>
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Exam", render: (e) => <Link href={`/exams/${e.slug}`} className="font-semibold text-purple-700 hover:underline">{e.name}</Link> },
            { key: "exam_type", header: "Type", render: (e) => e.exam_type ?? "—" },
            { key: "conducting_authority", header: "Authority", render: (e) => e.conducting_authority ?? "—" },
            { key: "application_deadline", header: "Apply by", render: (e) => e.application_deadline ?? "—" },
            { key: "exam_date", header: "Exam date", render: (e) => e.exam_date ?? "—" },
            { key: "result_date", header: "Result", render: (e) => e.result_date ?? "—" },
            { key: "is_active", header: "Status", render: (e) => (e.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (e) => <RowActions item={e.name} noun="exam" /> },
          ]}
          rows={rows}
          searchKeys={["name", "conducting_authority"]}
          searchPlaceholder="Search exams..."
        />
      )}
    </div>
  );
}
