import type { AdminNotificationSend } from "@/lib/api";
import { optionalText, requiredText, type FormResult } from "@/lib/form-parts";

/**
 * The notification compose / edit form.
 *
 * ## Why this is a module and not inline state in the section
 *
 * The panel's create and edit dialogs send the same three content fields, and
 * the payload has to be bounded by what the API accepts. `NotificationCreate`
 * requires `type` and a non-empty `title` (max 255) and takes an optional
 * `message`; `NotificationUpdate` caps the message at 1000, which is also the
 * width of the column. An over-long body is therefore a 500 on create and a 422
 * on update — two different symptoms for the same typo — so the check belongs
 * where both paths share it.
 *
 * `message` is deliberately allowed to become `null`: the column is nullable,
 * and the edit dialog has to be able to clear a line that should never have been
 * sent. Sending `""` instead would store an empty string, which reads the same
 * on screen and differently in the database.
 */

export interface NotificationFormValues {
  type: string;
  title: string;
  message: string;
}

/** The types the compose form offers. The API accepts any 50-char string. */
export const NOTIFICATION_TYPES = [
  "general",
  "admission",
  "exam",
  "scholarship",
] as const;

export const EMPTY_NOTIFICATION_FORM: NotificationFormValues = {
  type: "general",
  title: "",
  message: "",
};

/** The table row the section renders: a send, with a stable numeric `id`. */
export interface NotificationSendRow extends AdminNotificationSend {
  /** Mirrors `notification_id`, so `useCatalogCrud` can key rows by it. */
  id: number;
}

export function toNotificationSendRow(send: AdminNotificationSend): NotificationSendRow {
  return { ...send, id: send.notification_id };
}

/**
 * The `PUT`/`DELETE` target for a send.
 *
 * Rows written before `batch_id` existed belong to no send, so they are edited
 * one row at a time; everything sent since is addressed as a batch. The prefix
 * is what the section switches on, and keeping it in one place means the two
 * call sites cannot disagree about which endpoint a row belongs to.
 */
export function notificationSendRef(send: { batch_id: string | null; id: number }): string {
  return send.batch_id ? `batch:${send.batch_id}` : `single:${send.id}`;
}

/**
 * Reverse {@link notificationSendRef}, for the write call sites.
 *
 * Returns `null` rather than guessing: a ref that is neither shape means the
 * row came from somewhere unexpected, and sending `Number("batch:abc")` → `NaN`
 * to `/notifications/NaN` would surface as a 422 a long way from the cause.
 */
export function parseNotificationSendRef(
  ref: string,
): { kind: "batch"; batchId: string } | { kind: "single"; id: number } | null {
  if (ref.startsWith("batch:")) {
    const batchId = ref.slice("batch:".length);
    return batchId === "" ? null : { kind: "batch", batchId };
  }
  if (ref.startsWith("single:")) {
    const id = Number(ref.slice("single:".length));
    return Number.isInteger(id) && id > 0 ? { kind: "single", id } : null;
  }
  return null;
}

export function notificationFormFromSend(send: NotificationSendRow): NotificationFormValues {
  return {
    type: send.type,
    title: send.title,
    message: send.message ?? "",
  };
}

/**
 * Validate and shape the payload.
 *
 * `type` is trimmed and bounded to the 50 characters the column holds; the
 * server would reject it, but a client-side error next to the field is the
 * difference between "fix this" and "the save failed".
 */
export function buildNotificationPayload(
  values: NotificationFormValues,
): FormResult<{ type: string; title: string; message: string | null }> {
  const type = values.type.trim();
  if (type === "") return { ok: false, error: "Type is required." };
  if (type.length > 50) {
    return { ok: false, error: "Type cannot be longer than 50 characters." };
  }

  const title = requiredText(values.title, "Title", { max: 255 });
  if (!title.ok) return title;

  const message = optionalText(values.message, "Message", 1000);
  if (!message.ok) return message;

  return { ok: true, value: { type, title: title.value, message: message.value } };
}
