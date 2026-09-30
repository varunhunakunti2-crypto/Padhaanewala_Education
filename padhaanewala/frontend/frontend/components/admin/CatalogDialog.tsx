"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * The modal shell every catalogue form sits in.
 *
 * ## The loading branch is the important one
 *
 * `useCatalogCrud` holds `values` as `null` until an edit's detail request has
 * resolved, and this component renders a loading state for that instead of the
 * empty form. This is a correctness requirement, not a loading nicety: `PUT`
 * applies `model_dump(exclude_unset=True)`, so a key that is *absent* leaves the
 * column alone — but a key that is present and `null` is written, and it clears
 * the column. A dialog that opened with defaults and let the admin press Save
 * before the fetch landed would silently blank every optional field on the
 * record while reporting "updated".
 *
 * ## `aria-live` on the error line
 *
 * A rejected save has to be announced, not merely drawn. The line is present in
 * the DOM with `min-h-5` whether or not there is an error, so its height does not
 * jump when the message appears and the buttons below it stay put.
 */
export function CatalogDialog({
  open,
  title,
  mode,
  loading,
  formError,
  submitting,
  onClose,
  onSubmit,
  createLabel,
  children,
}: {
  open: boolean;
  title: string;
  mode: "create" | "update";
  /** Edit dialogs with an unfetched detail. */
  loading?: boolean;
  formError: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  /** Button text in create mode. */
  createLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="sm:max-w-3xl">
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <div>
          {children}

          <p aria-live="polite" className="min-h-5 text-sm text-red-600">
            {formError ?? ""}
          </p>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving…" : mode === "create" ? createLabel : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * The inline, two-step delete confirmation.
 *
 * `DELETE` on these five routers is a hard delete. There is no archive, no
 * `is_active` fallback, and for four of the five the delete role is *higher* than
 * the write role — so the action that destroys data is the one an ordinary content
 * manager cannot perform by accident. A single unconfirmed click on a shared
 * admin account is still the common case, hence the two buttons rather than a
 * native `confirm()`, which is blocked in some embedded contexts and gives no
 * room to name what is about to go.
 */
export function DeleteConfirm({ disabled, onConfirm, onCancel }: {
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="inline-flex h-7 items-center rounded-lg bg-red-500 px-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
      >
        Delete anyway
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
      >
        Cancel
      </button>
    </div>
  );
}
