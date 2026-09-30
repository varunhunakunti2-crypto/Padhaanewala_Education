"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminBlog } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton, RowActions } from "@/components/admin/primitives";

/**
 * Reads the real blog table (admin-only endpoint).
 *
 * The "Read time" column was derived from the bundled demo posts' word counts;
 * the database stores no such field, so it is gone. `view_count` is a real
 * column, so it is shown in its place.
 */
export function BlogsSection() {
  const { data, error, loading } = useAdminResource<AdminBlog>(() => adminApi.blogs(), {
    unreachableMessage: "Could not reach the blogs API.",
  });
  const all = useMemo(() => (data ?? []).map((p) => ({ ...p, id: p.slug })), [data]);

  return (
    <div>
      <SectionHeading
        title="Published articles"
        description="Write, schedule and feature content"
        count={all.length}
        action={<AddButton label="New article" />}
      />
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading articles…</p>
      ) : (
        <DataTable
          columns={[
            { key: "title", header: "Article", render: (p) => <span className="font-semibold text-gray-900">{p.title}</span> },
            { key: "category_name", header: "Category", render: (p) => (p.category_name ? <Badge variant="purple">{p.category_name}</Badge> : "—") },
            { key: "published_at", header: "Published", render: (p) => p.published_at ?? "—" },
            { key: "view_count", header: "Views" },
            { key: "actions", header: "", className: "text-right", render: (p) => <RowActions item={p.title} noun="article" /> },
          ]}
          rows={all}
          searchKeys={["title", "category_name", "status"]}
          searchPlaceholder="Search articles..."
        />
      )}
    </div>
  );
}
