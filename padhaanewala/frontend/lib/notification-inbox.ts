import type { StudentNotification } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

/**
 * Mapping the server inbox into the shape the account page renders.
 *
 * ## Why ids are prefixed
 *
 * `AppContext.notifications` is a mixed list: rows this browser created
 * (`local-…`, from before there was an inbox API) and rows the server delivered.
 * Both have to be distinguishable, because only one of them can be marked read
 * or persisted:
 *
 *  - `markNotificationRead` has to know which backend id to call, and a local
 *    row has none.
 *  - `localStorage` must not keep server rows. A retracted broadcast would
 *    otherwise reappear on the next load from a cached copy of itself, which is
 *    exactly the failure a "delete" button is supposed to prevent.
 *
 * The prefix is the whole mechanism, so it lives here rather than as a
 * `startsWith` in two call sites.
 */
export const API_NOTIFICATION_PREFIX = "api-";

/** The four types `NotificationItem` allows; the API stores a free string. */
const ITEM_TYPES: ReadonlySet<string> = new Set<NotificationItem["type"]>([
  "admission",
  "exam",
  "scholarship",
  "general",
]);

export function isApiNotification(item: Pick<NotificationItem, "id">): boolean {
  return item.id.startsWith(API_NOTIFICATION_PREFIX);
}

/**
 * The server id behind a prefixed inbox id, or `null` for a local row.
 *
 * Validates the digits rather than trusting `Number`: `Number("")` is `0` and
 * `Number("abc")` is `NaN`, and `PUT /notifications/NaN/read` answers 422 with a
 * message about the request, not about the row.
 */
export function apiNotificationId(id: string): number | null {
  if (!id.startsWith(API_NOTIFICATION_PREFIX)) return null;
  const raw = id.slice(API_NOTIFICATION_PREFIX.length);
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function notificationFromApi(row: StudentNotification): NotificationItem {
  return {
    id: `${API_NOTIFICATION_PREFIX}${row.id}`,
    title: row.title,
    message: row.message ?? "",
    date: row.created_at,
    read: row.is_read,
    // A type outside the four the UI knows (an admin can send any string) is
    // shown as `general` rather than dropped: the message is the content, and
    // the badge is decoration.
    type: (ITEM_TYPES.has(row.type) ? row.type : "general") as NotificationItem["type"],
  };
}

/**
 * Replace the server half of the inbox and keep the local half.
 *
 * Server rows go first because `/notifications/my` is ordered newest first, and
 * the page renders the list in order. Local rows are the ones written by earlier
 * builds and are never re-fetched, so they have to survive the refresh — dropping
 * them would make a browser upgrade silently delete a user's history.
 */
export function mergeApiNotifications(
  previous: NotificationItem[],
  rows: StudentNotification[],
): NotificationItem[] {
  const local = previous.filter((item) => !isApiNotification(item));
  return [...rows.map(notificationFromApi), ...local];
}

/** The local-only rows, for persistence. */
export function localNotifications(items: NotificationItem[]): NotificationItem[] {
  return items.filter((item) => !isApiNotification(item));
}

/**
 * "now", "5m", "3h", "2d", then a date.
 *
 * The bell shows six rows in a 320px panel, so a full timestamp would take the
 * space the message needs. Anything older than a week is a date rather than a
 * count of days ("23d" tells you less than "3 Oct").
 *
 * `now` is a parameter so the output is testable; the component passes nothing.
 * A future timestamp — clock skew between the server and the browser — is
 * clamped to "now" instead of producing "-3m".
 */
export function formatNotificationAge(value: string, now: number = Date.now()): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
