import {
  optionalInt,
  optionalText,
  requiredText,
  rowRefFor,
  type FormResult,
} from "@/lib/form-parts";

/**
 * The blog admin form.
 *
 * ## A draft cannot be fetched, so the edit form is prefilled from the table
 *
 * This is the one panel where there is no detail request, and the reason is worth
 * stating because it looks like an oversight otherwise.
 *
 * `GET /blogs/{blog_ref}` filters `where(cond, Blog.status == "published")` — it
 * is the *public* read, and a draft is a 404. `update_blog` and `delete_blog`
 * resolve through `_find_blog`, which does not filter. So for a published post a
 * detail fetch would work; for a draft it returns 404 and the edit dialog can
 * never be opened.
 *
 * `GET /blogs` does return `content` for every row it returns, so the table row
 * already holds everything the form needs. Prefilling from it is therefore the
 * only approach that works for both statuses, and it costs no extra request.
 *
 * ## The status filter is not optional
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
 * for a content manager as much as for anyone else. The old panel called
 * `GET /blogs` with no parameters, which is why it was titled "Published
 * articles" and why every draft in the database was unreachable: no screen could
 * list one, open one, or delete one. `adminApi.blogs()` now walks both statuses
 * explicitly, and the panel is titled for both.
 *
 * ## `slug` is create-only
 *
 * `BlogCreate.slug` is optional and the router slugifies the title when it is
 * absent. `BlogUpdate` has no `slug` at all, so a slug cannot be changed after
 * publication — editing the title leaves the URL alone, which is the correct
 * behaviour for a published URL and is worth the admin knowing. The field is
 * offered on create only, and the update payload omits it.
 *
 * ## `is_featured` is safe here, unlike `is_active` on the other four
 *
 * There is no `is_active` on `Blog`; `status` is the visibility field, and both
 * values list normally. So `is_featured` is offered in both modes — it exists on
 * both schemas and there is no filter that can hide a row behind it.
 */
export type BlogStatus = "draft" | "published";

export interface BlogFormValues {
  title: string;
  /** Create-only — `BlogUpdate` has no `slug`. */
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string;
  category_id: string;
  status: BlogStatus;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  is_featured: boolean;
}

export const EMPTY_BLOG_FORM: BlogFormValues = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  featured_image_url: "",
  category_id: "",
  // A new post is a draft. Publishing is a separate, deliberate act — and it is
  // the one that puts the post on the public site, so it should not be the
  // default outcome of "save".
  status: "draft",
  meta_title: "",
  meta_description: "",
  canonical_url: "",
  is_featured: false,
};

export const BLOG_STATUSES: readonly BlogStatus[] = ["draft", "published"];

/** The subset of `BlogResponse` this form reads. */
export interface BlogDetail {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category_id: number | null;
  status: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  is_featured: boolean;
}

function asStatus(value: string): BlogStatus {
  // `BlogResponse.status` is a plain `str` in the schema, so a value outside the
  // pattern is possible in the database even though the create and update
  // schemas both constrain it. Falling back to "draft" is the safe direction:
  // it cannot accidentally publish a post by opening and saving it.
  return value === "published" ? "published" : "draft";
}

export function blogFormFromRow(row: BlogDetail): BlogFormValues {
  return {
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt ?? "",
    featured_image_url: row.featured_image_url ?? "",
    category_id: row.category_id === null ? "" : String(row.category_id),
    status: asStatus(row.status),
    meta_title: row.meta_title ?? "",
    meta_description: row.meta_description ?? "",
    canonical_url: row.canonical_url ?? "",
    is_featured: row.is_featured,
  };
}

export function blogRefFor(row: { id: number }): string {
  return rowRefFor(row);
}

export type BlogPayload = Record<string, unknown>;

export function buildBlogPayload(
  values: BlogFormValues,
  mode: "create" | "update",
): FormResult<BlogPayload> {
  const title = requiredText(values.title, "The title", { min: 2, max: 255 });
  if (!title.ok) return title;

  // `BlogCreate.content: str` with no `max_length`, so no bound is invented.
  // A blank body is still refused here: the schema would accept `""` and publish
  // an empty page.
  const content = requiredText(values.content, "The article body");
  if (!content.ok) return content;

  const excerpt = optionalText(values.excerpt, "The excerpt");
  if (!excerpt.ok) return excerpt;

  const image = optionalText(values.featured_image_url, "The featured image URL");
  if (!image.ok) return image;

  // `featured_image_url` is a URL column, not an upload. The media panel writes
  // a same-origin `/api/v1/media/files/{id}` path into it, so a relative path is
  // the expected value and a bare "looks like a domain" check would reject it.
  if (image.value !== null && !/^(https?:\/\/|\/)/i.test(image.value)) {
    return {
      ok: false,
      error: "The featured image URL must be an http(s) address or a path starting with /.",
    };
  }

  const categoryId = optionalInt(values.category_id, "The category", { min: 1 });
  if (!categoryId.ok) return categoryId;

  const metaTitle = optionalText(values.meta_title, "The meta title");
  if (!metaTitle.ok) return metaTitle;

  const metaDescription = optionalText(values.meta_description, "The meta description");
  if (!metaDescription.ok) return metaDescription;

  const canonical = optionalText(values.canonical_url, "The canonical URL");
  if (!canonical.ok) return canonical;
  if (canonical.value !== null && !/^https?:\/\//i.test(canonical.value)) {
    return {
      ok: false,
      error: "The canonical URL must be an http(s) address.",
    };
  }

  const shared: BlogPayload = {
    title: title.value,
    content: content.value,
    excerpt: excerpt.value,
    featured_image_url: image.value,
    category_id: categoryId.value,
    status: values.status,
    meta_title: metaTitle.value,
    meta_description: metaDescription.value,
    canonical_url: canonical.value,
    is_featured: values.is_featured,
  };

  if (mode === "create") {
    const slug = optionalText(values.slug, "The slug", 255);
    if (!slug.ok) return slug;
    if (slug.value !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) {
      // `_slugify` is `re.sub(r"[^a-z0-9]+", "-", ...).strip("-")`, so anything
      // else is silently rewritten by the server. Saying so here is better than
      // letting the admin wonder why the URL they typed is not the URL they got.
      return {
        ok: false,
        error: "The slug can only use lowercase letters, numbers and single hyphens.",
      };
    }
    return { ok: true, value: { ...shared, slug: slug.value } };
  }

  // `slug` deliberately absent: `BlogUpdate` has no such field. See the file note.
  return { ok: true, value: shared };
}
