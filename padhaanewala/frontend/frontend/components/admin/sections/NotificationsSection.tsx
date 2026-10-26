"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { adminApi } from "@/lib/api";
import {
  EMPTY_NOTIFICATION_FORM,
  buildNotificationPayload,
  notificationFormFromSend,
  notificationSendRef,
  parseNotificationSendRef,
  toNotificationSendRow,
  type NotificationFormValues,
  type NotificationSendRow,
} from "@/lib/notification-form";

import { SectionHeading } from "@/components/admin/primitives";
import { RowCrudActions } from "@/components/admin/RowCrudActions";
import { CatalogDialog } from "@/components/admin/CatalogDialog";
import { useCatalogCrud } from "@/components/admin/useCatalogCrud";
import { NotificationFormFields } from "@/components/admin/sections/NotificationForm";

/**
 * A table row: `DataTable` keys rows by a string `id`, while the CRUD hook and
 * the API work with the numeric send. `record` keeps the original so the row
 * actions never have to re-derive it from the string.
 */
interface NotificationRow extends Omit<NotificationSendRow, "id"> {
  id: string;
  record: NotificationSendRow;
}

/**
 * The broadcast console: send, edit and retract platform notifications.
 *
 * ## Reads are `admin`, writes are `super_admin`
 *
 * `GET /notifications/sends` is open to `ADMIN_ROLES` — answering "did the
 * announcement go out?" is a support task. Every mutation is
 * `SUPER_ADMIN_ROLES`: a broadcast is an unrecallable mass write into student
 * inboxes, so it sits above the content roles. A plain admin therefore sees the
 * log with no Add button and no row actions, and a banner says why rather than
 * leaving them to discover it as a 403.
 *
 * `writeRoles` is passed explicitly. The hook's default is `CONTENT_ROLES`,
 * which would render controls an admin can click and the API would refuse.
 *
 * ## Why the list is `/sends` and not `/notifications`
 *
 * The table is one row per *send*, which is not how the rows are stored. A
 * broadcast is fanned out into one notification row per student, so the raw log
 * shows a 14-student announcement as 14 rows and a 500-student one as 500 — and
 * because that endpoint is paginated per row, grouping it in the browser would
 * report the page size as the audience. `/sends` does the grouping in SQL and
 * returns the real `recipients` and `read_count`.
 *
 * ## Edit and delete act on a whole send
 *
 * Editing addresses `PUT /notifications/batch/{batch_id}` and retracting addresses
 * `DELETE /notifications/batch/{batch_id}`, so changing a typo fixes every
 * recipient's copy instead of one student's. Rows written before `batch_id`
 * existed have no send to address; those fall back to the single-row endpoints.
 * `notificationSendRef` / `parseNotificationSendRef` own that decision in both
 * directions, so the table and the write path cannot disagree.
 */
