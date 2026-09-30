import { ApiError } from "@/lib/api";

/**
 * Primitives shared by the five catalogue forms.
 *
 * Each of the course, scholarship, exam, blog and FAQ forms has the same shape —
 * a name, a handful of optional strings, some dates, and a payload that differs
 * between create and update — so the parts that are *not* about any one entity
 * live here rather than being copied five times.
 *
 * Everything here is pure and takes a `string` from a controlled input, because
 * the failure mode this whole layer exists to prevent is silent. From
 * `lib/college-form.ts`:
 *
 * > `JSON.stringify({ y: NaN })` produces `{"y":null}`. A typo in a numeric field
 * > does not produce a 422 — it produces a *successful write* that clears the
 * > column.
 *
 * Every coercion below therefore **fails loudly** on anything it cannot parse,
 * and never passes a value through unvalidated on the assumption that the server
 * will catch it. `""` means "not provided" and becomes `null`; it is never sent
 * as an empty string, because these columns are nullable and a blank string is a
 * different thing from a blank column.
 */

/* ------------------------------------------------------------------ *
 * Scalars
 * ------------------------------------------------------------------ */

export type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Trim, and treat an empty box as "not provided" rather than as `""`. */
export function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A required string, bounded by the width of the column it lands in. */
export function requiredText(
  value: string,
  label: string,
  { min = 1, max = 255 }: { min?: number; max?: number } = {},
): FormResult<string> {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: false, error: `${label} is required.` };
  if (trimmed.length < min) {
    return { ok: false, error: `${label} needs at least ${min} characters.` };
  }
  if (trimmed.length > max) {
    return { ok: false, error: `${label} cannot be longer than ${max} characters.` };
  }
  return { ok: true, value: trimmed };
}

/** An optional string, bounded. Over-long is an error, not a silent truncation. */
export function optionalText(
  value: string,
  label: string,
  max = 255,
): FormResult<string | null> {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > max) {
    return { ok: false, error: `${label} cannot be longer than ${max} characters.` };
  }
  return { ok: true, value: trimmed };
}

/** An optional whole number, optionally bounded on both sides. */
export function optionalInt(
  value: string,
  label: string,
  { min, max }: { min?: number; max?: number } = {},
): FormResult<number | null> {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }
  const parsed = Number(trimmed);
  if (min !== undefined && parsed < min) {
    return { ok: false, error: `${label} cannot be less than ${min}.` };
  }
  if (max !== undefined && parsed > max) {
    return { ok: false, error: `${label} cannot be greater than ${max}.` };
  }
  return { ok: true, value: parsed };
}

