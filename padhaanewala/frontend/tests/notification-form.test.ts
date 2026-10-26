import { describe, expect, it } from "vitest";

import type { AdminNotificationSend } from "@/lib/api";
import {
  EMPTY_NOTIFICATION_FORM,
  buildNotificationPayload,
  notificationFormFromSend,
  notificationSendRef,
  parseNotificationSendRef,
  toNotificationSendRow,
  type NotificationFormValues,
} from "@/lib/notification-form";

/**
 * The notification form and the send/row mapping.
 *
 * The interesting failures here are silent ones, as in `catalog-forms.test.ts`:
 *
 *  - An empty `message` must become `null`, not `""`, because the column is
 *    nullable and a blank string is a different value.
 *  - The API's `NotificationUpdate` caps the message at 1000, which is also the
 *    column width. Over that, create returns a 500 and update a 422 — the same
 *    typo with two symptoms — so the builder has to catch it before either.
 *  - A send's `PUT`/`DELETE` target depends on whether it has a `batch_id`.
 *    Getting that backwards edits one student's copy of a broadcast, and the
 *    request still returns 200.
 */

const SEND: AdminNotificationSend = {
  notification_id: 42,
  batch_id: "abc123",
  type: "exam",
  title: "JEE Main date",
  message: "Registration opens on 1 March.",
  channel: "in_app",
  recipients: 14,
  read_count: 3,
  created_at: "2026-10-26T10:00:00Z",
};

function ok<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`expected a valid payload, got: ${result.error}`);
  return result.value;
}

function err(result: { ok: true; value: unknown } | { ok: false; error: string }): string {
  if (result.ok) throw new Error("expected a validation error, got a payload");
  return result.error;
}

function form(overrides: Partial<NotificationFormValues> = {}): NotificationFormValues {
  return { type: "general", title: "Title", message: "", ...overrides };
}

describe("buildNotificationPayload", () => {
  it("trims the fields and turns an empty message into null", () => {
    const payload = ok(
      buildNotificationPayload(
        form({ type: "  exam  ", title: "  Dates out  ", message: "   " }),
      ),
    );
    expect(payload).toEqual({ type: "exam", title: "Dates out", message: null });
  });

  it("keeps a real message", () => {
    const payload = ok(buildNotificationPayload(form({ message: " Apply by 30 April. " })));
    expect(payload.message).toBe("Apply by 30 April.");
  });

  it("requires a title, because the schema does", () => {
    // `NotificationCreate.title` is `min_length=1`; an empty box is a 422 that
    // reads like a server fault unless it is caught here.
    expect(err(buildNotificationPayload(form({ title: "   " })))).toMatch(/title is required/i);
  });

  it("rejects a title over the 255-character column", () => {
    expect(err(buildNotificationPayload(form({ title: "x".repeat(256) })))).toMatch(/255/);
  });

  it("rejects a message over the 1000-character column", () => {
    expect(err(buildNotificationPayload(form({ message: "x".repeat(1001) })))).toMatch(/1000/);
  });

  it("requires a type and bounds it to 50 characters", () => {
    expect(err(buildNotificationPayload(form({ type: "  " })))).toMatch(/type is required/i);
    expect(err(buildNotificationPayload(form({ type: "x".repeat(51) })))).toMatch(/50/);
  });
});

describe("send references", () => {
  it("addresses a broadcast by its batch and a legacy row by its id", () => {
    expect(notificationSendRef({ batch_id: "abc123", id: 7 })).toBe("batch:abc123");
    expect(notificationSendRef({ batch_id: null, id: 7 })).toBe("single:7");
  });

  it("round-trips both shapes", () => {
    expect(parseNotificationSendRef("batch:abc123")).toEqual({
      kind: "batch",
      batchId: "abc123",
    });
    expect(parseNotificationSendRef("single:7")).toEqual({ kind: "single", id: 7 });
  });

  it("refuses a malformed reference instead of producing NaN", () => {
    // `Number("abc")` is NaN and `NaN` in a URL is a 422 far from the cause.
    for (const ref of ["", "batch:", "single:", "single:abc", "single:0", "nonsense"]) {
      expect(parseNotificationSendRef(ref), ref || "(empty)").toBeNull();
    }
  });
});

describe("row mapping", () => {
  it("mirrors notification_id as the numeric id the CRUD hook keys on", () => {
    const row = toNotificationSendRow(SEND);
    expect(row.id).toBe(42);
    expect(notificationSendRef(row)).toBe("batch:abc123");
  });

  it("prefills the form, with a null message shown as an empty box", () => {
    expect(notificationFormFromSend(toNotificationSendRow(SEND))).toEqual({
      type: "exam",
      title: "JEE Main date",
      message: "Registration opens on 1 March.",
    });
    expect(
      notificationFormFromSend(toNotificationSendRow({ ...SEND, message: null })),
    ).toEqual({ type: "exam", title: "JEE Main date", message: "" });
  });

  it("starts a create with a non-empty type", () => {
    // `NotificationCreate.type` is required; a dialog that opened with "" would
    // fail validation on the first press for a field the admin never touched.
    expect(EMPTY_NOTIFICATION_FORM.type).not.toBe("");
    expect(EMPTY_NOTIFICATION_FORM.title).toBe("");
  });
});
