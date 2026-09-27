"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { apiFetch } from "@/lib/api";
import type { ApiCourse } from "@/lib/api-server";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";
import { LEVELS, type CourseMetaLevel } from "@/components/admin/types";

/**
 * Reads the real course catalogue.
 *
 * The "Avg. Fees" and "Hot" columns are gone: both came from the bundled demo
 * dataset, which carried invented ₹ figures and a `hot` flag that no database
 * column backs. Duration and category are shown instead, with "—" when the
 * course record has no value.
 */
export function CoursesSection() {
  const [level, setLevel] = useState<CourseMetaLevel | "all">("all");
  const { data, error, loading } = useAdminResource<ApiCourse>(() =>
    apiFetch<ApiCourse[]>("/courses?limit=1000"),
  );

  const all = useMemo(
    () => (data ?? []).map((c) => ({ ...c, id: c.slug, name: c.name })),
    [data],
  );
  const rows = level === "all" ? all : all.filter((c) => c.degree === level);
  const counts = useMemo(() => {
    const by: Partial<Record<string, number>> = {};
    for (const c of all) if (c.degree) by[c.degree] = (by[c.degree] ?? 0) + 1;
    return by;
  }, [all]);

  return (
    <div>
      <SectionHeading
        title="Courses"
        description="Manage the degree & diploma catalog"
        count={all.length}
        action={<AddButton label="Add course" />}
      />
      <div className="mb-4">
        <FilterChips
          options={LEVELS}
          value={level}
          onChange={setLevel}
          counts={counts as Partial<Record<CourseMetaLevel | "all", number>>}
        />
      </div>
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading courses…</p>
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Course", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
            { key: "degree", header: "Level", render: (c) => (c.degree ? <Badge variant="purple">{c.degree}</Badge> : "—") },
            { key: "category", header: "Category", render: (c) => c.category ?? "—" },
            { key: "duration", header: "Duration", render: (c) => c.duration ?? "—" },
            { key: "is_active", header: "Status", render: (c) => (c.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="course" /> },
          ]}
          rows={rows}
          searchKeys={["name", "category"]}
          searchPlaceholder="Search courses..."
        />
      )}
    </div>
  );
}
