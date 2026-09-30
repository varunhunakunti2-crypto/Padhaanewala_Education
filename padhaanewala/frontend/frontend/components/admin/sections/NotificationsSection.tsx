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
 */
export function NotificationsSection() {
  const { notifications, showToast } = useApp();
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState({ title: "", message: "", type: "general" });

  const { data, error, reload } = useAdminResource(() => adminApi.notifications(), {
    forbiddenMessage: "You do not have permission to view the broadcast log.",
    unreachableMessage: "Could not reach the notifications API.",
  });

  const rows = useMemo(
    () =>
      (data ?? []).map((n) => ({
        id: String(n.id),
        title: n.title,
        message: n.message,
        type: n.type,
        status: n.is_read ? "Read" : "Unread",
        created: new Date(n.created_at).toLocaleString("en-IN"),
      })),
    [data],
  );

  // Fall back to this browser's own inbox so the panel is never blank.
  const local = useMemo(
    () =>
      notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        status: n.read ? "Read" : "Unread",
        created: n.date,
      })),
    [notifications],
  );

  const merged = rows.length
    ? rows
    : local.length
      ? local
      : [
          {
            id: "empty",
            title: "No notifications sent yet",
            message: "Compose a broadcast using the form above.",
            type: "general",
            status: "—",
            created: "—",
          },
        ];

  const send = async () => {
    if (!draft.title.trim() || !draft.message.trim()) return;
    setSending(true);
    try {
      await adminApi.createNotification({
        title: draft.title.trim(),
        message: draft.message.trim(),
        type: draft.type,
      });
      setDraft({ title: "", message: "", type: "general" });
      reload();
      showToast({ title: "Notification sent", variant: "success" });
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
        description="Broadcast alerts to students"
        count={rows.length || local.length}
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

      <DataTable
        columns={[
          {
            key: "title",
            header: "Title",
            render: (r) => <span className="font-semibold text-gray-900">{r.title}</span>,
          },
          { key: "message", header: "Message" },
          { key: "type", header: "Type" },
          { key: "created", header: "Created" },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge variant={r.status === "Unread" ? "yellow" : "gray"}>{r.status}</Badge>
            ),
          },
        ]}
        rows={merged}
        searchKeys={["title", "message"]}
        searchPlaceholder="Search notifications..."
      />
    </div>
  );
}
