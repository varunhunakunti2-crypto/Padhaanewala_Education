import { ApiError } from "@/lib/api";

/**
 * The media upload form, expressed as pure data.
 *
 * ## Why this is not inside the component
 *
 * `POST /media/upload` is multipart, and multipart has three traps that a
 * rendering layer cannot defend against:
 *
 *  - **Every part arrives as a string.** `entity_id: int = Form(...)` and
 *    `display_order: int = Form(0)` are parsed by FastAPI, so a form that sends
 *    `""` gets a 422 — and `display_order=""` is *not* the same as omitting the
 *    part, which would take the declared default of 0.
 *  - **The type check is on the bytes.** `media_store.sniff_image_type` reads
 *    the file's contents and refuses SVG specifically, so a browser-reported
 *    MIME type is advisory. The checks here pre-screen the cases an admin will
 *    actually hit and the server still decides; a polyglot that passes both is
 *    refused with a good message, not accepted.
 *  - **The ceiling is backend configuration.** `MEDIA_MAX_BYTES` is a setting,
 *    so the constant below mirrors the default and exists to fail fast. The 413
 *    from `media_store.save` is what actually refuses an oversized file.
 *
 * ## The entity pair is the whole point of this screen
 *
 * `media.entity_type` / `media.entity_id` is a **soft reference** — there is no
 * foreign key to `college`, `blog` or anything else — so a typo writes a row
 * that no listing will ever find again. `upload_media`'s docstring says so
 * outright and deliberately leaves the check to this side of the wire, because
 * validating it properly would need an entity-type registry the schema does not
 * have. So the *only* safeguard is that the admin picks both halves out of a
 * real list, which is why `buildMediaUpload` refuses to accept a typed id.
 */

/* ------------------------------------------------------------------ *
 * Contract constants
 * ------------------------------------------------------------------ */

/**
 * Mirror of `MEDIA_MAX_BYTES` in `backend/app/config.py`.
 *
 * Read through {@link mediaMaxBytes} rather than inlined, so a deployment with a
 * different ceiling can set `NEXT_PUBLIC_MEDIA_MAX_BYTES` instead of editing
 * this file. It is deliberately not a larger number than the server's: a client
 * limit *below* the server's refuses a file the server would have accepted, and
 * that is a visible error the admin can act on, whereas a limit above it only
 * spends a 5 MiB upload before the real refusal arrives.
 */
export const MEDIA_MAX_BYTES_DEFAULT = 5 * 1024 * 1024;

/** The four raster formats `sniff_image_type` recognises, by extension. */
export const MEDIA_ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

