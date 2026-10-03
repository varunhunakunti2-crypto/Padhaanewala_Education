"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi, type AdminBlogCategory, type AdminBlogDetail } from "@/lib/api";
import {
  BLOG_STATUSES,
  EMPTY_BLOG_FORM,
  blogFormFromRow,
  buildBlogPayload,
  blogRefFor,
  type BlogFormValues,
  type BlogStatus,
} from "@/lib/blog-form";

import { SectionHeading, FilterChips } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { BlogFormFields } from "@/components/admin/sections/BlogForm";

interface BlogRow extends Omit<AdminBlogDetail, "id"> {
  id: string;
  record: AdminBlogDetail;
}

/**
 * Articles, with create / edit / delete — and, for the first time, drafts.
 *
 * ## This panel could not previously see a draft at all
 *
 * `list_blogs` reads:
 *
 * ```python
 * is_content_user = user is not None and not get_current_user_roles(user).isdisjoint(CONTENT_ROLES)
 * if is_content_user and status:
 *     query = query.where(Blog.status == status)
 * else:
 *     query = query.where(Blog.status == "published")
 * ```
 *
 * so a request **without** a `status` parameter returns published posts only —
 * for a content manager as much as for anyone else. This panel called
 * `GET /blogs` with no parameters, which is why it was titled "Published
 * articles" and why every draft in the database was unreachable. Not merely
 * unlistable: `GET /blogs/{ref}` is the *public* read and also filters on
 * `status == "published"`, so a draft could not be opened for editing either, and
 * nothing could be done to one at all.
 *
 * `adminApi.blogs()` walks both statuses explicitly. The title says so.
 *
 * ## The edit form is prefilled from the table row, with no detail request
 *
 * This is the one panel that looks like it is missing a fetch, and it is not.
 * `GET /blogs/{ref}` is the public read and a draft is a 404, so a detail request
 * would make drafts permanently uneditable. `GET /blogs` returns `content` for
 * every row it returns, so the row already holds everything the form needs.
 * `useCatalogCrud` is given `valuesFromRow` and **no** `loadDetail`, which is
 * what selects this path.
 *
 * ## The slug is create-only
 *
 * `BlogUpdate` has no `slug`. A form that sent it would get a 200 and "Article
 * updated" and change nothing — the same shape as a silent no-op elsewhere in
 * this admin. `buildBlogPayload` omits it in update mode.
 */
export function BlogsSection() {
  const [status, setStatus] = useState<BlogStatus | "all">("all");

  const crud = useCatalogCrud<AdminBlogDetail, BlogFormValues>({
    noun: "article",
    entity: "blog",
    load: () => adminApi.blogs(),
    unreachableMessage: "Could not reach the blogs API.",
    emptyValues: EMPTY_BLOG_FORM,
    // No `loadDetail` — see the file note. Prefilling from the row is what makes
    // a draft editable at all.
    valuesFromRow: blogFormFromRow,
    refFor: blogRefFor,
    labelFor: (b) => b.title,
    build: buildBlogPayload,
    // `Blog` has no `name` column, so the toast label is mapped here rather than
    // left to the hook's generic `name` lookup.
    create: async (p) => ({ name: (await adminApi.createBlog(p)).title }),
    update: async (ref, p) => ({ name: (await adminApi.updateBlog(ref, p)).title }),
    remove: (ref) => adminApi.deleteBlog(ref),
  });

  const [categories, setCategories] = useState<AdminBlogCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    if (crud.dialog === null || categories !== null) return;
    let ignore = false;
    adminApi
      .blogCategories()
      .then((rows) => {
        if (ignore) return;
        setCategories(rows);
      })
      .catch(() => {
        if (ignore) return;
        // An empty dropdown would read as "there are no categories". Said plainly
        // instead; `category_id` is nullable, so the form still works.
        setCategoriesError("The category list could not be loaded.");
        setCategories([]);
      });
    return () => {
      ignore = true;
    };
  }, [crud.dialog, categories]);

  const all = useMemo<BlogRow[]>(
    () =>
      crud.rows.map((b) => {
        const { id, ...rest } = b;
        return { ...rest, id: String(id), record: b };
      }),
    [crud.rows],
  );

  const rows = status === "all" ? all : all.filter((b) => b.status === status);
  const counts = useMemo(() => {
    const by: Partial<Record<BlogStatus, number>> = {};
    for (const b of all) if (b.status === "draft" || b.status === "published") {
      by[b.status] = (by[b.status] ?? 0) + 1;
    }
    return by;
  }, [all]);

  const title =
    crud.dialog === null
      ? "Article"
      : crud.dialog.mode === "create"
        ? "New article"
        : `Edit ${crud.dialog.label}`;

  return (
    <div>
      <SectionHeading
        title="Articles"
        description="Drafts and published posts, with featured and search metadata"
        count={rows.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> New article
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterChips options={BLOG_STATUSES} value={status} onChange={setStatus} counts={counts} />
      </div>

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading articles…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "title",
              header: "Article",
              render: (p) => <span className="font-semibold text-gray-900">{p.title}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (p) => (
                <Badge variant={p.status === "published" ? "green" : "gray"}>{p.status}</Badge>
              ),
            },
            {
              key: "category_name",
              header: "Category",
              render: (p) => (p.category_name ? <Badge variant="purple">{p.category_name}</Badge> : "—"),
            },
            { key: "author_name", header: "Author", render: (p) => p.author_name ?? "—" },
            {
              key: "published_at",
              header: "Published",
              // A draft has no `published_at`, which is what distinguishes "not yet
              // published" from "published on an unknown date".
              render: (p) => p.published_at?.slice(0, 10) ?? "—",
            },
            { key: "view_count", header: "Views" },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (p) => {
                const ref = blogRefFor(p.record);
                return (
                  <RowCrudActions
                    noun="article"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(p.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(p.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["title", "category_name", "author_name", "status"]}
          searchPlaceholder="Search articles..."
          emptyState="No articles match this filter."
        />
      )}

      <CatalogDialog
        open={crud.dialog !== null}
        title={title}
        mode={crud.dialog?.mode ?? "create"}
        loading={crud.dialog?.mode === "update" && crud.values === null}
        formError={crud.formError}
        submitting={crud.submitting}
        onClose={crud.closeDialog}
        onSubmit={crud.submit}
        createLabel="Create article"
      >
        {crud.values && (
          <>
            {categoriesError && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {categoriesError} The category field is optional and everything else on
                this form still works.
              </p>
            )}
            <BlogFormFields
              values={crud.values}
              onChange={crud.setValues}
              categories={categories ?? []}
              mode={crud.dialog?.mode ?? "create"}
              disabled={crud.submitting}
            />
          </>
        )}
      </CatalogDialog>
    </div>
  );
}
