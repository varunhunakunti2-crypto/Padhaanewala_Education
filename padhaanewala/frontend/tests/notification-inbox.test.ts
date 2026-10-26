import { describe, expect, it } from "vitest";

import type { StudentNotification } from "@/lib/api";
import {
  API_NOTIFICATION_PREFIX,
  apiNotificationId,
  formatNotificationAge,
  isApiNotification,
  localNotifications,
  mergeApiNotifications,
  notificationFromApi,
} from "@/lib/notification-inbox";
import type { NotificationItem } from "@/lib/types";

/**
 * The bridge between `/notifications/my` and the account page.
 *
 * Three failures this file pins down, none of which throws:
 *
 *  1. A server row persisted to `cp_notifications` comes back after the admin
 *     retracts the broadcast — the delete works, and the student still sees it.
 *  2. A local row dropped during a refresh disappears from a user's history even
 *     though nothing was deleted.
 *  3. An unknown `type` (the API accepts any string) either crashes the badge or
 *     silently drops the message.
 */

const ROW: StudentNotification = {
  id: 7,
  user_id: 19,
  type: "exam",
  title: "JEE Main dates",
  message: "Registration opens on 1 March.",
  data: null,
  is_read: false,
  channel: "in_app",
  created_at: "2026-10-26T10:00:00Z",
};

function local(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "local-1",
    title: "Old local row",
    message: "Written by a previous build",
    date: "2026-01-01T00:00:00Z",
    read: true,
    type: "general",
    ...overrides,
  };
}

describe("notificationFromApi", () => {
  it("prefixes the id so a server row is distinguishable from a local one", () => {
    const item = notificationFromApi(ROW);
    expect(item.id).toBe(`${API_NOTIFICATION_PREFIX}7`);
    expect(isApiNotification(item)).toBe(true);
    expect(apiNotificationId(item.id)).toBe(7);
  });

  it("maps the read flag and falls back to an empty message", () => {
    const item = notificationFromApi({ ...ROW, is_read: true, message: null });
    expect(item.read).toBe(true);
    expect(item.message).toBe("");
  });

  it("shows an unknown type as general instead of dropping the message", () => {
    // `NotificationCreate.type` is a free 50-char string; a server-side flow can
    // send "renewal" and the badge union has no member for it.
    const item = notificationFromApi({ ...ROW, type: "renewal" });
    expect(item.type).toBe("general");
    expect(item.title).toBe(ROW.title);
  });

  it("keeps every type the UI knows", () => {
    for (const type of ["admission", "exam", "scholarship", "general"] as const) {
      expect(notificationFromApi({ ...ROW, type }).type).toBe(type);
    }
  });
});

describe("apiNotificationId", () => {
  it("returns null for local rows and malformed server ids", () => {
    for (const id of [
      "local-1",
      "",
      "api-",
      "api-0",
      "api-01",
      "api-abc",
      "api--3",
      "api-1.5",
    ]) {
      expect(apiNotificationId(id), id || "(empty)").toBeNull();
    }
  });
});

describe("mergeApiNotifications", () => {
  it("replaces the server half and keeps the local rows", () => {
    const previous = [local(), notificationFromApi({ ...ROW, title: "Stale title" })];
    const merged = mergeApiNotifications(previous, [ROW]);

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("api-7");
    expect(merged[0].title).toBe("JEE Main dates");
    expect(merged[1]).toEqual(local());
  });

  it("drops a server row the API no longer returns (a retracted broadcast)", () => {
    const previous = [notificationFromApi(ROW), local()];
    expect(mergeApiNotifications(previous, []).map((item) => item.id)).toEqual(["local-1"]);
  });

  it("does not duplicate a row across two fetches", () => {
    const once = mergeApiNotifications([], [ROW]);
    const twice = mergeApiNotifications(once, [ROW]);
    expect(twice.filter((item) => item.id === "api-7")).toHaveLength(1);
  });
});

describe("localNotifications", () => {
  it("is what goes to localStorage, so a retraction stays retracted", () => {
    const items = [local(), notificationFromApi(ROW)];
    expect(localNotifications(items)).toEqual([local()]);
  });
});

describe("formatNotificationAge", () => {
  // Fixed clock: the bell's "5m" is only meaningful relative to a known now.
  const now = new Date("2026-10-26T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("says now for the last minute", () => {
    expect(formatNotificationAge(ago(0), now)).toBe("now");
    expect(formatNotificationAge(ago(59_000), now)).toBe("now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(formatNotificationAge(ago(5 * 60_000), now)).toBe("5m");
    expect(formatNotificationAge(ago(59 * 60_000), now)).toBe("59m");
    expect(formatNotificationAge(ago(3 * 3_600_000), now)).toBe("3h");
    expect(formatNotificationAge(ago(47 * 3_600_000), now)).toBe("1d");
    expect(formatNotificationAge(ago(6 * 86_400_000), now)).toBe("6d");
  });

  it("switches to a date after a week, where a day count stops helping", () => {
    const value = formatNotificationAge(ago(30 * 86_400_000), now);
    expect(value).not.toMatch(/^\d+d$/);
    expect(value).toContain("Sep");
  });

  it("clamps a future timestamp instead of printing a negative age", () => {
    expect(formatNotificationAge(ago(-90_000), now)).toBe("now");
  });

  it("returns nothing for an unparseable value rather than 'NaN'", () => {
    expect(formatNotificationAge("not-a-date", now)).toBe("");
  });
});
