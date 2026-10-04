"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input, Label } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, isForbidden } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading } from "@/components/admin/primitives";

/**
 * Notification broadcast log, backed by `GET/POST /api/v1/notifications`.
 *
 * The list endpoint is admin-only; students read their own via `/notifications/my`.
 *
 * ## This panel used to display three different things and none of them was the log
 *
 * 1. `adminApi.notifications()` called `GET /api/v1/notifications`, which did not
 *    exist. The request 405'd, so the panel always rendered its error banner.
 * 2. With no real rows, it fell back to **this browser's own** `cp_notifications`
 *    localStorage inbox — so an admin with personal notifications in the browser
 *    saw those presented as the platform-wide broadcast history, and an admin
 *    without them saw nothing.
 * 3. With neither, it rendered a hardcoded row reading "No notifications sent yet".
 *    That row was indistinguishable from a genuinely empty log, which is the one
 *    thing this screen exists to answer.
 *
 * All three are gone. The table now shows only what `GET /notifications` returns,
 * an empty log renders `DataTable`'s own empty state, and a failed read renders
 * the error and no table at all — because a broadcast log that cannot be read
 * must not look like a broadcast log with nothing in it.
 */
export function NotificationsSection() {
  const { showToast } = useApp();
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState({ title: "", message: "", type: "general" });

  const { data, error, loading, reload } = useAdminResource(
    () => adminApi.notifications(),
    {
      forbiddenMessage: "You do not have permission to view the broadcast log.",
      unreachableMessage: "Could not reach the notifications API.",
    },
  );

  const rows = useMemo(
    () =>
      (data ?? []).map((n) => ({
        id: String(n.id),
        title: n.title,
        message: n.message ?? "",
        type: n.type,
        recipient: n.username ?? `user #${n.user_id}`,
        status: n.is_read ? "Read" : "Unread",
        created: new Date(n.created_at).toLocaleString("en-IN"),
      })),
    [data],
  );

  const send = async () => {
    if (!draft.title.trim() || !draft.message.trim()) return;
    setSending(true);
    try {
      // No `user_id`: this is a broadcast. The endpoint fans it out to every
      // active student and reports how many rows it wrote, so the toast states
      // the real audience instead of implying a delivery that may not have
      // happened.
      const result = await adminApi.createNotification({
        title: draft.title.trim(),
        message: draft.message.trim(),
        type: draft.type,
      });
      setDraft({ title: "", message: "", type: "general" });
      reload();
      showToast({
        title: "Broadcast sent",
        description: `Delivered to ${result.created} active student account${result.created === 1 ? "" : "s"}.`,
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not send notification",
        description: isForbidden(err) ? "You lack permission." : "Please retry.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Push notifications"
        description="Broadcast alerts to every active student account"
        count={rows.length}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Label htmlFor="notif-type">Type</Label>
          <select
            id="notif-type"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {["general", "admission", "exam", "scholarship"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="JEE Main registration opens"
          />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="notif-message">Message</Label>
          <textarea
            id="notif-message"
            rows={3}
            value={draft.message}
            onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
            placeholder="Registration for JEE Main 2027 opens on 1 March."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="button" size="sm" variant="primary" disabled={sending} onClick={send}>
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send broadcast"}
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading broadcast log…
        </p>
      ) : (
        <DataTable
          columns={[
            {
              key: "title",
              header: "Title",
              render: (r) => <span className="font-semibold text-gray-900">{r.title}</span>,
            },
            { key: "message", header: "Message" },
            { key: "type", header: "Type" },
            { key: "recipient", header: "Recipient" },
            { key: "created", header: "Created" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge variant={r.status === "Unread" ? "yellow" : "gray"}>{r.status}</Badge>
              ),
            },
          ]}
          rows={rows}
          searchKeys={["title", "message", "recipient"]}
          searchPlaceholder="Search notifications..."
          emptyState={
            error
              ? "The broadcast log could not be read."
              : "No notifications sent yet."
          }
        />
      )}
    </div>
  );
}
