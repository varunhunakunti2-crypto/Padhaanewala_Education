"use client";

import { Input, Select } from "@/components/ui/FormField";
import { Field, FieldSet, NoneOption, Textarea } from "@/components/admin/fields";
import type { AdminBlogCategory } from "@/lib/api";
import { BLOG_STATUSES, type BlogFormValues, type BlogStatus } from "@/lib/blog-form";

/**
 * The field set for creating and editing an article.
 *
 * ## The slug is create-only, and that is the API's choice
 *
 * `BlogUpdate` has no `slug` key, so a published article's URL cannot be changed
 * after the fact — editing the title leaves the URL alone. That is the right
 * behaviour for a URL that has already been shared or indexed, and the field is
 * simply absent on edit rather than disabled, because a disabled field that looks
 * editable wastes an admin's time.
 *
 * On create the slug is optional: the router slugifies the title when it is
 * absent. It is validated against the server's own rule
 * (`[^a-z0-9]+` → `-`) so the admin learns the URL will change rather than
 * discovering it afterwards.
 *
 * ## Status is a real two-value field
 *
 * Unlike `is_active` on the other four catalogue tables, `status` is the
 * visibility field on `Blog` and **both** values list normally — `adminApi.blogs()`
 * walks `?status=draft` and `?status=published` separately precisely so a draft
 * appears here. Publishing is a deliberate act and the create form defaults to a
 * draft, because "save" should not put a post on the public site.
 *
 * ## The article body is required, though the schema does not say so
 *
 * `BlogCreate.content: str` with no `max_length`, so no length bound is invented
 * here. But a blank body would be accepted and published as an empty page, so the
 * builder refuses it.
 */
export function BlogFormFields({
  values,
  onChange,
  categories,
  mode,
  disabled,
}: {
  values: BlogFormValues;
  onChange: (next: BlogFormValues) => void;
  categories: AdminBlogCategory[];
  mode: "create" | "update";
  disabled?: boolean;
}) {
  const set = <K extends keyof BlogFormValues>(key: K, value: BlogFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-6">
      <FieldSet legend="Article" disabled={disabled}>
        <Field
          id="blog-title"
          label="Title"
          hint="Shown as the headline and used to build the public URL. 2–255 characters."
        >
          <Input
            id="blog-title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="How to choose an engineering college"
            required
            aria-required="true"
            maxLength={255}
          />
        </Field>

        {mode === "create" && (
          <Field
            id="blog-slug"
            label="Slug"
            hint="Optional. Leave blank to build it from the title. It cannot be changed after the article is saved — the update schema has no slug field."
          >
            <Input
              id="blog-slug"
              value={values.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="how-to-choose-an-engineering-college"
            />
          </Field>
        )}

        <div>
          <label htmlFor="blog-content" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Article body
          </label>
          <Textarea
            id="blog-content"
            rows={10}
            value={values.content}
            onChange={(v) => set("content", v)}
            placeholder="The body of the article. Required — an empty article would be published as a blank page."
          />
        </div>

        <Field id="blog-excerpt" label="Excerpt" hint="Shown in listings and search results.">
          <Textarea
            id="blog-excerpt"
            rows={3}
            value={values.excerpt}
            onChange={(v) => set("excerpt", v)}
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Presentation" disabled={disabled}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="blog-image"
            label="Featured image URL"
            hint="An http(s) address, or a path such as /api/v1/media/files/12 from the media library."
          >
            <Input
              id="blog-image"
              value={values.featured_image_url}
              onChange={(e) => set("featured_image_url", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field id="blog-category" label="Category">
            <Select
              id="blog-category"
              value={values.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <NoneOption label="No category" />
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={values.is_featured}
            onChange={(e) => set("is_featured", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          Featured
        </label>
      </FieldSet>

      <FieldSet
        legend="Publishing"
        disabled={disabled}
        note="A draft is listed here but is not served publicly. Publishing puts the article on the public site immediately."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="blog-status" label="Status">
            <Select
              id="blog-status"
              value={values.status}
              onChange={(e) => set("status", e.target.value as BlogStatus)}
            >
              {BLOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "draft" ? "Draft" : "Published"}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="blog-canonical" label="Canonical URL" hint="For content republished elsewhere. Must be an http(s) address.">
            <Input
              id="blog-canonical"
              value={values.canonical_url}
              onChange={(e) => set("canonical_url", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>
        <Field id="blog-meta-title" label="Meta title" hint="Falls back to the article title if left blank.">
          <Input
            id="blog-meta-title"
            value={values.meta_title}
            onChange={(e) => set("meta_title", e.target.value)}
          />
        </Field>
        <Field id="blog-meta-description" label="Meta description" hint="Falls back to the excerpt if left blank.">
          <Textarea
            id="blog-meta-description"
            rows={2}
            value={values.meta_description}
            onChange={(v) => set("meta_description", v)}
          />
        </Field>
      </FieldSet>
    </div>
  );
}
