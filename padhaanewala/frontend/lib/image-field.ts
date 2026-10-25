/**
 * The image field shared by the college, course, scholarship and exam admin
 * forms.
 *
 * ## Why the URL check lives here and not in the component
 *
 * The value is written to an `image_url` column and later rendered as an
 * `<img src>` on a public page. The backend refuses `javascript:` and `data:`
 * URIs (`validate_image_url` in `app/schemas/catalog.py`), so a bad value will
 * not be stored — but the form should say *why* at the keyboard instead of
 * round-tripping a 422. This mirrors the server rule exactly, and the two are
 * meant to be read together.
 *
 * ## Two ways to fill it, one value
 *
 * An admin either uploads a file (which the media library stores and returns as
 * a same-origin `/media/files/{id}` path) or pastes a URL. Both end up in the
 * same string, so the form has one field and two controls, not two fields.
 */

/** Mirrors `IMAGE_URL_MAX` on the backend schemas and `String(500)` on the column. */
export const IMAGE_URL_MAX = 500;

export type ImageUrlCheck = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Validate what the admin typed, returning `null` for "no image".
 *
 * A blank box is *not* an error: it clears the column, which is the edit that
 * restores the gradient fallback. That is the same reason the backend maps `""`
 * to NULL rather than storing an empty string.
 */
export function checkImageUrl(raw: string): ImageUrlCheck {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };

  if (value.length > IMAGE_URL_MAX) {
    return {
      ok: false,
      error: `An image URL cannot be longer than ${IMAGE_URL_MAX} characters.`,
    };
  }

  const lowered = value.toLowerCase();
  if (lowered.startsWith("javascript:") || lowered.startsWith("data:")) {
    return {
      ok: false,
      error: "That is not an image address. Use an uploaded file or an http(s) URL.",
    };
  }
  // Protocol-relative: it leaves the site while looking like a path to anyone
  // skimming the form.
  if (value.startsWith("//")) {
    return { ok: false, error: "Start the URL with https:// or a /path, not //." };
  }
  if (value.startsWith("/")) return { ok: true, value };
  if (lowered.startsWith("http://") || lowered.startsWith("https://")) {
    return { ok: true, value };
  }
  return {
    ok: false,
    error: "An image must be an uploaded file, a /path, or a full https:// URL.",
  };
}

/**
 * Whether an `<img>` can render this value as-is.
 *
 * Used by the preview, which must not attempt to load a value the server will
 * refuse — an `<img src="javascript:...">` does nothing, but `data:` would, and
 * showing a preview of something that cannot be saved is misleading either way.
 */
export function isRenderableImageUrl(value: string): boolean {
  const check = checkImageUrl(value);
  return check.ok && check.value !== null;
}