export function NotificationsSection() {
  const crud = useCatalogCrud<NotificationSendRow, NotificationFormValues>({
    noun: "notification",
    entity: "notification",
    writeRoles: ["super_admin"],
    load: async () => (await adminApi.notificationSends()).map(toNotificationSendRow),
    unreachableMessage: "Could not reach the notifications API.",
    emptyValues: EMPTY_NOTIFICATION_FORM,
    // The list row already carries every field the form edits, so there is no
    // detail request and the edit dialog can open immediately.
    valuesFromRow: notificationFormFromSend,
    refFor: notificationSendRef,
    labelFor: (send) =>
      `${send.title} (${send.recipients} recipient${send.recipients === 1 ? "" : "s"})`,
    build: buildNotificationPayload,
    create: async (payload) => {
      // No `user_id`: this is a broadcast, fanned out to every active student.
      // The response reports how many rows were written, so the toast states
      // the real audience instead of implying a delivery that did not happen.
      const sent = await adminApi.createNotification(payload);
      return {
        name: `${sent.created} recipient${sent.created === 1 ? "" : "s"}`,
      };
    },
    update: async (ref, payload) => {
      const target = parseNotificationSendRef(ref);
      if (target === null) {
        throw new Error(`Unrecognised notification reference: ${ref}`);
      }
      if (target.kind === "batch") {
        const result = await adminApi.updateNotificationBatch(target.batchId, payload);
        const title = typeof payload.title === "string" ? payload.title : "Notification";
        return {
          name: `${title} — ${result.affected} recipient${result.affected === 1 ? "" : "s"}`,
        };
      }
      const updated = await adminApi.updateNotification(target.id, payload);
      return { name: updated.title };
    },
    remove: async (ref) => {
      const target = parseNotificationSendRef(ref);
      if (target === null) {
        throw new Error(`Unrecognised notification reference: ${ref}`);
      }
      if (target.kind === "batch") {
        await adminApi.deleteNotificationBatch(target.batchId);
        return;
      }
      await adminApi.deleteNotification(target.id);
    },
  });

  // The row being edited, for the "applies to N recipients" note. Derived from
  // the ref rather than stored separately, so it cannot go stale after a reload.
  // Bound to a local first: TypeScript cannot narrow `crud.dialog` inside the
  // `find` callback of a ternary.
  const updateRef = crud.dialog?.mode === "update" ? crud.dialog.ref : null;
  const editing =
    updateRef === null
      ? null
      : (crud.rows.find((row) => notificationSendRef(row) === updateRef) ?? null);

  const rows = useMemo<NotificationRow[]>(
    () =>
      crud.rows.map((send) => ({
        ...send,
        id: notificationSendRef(send),
        record: send,
      })),
    [crud.rows],
  );

  const dialogTitle =
    crud.dialog === null
      ? "Notification"
      : crud.dialog.mode === "create"
        ? "Send notification"
        : "Edit notification";

  return (
    <div>
      <SectionHeading
        title="Push notifications"
        description="Announcements delivered to every active student account"
        count={crud.rows.length}
        action={
          crud.canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={crud.openCreate}>
              <Plus className="h-4 w-4" /> New notification
            </Button>
          ) : undefined
        }
      />

      {!crud.canWrite && (
        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Read-only: sending, editing and retracting notifications requires the
          super admin role. You can still see what went out and how many
          students read it.
        </p>
      )}

      {crud.error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{crud.error}</p>
      ) : crud.loading && crud.rows.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading notifications…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "title",
              header: "Title",
              render: (row) => (
                <div>
                  <span className="font-semibold text-gray-900">{row.record.title}</span>
                  {row.record.message && (
                    <span className="mt-0.5 block max-w-xl text-xs text-slate-400">
                      {row.record.message}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (row) => (
                <Badge variant="purple">
                  {row.record.type.charAt(0).toUpperCase() + row.record.type.slice(1)}
                </Badge>
              ),
            },
            {
              key: "recipients",
              header: "Audience",
              render: (row) => (
                <span className="text-sm text-slate-600">
                  {row.record.recipients.toLocaleString("en-IN")}{" "}
                  {row.record.recipients === 1 ? "recipient" : "recipients"}
                </span>
              ),
            },
            {
              key: "read_count",
              header: "Read",
              render: (row) => (
                <Badge
                  variant={
                    row.record.read_count === row.record.recipients
                      ? "green"
                      : row.record.read_count === 0
                        ? "gray"
                        : "yellow"
                  }
                >
                  {row.record.read_count.toLocaleString("en-IN")} /{" "}
                  {row.record.recipients.toLocaleString("en-IN")}
                </Badge>
              ),
            },
            {
              key: "created_at",
              header: "Sent",
              render: (row) => (
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {new Date(row.record.created_at).toLocaleString("en-IN")}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (row) => {
                const ref = row.id;
                return (
                  <RowCrudActions
                    noun="notification"
                    canWrite={crud.canWrite}
                    canDelete={crud.canDelete}
                    busy={crud.busyRow === ref || crud.submitting}
                    deleting={crud.pendingDelete === ref}
                    onEdit={() => crud.openEdit(row.record)}
                    onDelete={
                      crud.pendingDelete === ref
                        ? () => crud.confirmDelete(row.record)
                        : () => crud.armDelete(ref)
                    }
                    onCancelDelete={crud.cancelDelete}
                  />
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["title", "message", "type"]}
          searchPlaceholder="Search notifications..."
          emptyState="No notifications sent yet."
        />
      )}

      <CatalogDialog
        open={crud.dialog !== null}
        title={dialogTitle}
        mode={crud.dialog?.mode ?? "create"}
        formError={crud.formError}
        submitting={crud.submitting}
        onClose={crud.closeDialog}
        onSubmit={crud.submit}
        createLabel="Send to all students"
      >
        {crud.values && (
          <NotificationFormFields
            values={crud.values}
            onChange={crud.setValues}
            mode={crud.dialog?.mode ?? "create"}
            audience={
              editing
                ? `${editing.recipients} recipient${editing.recipients === 1 ? "" : "s"}`
                : "every active student account"
            }
            disabled={crud.submitting}
          />
        )}
      </CatalogDialog>
    </div>
  );
}