/** A required whole number, for the `int` columns these schemas declare. */
export function requiredInt(
  value: string,
  label: string,
  { min, max }: { min?: number; max?: number } = {},
): FormResult<number> {
  const parsed = optionalInt(value, label, { min, max });
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return { ok: false, error: `${label} is required.` };
  return { ok: true, value: parsed.value };
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

/**
 * An optional `date` column, entered as `YYYY-MM-DD`.
 *
 * Checked by parsing the *components* rather than by `new Date(value)`, because
 * `new Date("2026-02-31")` is not invalid — JavaScript rolls it to 2 March — and
 * the value would be sent as the 31st and stored as the 3rd. A date input hands
 * us a well-formed string, but a paste into a text box does not.
 */
export function optionalDate(value: string, label: string): FormResult<string | null> {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!parts) {
    return { ok: false, error: `${label} must be a date like 2026-04-30.` };
  }

  const [, year, month, day] = parts;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth) {
    return { ok: false, error: `${label} is not a real date.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * The `YYYY-MM-DD` prefix of a value the API returned.
 *
 * The response types are typed as `string` but Pydantic serialises `date` to
 * exactly that, and `null` for a column with no value. The `String(...)` is
 * defensive rather than expected: a column added to the model without a
 * corresponding `date` type in the schema would arrive as a full timestamp, and
 * sending that back as a `date` is a 422 that looks like a backend fault.
 */
export function dateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Slugs and refs
 * ------------------------------------------------------------------ */

/**
 * The key a `PUT` or `DELETE` expects.
 *
 * `courses.py`, `scholarships.py`, `exams.py` and `blogs.py` all resolve their
 * `*_ref` path parameter as `int(ref)` when the segment is all digits and as a
 * slug otherwise, so the numeric primary key is the only unambiguous choice. The
 * tempting slug is not always wrong but it can collide once two records
 * normalise to the same string, and the slug is derived from the name — which
 * this form lets you edit. `/faqs/{id}` is a plain `int` and is used as one.
 *
 * The same reasoning as `collegeRefFor` in `lib/college-form.ts`.
 */
export function rowRefFor(row: { id: number }): string {
  return String(row.id);
}

/* ------------------------------------------------------------------ *
 * Error presentation
 * ------------------------------------------------------------------ */

/**
 * Turn a rejected write into something an admin can act on.
 *
 * All five routers signal a duplicate name as a **400**, not the 409 a conflict
 * conventionally gets, and all five phrase it differently ("Course with this
 * name exists", "Blog with this slug exists", …). So the status cannot select a
 * message and the router cannot either — the match is on the status plus the
 * word, which is why `noun` is passed in rather than hardcoded.
 *
 * The 404 branch is the one worth reading twice. Every one of these routers
 * resolves a record for `PUT` and `DELETE` through a helper that does **not**
 * filter on `is_active`, but the `GET` by id does. So a record that has been
 * deactivated cannot be opened for editing, and a delete that returns 404 here
 * is nearly always a record that was already inactive rather than a missing one.
 */
export function describeWriteError(err: unknown, noun: string): string {
  if (!(err instanceof ApiError)) {
    return "The request could not be sent. Check your connection.";
  }
  if (err.status === 403) {
    return `You do not have permission to do that. A higher role is needed to ${noun} this.`;
  }
  if (err.status === 404) {
    return `That ${noun} no longer exists. Reload the list and try again.`;
  }
  if (err.status === 400 && /exists/i.test(String(err.message))) {
    return `A ${noun} with that name already exists.`;
  }
  if (err.status === 400) {
    return err.message || `The server rejected the ${noun}.`;
  }
  if (err.status === 422) {
    // apiFetch has already joined the FastAPI validation messages.
    return err.message || "The server rejected these values.";
  }
  if (err.status === 0) {
    return "Could not reach the API.";
  }
  return err.message || "The server rejected the request.";
}

/* ------------------------------------------------------------------ *
 * Role gates
 * ------------------------------------------------------------------ */

/**
 * True when the signed-in user holds **any** of `allowed`.
 *
 * This helper exists because the obvious alternative is wrong, and was wrong here
 * for a while. Storing the gate as a single "minimum role" name and calling
 * `roles.includes(minimum)` looks equivalent to an any-of check and is not: a
 * super admin's `roles` array is `["super_admin"]` and nothing else, because
 * role membership is not implied by rank. `requires_ceiling`-style
 * `super_admin, admin` gates therefore reported `false` for the one role that can
 * actually satisfy them, and the panel hid a working Delete button.
 *
 * Every gate is a *list* now, spelled the same way the backend spells it, so the
 * two can be compared by eye.
 */
export function hasAnyRole(roles: readonly string[], allowed: readonly string[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

/**
 * The delete gate for each of the five catalogue tables, as the full role list
 * the router requires.
 *
 * Not a uniform answer, and the difference is invisible from the frontend. Every
 * one of these routers gates `POST` and `PUT` on `CONTENT_ROLES`, so a content
 * manager can create and edit all of them — but `DELETE` is on `ADMIN_ROLES`
 * for courses, scholarships, exams and blogs, and on `CONTENT_ROLES` for FAQs
 * alone. A panel that shows one Delete button to everyone either 403s a content
 * manager four times out of five, or hides a capability that does exist.
 *
 * The read is from the `@router.delete(..., dependencies=[Depends(require_role(
 * ...))])` on each route, transcribed from `ADMIN_ROLES` and `CONTENT_ROLES` in
 * `backend/app/roles.py`. Order matches the backend tuples, most-privileged
 * first, so a diff against the Python is legible.
 */
export const CATALOG_DELETE_ROLES = {
  course: ["super_admin", "admin"],
  scholarship: ["super_admin", "admin"],
  exam: ["super_admin", "admin"],
  blog: ["super_admin", "admin"],
  faq: ["super_admin", "admin", "content_manager"],
} as const satisfies Record<string, readonly string[]>;

/**
 * The create / update gate for all five: `CONTENT_ROLES`.
 *
 * A single answer, unlike the delete gate above, because all five routers put
 * `require_role(*CONTENT_ROLES)` on `POST` and `PUT`. From
 * `backend/app/roles.py`:
 *
 * ```python
 * ADMIN_ROLES    = (super_admin, admin)
 * CONTENT_ROLES  = ADMIN_ROLES + (content_manager,)
 * ```
 *
 * `content_manager` is a strictly *lower* bar than the delete gate on four of the
 * five routers, so a content manager gets a working Add and Edit button and no
 * Delete button. That is the intended shape of the API and the panels now
 * reflect it instead of 403ing on every click.
 *
 * A list, not a minimum role name — see {@link hasAnyRole} for why that
 * distinction is load-bearing.
 */
export const CATALOG_WRITE_ROLES: readonly string[] = [
  "super_admin",
  "admin",
  "content_manager",
];