/** The same four, as the `Content-Type`s a browser reports for them. */
const ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** Value for the file input's `accept` attribute, so the OS picker pre-filters. */
export const MEDIA_ACCEPT_ATTRIBUTE = [
  ...MEDIA_ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`),
  ...ACCEPTED_MIME_TYPES,
].join(",");

/**
 * Why SVG is refused, in words an admin can act on.
 *
 * `media_store.SVG_REASON` gives the security reason; this is the fix. SVG is an
 * XML document that can carry `<script>`, and these files are served **inline
 * from this site's own origin** by `GET /media/files/{id}`, so an accepted SVG
 * is script running on our pages.
 */
export const MEDIA_SVG_REASON =
  "SVG is not accepted. It is a text file that can carry script, and uploaded " +
  "images are served inline from this site. Re-export the artwork as PNG or WebP.";

/**
 * The entity types this panel can attach an image to.
 *
 * Each one is backed by an admin list endpoint that returns real rows, because
 * the soft reference above means an id typed by hand is an id that cannot be
 * found again. Ordered by how much this panel is actually used: a college cannot
 * be added properly without its logo.
 */
export const MEDIA_ENTITY_TYPES = [
  { value: "college", label: "College" },
  { value: "course", label: "Course" },
  { value: "university", label: "University" },
  { value: "blog", label: "Blog post" },
] as const;

/**
 * A label for an `entity_type`, falling back to the stored value.
 *
 * The fallback is load-bearing for the library grid, not a nicety: rows written
 * before this panel existed carry whatever free text was typed into the column
 * (`colleges`, `College`, `college_profile`), and rendering those as a blank
 * would make real uploaded files look unattached. It also means widening this
 * list later cannot make older rows disappear.
 */
export function mediaEntityLabel(entityType: string | null | undefined): string {
  const value = (entityType ?? "").trim();
  if (value === "") return "Unattached";
  return MEDIA_ENTITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Suggested `image_type` values. Free text is still allowed — see the builder. */
export const MEDIA_IMAGE_TYPES = ["logo", "cover", "campus", "gallery", "banner"] as const;

/**
 * One row of the entity picker: the primary key the soft reference stores, and
 * something an admin can recognise.
 *
 * The label is kept separate from the id on purpose. The picker is the only
 * safeguard the schema has, so a row rendered as `#42` would defeat it.
 */
export interface MediaEntityOption {
  id: number;
  label: string;
}

/** `String(50)` on `media.entity_type` and `media.image_type`. */
export const MEDIA_ENTITY_TYPE_MAX = 50;
export const MEDIA_IMAGE_TYPE_MAX = 50;
/** `String(255)` on `media.alt_text`. */
export const MEDIA_ALT_TEXT_MAX = 255;

/* ------------------------------------------------------------------ *
 * File pre-checks
 * ------------------------------------------------------------------ */

export type MediaCheck = { ok: true } | { ok: false; error: string };

function fail(error: string): MediaCheck {
  return { ok: false, error };
}

/** Bytes rendered the way the size hint and the size error both want them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The server's ceiling for this deployment, with the default as the fallback. */
export function mediaMaxBytes(): number {
  const configured = Number(process.env.NEXT_PUBLIC_MEDIA_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : MEDIA_MAX_BYTES_DEFAULT;
}

/**
 * The file's extension, lowercased, or `""` when it has none.
 *
 * `lastIndexOf` rather than a regex on the whole name, so `logo.png.svg` reports
 * `svg`. The type check runs on the bytes regardless — this is a fast local
 * rejection, not the authority.
 */
export function mediaFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Reject the files this panel should not send, before spending an upload on them.
 *
 * Two independent signals, because either alone lets something through: the
 * browser's `File.type` is empty for formats it does not know, and a renamed
 * file carries a perfectly honest `image/png` label. Agreement between the name
 * and the label is the useful signal, and disagreement is worth refusing too.
 *
 * Anything that passes here is still checked by `sniff_image_type` server-side.
 */
export function validateMediaFile(file: File | null | undefined): MediaCheck {
  if (!file) return fail("Choose an image to upload.");

  if (file.size === 0) return fail("That file is empty.");

  const limit = mediaMaxBytes();
  if (file.size > limit) {
    return fail(
      `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)} — ` +
        "resize it or export a smaller version.",
    );
  }

  const declared = (file.type ?? "").trim().toLowerCase();
  const extension = mediaFileExtension(file.name);

  if (declared === "image/svg+xml" || extension === "svg") {
    return fail(MEDIA_SVG_REASON);
  }

  if (declared !== "" && !(ACCEPTED_MIME_TYPES as readonly string[]).includes(declared)) {
    return fail(
      `A browser labels this file “${declared}”, which is not an accepted image type. ` +
        "Use a PNG, JPEG, GIF or WebP.",
    );
  }

  if (!(MEDIA_ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    return fail(
      extension === ""
        ? "This file has no extension, so its type cannot be confirmed. Rename it to .png, .jpg, .gif or .webp."
        : `A .${extension} file is not accepted. Use a PNG, JPEG, GIF or WebP image.`,
    );
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Payload construction
 * ------------------------------------------------------------------ */

export interface MediaFormValues {
  entity_type: string;
  entity_id: string;
  image_type: string;
  alt_text: string;
  display_order: string;
}

/**
 * Defaults to `college`, because that is the case this panel was built for: a
 * college record with no logo.
 */
export const EMPTY_MEDIA_FORM: MediaFormValues = {
  entity_type: "college",
  entity_id: "",
  image_type: "",
  alt_text: "",
  display_order: "0",
};

export type MediaUploadBuild =
  | { ok: true; body: FormData }
  | { ok: false; error: string };

function buildFail(error: string): MediaUploadBuild {
  return { ok: false, error };
}

/**
 * Build the multipart body for `POST /media/upload`.
 *
 * The part names must match the `Form(...)` parameters on the route exactly —
 * `file`, `entity_type`, `entity_id`, `image_type`, `alt_text`, `display_order`
 * — and the first two are required. Every part here is a string or a `File`,
 * because that is all `FormData` carries and FastAPI does the rest.
 */
export function buildMediaUpload(values: MediaFormValues, file: File | null): MediaUploadBuild {
  const checked = validateMediaFile(file);
  if (!checked.ok) return buildFail(checked.error);
  const image = file as File;

  const entityType = values.entity_type.trim();
  if (entityType === "") return buildFail("Choose what this image belongs to.");
  if (entityType.length > MEDIA_ENTITY_TYPE_MAX) {
    return buildFail(`An entity type cannot be longer than ${MEDIA_ENTITY_TYPE_MAX} characters.`);
  }
  const label = mediaEntityLabel(entityType).toLowerCase();

  const entityId = values.entity_id.trim();
  if (entityId === "") return buildFail(`Choose which ${label} this image belongs to.`);
  // Not a type check on the option list: a select can only produce what it was
  // given, and this guards the value that actually reaches the column.
  if (!/^\d+$/.test(entityId) || Number(entityId) < 1) {
    return buildFail(`The ${label} id must be a positive whole number.`);
  }

  const imageType = values.image_type.trim();
  if (imageType.length > MEDIA_IMAGE_TYPE_MAX) {
    return buildFail(`The image type cannot be longer than ${MEDIA_IMAGE_TYPE_MAX} characters.`);
  }

  const altText = values.alt_text.trim();
  if (altText.length > MEDIA_ALT_TEXT_MAX) {
    return buildFail(`The alt text cannot be longer than ${MEDIA_ALT_TEXT_MAX} characters.`);
  }

  // `display_order` is a bare `Integer`, so "1.5" and "-2" are both storable and
  // both nonsense. An empty box omits the part so the route's `Form(0)` applies,
  // rather than sending `""` and earning a 422.
  const rawOrder = values.display_order.trim();
  let displayOrder = 0;
  if (rawOrder !== "") {
    if (!/^\d+$/.test(rawOrder)) return buildFail("The display order must be a whole number.");
    displayOrder = Number(rawOrder);
  }

  const body = new FormData();
  body.set("file", image, image.name);
  body.set("entity_type", entityType);
  body.set("entity_id", entityId);
  // The route stores `image_type or None` and `alt_text or None`, so an empty
  // string is stored as NULL rather than as a blank column. Sent either way
  // rather than omitted, so the request shape does not depend on which boxes
  // the admin happened to fill in.
  body.set("image_type", imageType);
  body.set("alt_text", altText);
  body.set("display_order", String(displayOrder));

  return { ok: true, body };
}

/* ------------------------------------------------------------------ *
 * Error presentation
 * ------------------------------------------------------------------ */

/**
 * Turn a rejected upload into something an admin can fix.
 *
 * The statuses that matter are the ones `media_store` raises, and 413 and 415 are
 * the interesting pair: both come from the *bytes*, both arrive as a plain
 * string `detail` that is already actionable, and neither is a fault in the form
 * the admin filled in. A client that reported them as "upload failed" would be
 * technically correct and useless.
 */
export function describeMediaError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "The upload could not be sent. Check your connection.";
  }
  if (err.status === 403) {
    return "Your role cannot upload files. A super admin, admin or content manager is needed.";
  }
  if (err.status === 413) {
    // `media_store.save` phrases this with the real byte counts.
    return err.message || "That file is over the size limit.";
  }
  if (err.status === 415) {
    return err.message || "That file is not a PNG, JPEG, GIF or WebP image.";
  }
  if (err.status === 400) {
    return err.message || "The server rejected the file.";
  }
  if (err.status === 422) {
    return err.message || "The server rejected these values.";
  }
  if (err.status === 0) {
    return "Could not reach the API.";
  }
  return err.message || "The upload failed.";
}
