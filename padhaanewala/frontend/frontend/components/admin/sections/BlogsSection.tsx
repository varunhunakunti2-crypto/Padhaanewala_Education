"use client";


import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { BLOG_POSTS } from "@/lib/data/blog";

import { SectionHeading, AddButton, RowActions } from "@/components/admin/primitives";

export function BlogsSection() {
  const all = BLOG_POSTS.map((p) => ({ ...p, id: p.slug }));
  return (
    <div>
      <SectionHeading title="Published articles" description="Write, schedule and feature content" count={BLOG_POSTS.length} action={<AddButton label="New article" />} />
      <DataTable
          columns={[
            { key: "title", header: "Article", render: (p) => <span className="font-semibold text-gray-900">{p.title}</span> },
            { key: "category", header: "Category", render: (p) => <Badge variant="purple">{p.category}</Badge> },
            { key: "author", header: "Author" },
            { key: "readTime", header: "Read time" },
            { key: "featured", header: "Featured", render: (p) => (p.featured ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (p) => <RowActions item={p.title} noun="article" /> },
          ]}
          rows={all}
          searchKeys={["title", "author", "category"]}
          searchPlaceholder="Search articles..."
        />
    </div>
  );
}
