"use client";

import { Pencil, Trash2 } from "lucide-react";
import { IconAction } from "@/components/admin/primitives";
import { DeleteConfirm } from "@/components/admin/CatalogDialog";

/**
 * The edit / delete control cluster for a catalogue table row.
 *
 * Extracted because the interesting part is what is **absent**: there is no View
 * button. The old `RowActions` primitive in `primitives.tsx` offered View, Edit
 * and Delete for every row of every panel, and all three were toasts — an
 * affordance that claims an action and performs none. The panels that now use
 * this cluster open a real form, so a View button that duplicated the Edit
 * dialog would be a second control doing the same thing with a different icon.
 *
 * The delete confirmation is inlined rather than delegated to a `window.confirm`
 * for the reason in `DeleteConfirm`.
 */
export function RowCrudActions({
  noun,
  canWrite,
  canDelete,
  busy,
  deleting,
  onEdit,
  onDelete,
  onCancelDelete,
}: {
  noun: string;
  canWrite: boolean;
  canDelete: boolean;
  /** A write is in flight against this row. */
  busy: boolean;
  /** This row is the one being confirmed for deletion. */
  deleting: boolean;
  onEdit: () => void;
  /** Arms the confirmation. */
  onDelete: () => void;
  /** Disarms the confirmation. */
  onCancelDelete: () => void;
}) {
  if (deleting) {
    return <DeleteConfirm disabled={busy} onConfirm={onDelete} onCancel={onCancelDelete} />;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canWrite && (
        <IconAction title={`Edit ${noun}`} onClick={onEdit} disabled={busy}>
          <Pencil className="h-4 w-4" />
        </IconAction>
      )}
      {canDelete && (
        <IconAction
          title={`Delete ${noun}`}
          onClick={onDelete}
          disabled={busy}
          className="hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </IconAction>
      )}
    </div>
  );
}
