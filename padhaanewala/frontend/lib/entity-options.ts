import { adminApi, type AdminBlog, type AdminCourse, type AdminUniversity } from "@/lib/api";
import type { ApiCollegeListItem } from "@/lib/api-server";
import { MEDIA_ENTITY_TYPES, type MediaEntityOption } from "@/lib/media-form";

/**
 * The entity picker shared by the media and FAQ panels.
 *
 * ## Why this exists twice, and why it is one module
 *
 * `media` and `faq` are the only two tables in the schema that attach a row to
 * something else through a **soft reference** — an `entity_type` string beside an
 * `entity_id` integer, with no foreign key to any table. `upload_media` and
 * `create_faq` both store the pair without checking either half, and both routers
 * say so in their own docstrings: validating it would need a registry of entity
 * types the schema does not have, so the admin panel picking both values from a
 * real list *is* the safeguard.
 *
 * That makes the guarantee live or dead based on this file, so it is written once
 * and used by both panels rather than reimplemented per screen. A second copy
 * would be free to drift into a free-text id box, and the failure is silent: the
 * write succeeds, returns 201, and the row is then invisible in every listing.
 *
 * ## Why these four types
 *
 * Each is backed by an admin list endpoint that returns real rows. `college`
 * comes first because that is what both panels are mostly used for.
 *
 * `blog` is the one that cannot be paged past 50 — `GET /blogs` caps `limit` at
 * 50 — so its picker shows as many as the route allows. That is stated rather
 * than hidden because it is the one case where the list can be incomplete.
 */
/**
 * Typed `Partial`, not `Record`, and that is the honest reading of the schema.
 *
 * `media.entity_type` and `faq.entity_type` are `String(50)` columns with no enum
 * and no check constraint, so a value outside this map is a real possibility in
 * seeded data. Typing it as a total `Record` would make `ENTITY_LOADERS[type]`
 * non-nullable, and both consumers have to branch on "no list for this type" —
 * with a total type that branch is silently unreachable to the checker, which is
 * how a free-text id box would get reintroduced without a single error.
 */
export const ENTITY_LOADERS: Partial<
  Record<string, () => Promise<MediaEntityOption[]>>
> = {
  college: async () => (await adminApi.colleges()).map((c: ApiCollegeListItem) => ({ id: c.id, label: c.name })),
  course: async () => (await adminApi.courses()).map((c: AdminCourse) => ({ id: c.id, label: c.name })),
  university: async () => (await adminApi.universities()).map((u: AdminUniversity) => ({ id: u.id, label: u.name })),
  blog: async () => (await adminApi.blogs()).map((b: AdminBlog) => ({ id: b.id, label: b.title })),
};

export { MEDIA_ENTITY_TYPES, type MediaEntityOption };
export { mediaEntityLabel } from "@/lib/media-form";

/**
 * A label for an `entity_type` that is *not* one of the four above.
 *
 * The pickers cannot show a type they have no list for, but the **libraries**
 * still have to render rows that reference one. An FAQ written before this panel
 * existed carries whatever free text was typed into the column, and showing that
 * as a blank would make a real record look unattached — and hide it from a search
 * for the thing it belongs to. Falls back to the stored value.
 */
export function entityTypeLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (raw === "") return "Unattached";
  return MEDIA_ENTITY_TYPES.find((t) => t.value === raw)?.label ?? raw;
}
