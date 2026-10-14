import type { SiteSettings, SiteSettingsUpdate } from "@/lib/api";

/**
 * Site settings, as pure data.
 *
 * Two silent failure modes live behind the Settings panel, and neither a build
 * nor a type check can see either:
 *
 *  1. **`PUT /settings` is a partial update.** A field absent from the body is
 *     left alone, so sending the whole form on every save is not equivalent to
 *     sending the fields: it re-writes values the admin never touched, and the
 *     audit log fills with changes that did not happen. `changedFields` sends a
 *     diff and nothing else.
 *
 *  2. **The values are published.** A malformed support address or a blank site
 *     name is accepted by every storage layer and rendered on the public site.
 *     `validateSettings` mirrors the schema's rules so the editor finds out at
 *     the field rather than after a visitor does.
 */

/** The select options, matching the schema's `Literal` sets. */
export const SETTINGS_TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "UTC", label: "UTC" },
] as const;

export const SETTINGS_NUMBER_FORMATS = [
  { value: "indian", label: "Indian (₹, lakh)" },
  { value: "international", label: "International ($, K)" },
] as const;

/** The editable fields, in the order the panel renders them. */
export const SETTINGS_FIELDS = [
  "site_name",
  "support_email",
  "contact_phone",
  "counselling_hours",
  "default_timezone",
  "number_formatting",
] as const;

export type SettingsField = (typeof SETTINGS_FIELDS)[number];

/** The form's own shape: every field a string, including the selects. */
export type SettingsDraft = Record<SettingsField, string>;

export type SettingsFieldErrors = Partial<Record<SettingsField, string>>;

export function draftFrom(settings: SiteSettings): SettingsDraft {
  return {
    site_name: settings.site_name,
    support_email: settings.support_email,
    contact_phone: settings.contact_phone,
    counselling_hours: settings.counselling_hours,
    default_timezone: settings.default_timezone,
    number_formatting: settings.number_formatting,
  };
}

/** Free-text fields are trimmed before they are compared or sent. */
function normalise(field: SettingsField, value: string): string {
  return field === "default_timezone" || field === "number_formatting"
    ? value
    : value.trim();
}

/**
 * The subset of `draft` that differs from what the server currently holds.
 *
 * Returns `{}` when nothing changed, which the panel uses to disable Save — a
 * no-op `PUT` would still write an audit row and bump `updated_at`, so "nothing
 * to save" has to be distinguishable from "saved an identical value".
 */
export function changedFields(
  draft: SettingsDraft,
  baseline: SiteSettings,
): SiteSettingsUpdate {
  const current = draftFrom(baseline);
  const patch: SiteSettingsUpdate = {};
  for (const field of SETTINGS_FIELDS) {
    const next = normalise(field, draft[field]);
    if (next !== current[field]) patch[field] = next;
  }
  return patch;
}

/** Mirrors `EMAIL_RE` on the public forms closely enough to catch typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits plus the punctuation a published phone number actually uses. */
const PHONE_RE = /^\+?[0-9][0-9\s()-]{3,29}$/;

/**
 * Per-field messages for values the server would reject (`SiteSettingsUpdate`).
 * An empty object means the draft is safe to send.
 */
export function validateSettings(draft: SettingsDraft): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};

  const name = draft.site_name.trim();
  if (!name) errors.site_name = "Site name is required.";
  else if (name.length > 120) errors.site_name = "Keep it to 120 characters or fewer.";

  const email = draft.support_email.trim();
  if (!email) errors.support_email = "Support email is required.";
  else if (!EMAIL_RE.test(email)) errors.support_email = "Enter a valid email address.";

  const phone = draft.contact_phone.trim();
  if (!phone) errors.contact_phone = "Contact phone is required.";
  else if (phone.length < 5 || phone.length > 30)
    errors.contact_phone = "Use between 5 and 30 characters.";
  else if (!PHONE_RE.test(phone))
    errors.contact_phone = "Use digits, spaces, +, -, or parentheses.";

  const hours = draft.counselling_hours.trim();
  if (!hours) errors.counselling_hours = "Counselling hours are required.";
  else if (hours.length > 120)
    errors.counselling_hours = "Keep it to 120 characters or fewer.";

  if (!SETTINGS_TIMEZONES.some((zone) => zone.value === draft.default_timezone))
    errors.default_timezone = "Choose a supported timezone.";
  if (!SETTINGS_NUMBER_FORMATS.some((fmt) => fmt.value === draft.number_formatting))
    errors.number_formatting = "Choose a supported number format.";

  return errors;
}
