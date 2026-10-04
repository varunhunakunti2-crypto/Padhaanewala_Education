"use client";

import { useCallback, useState } from "react";
import { useApp } from "@/lib/context/AppContext";
import { useAdminResource } from "@/components/admin/useAdminResource";
import {
  CATALOG_DELETE_ROLES,
  CATALOG_WRITE_ROLES,
  describeWriteError,
  hasAnyRole,
  type FormResult,
} from "@/lib/form-parts";

/**
 * The create / edit / delete state machine shared by the five catalogue panels.
 *
 * ## Why this is a hook and not copy-pasted
 *
 * `CollegesSection` grew this logic first and the other four panels needed the
 * same thing. Written out five more times it would be five chances to get one
 * half of the safety behaviour wrong, and the halves are not separable:
 *
 *  - `values` starts as `null`, not the empty form. `PUT` applies
 *    `model_dump(exclude_unset=True)` but *does* write any key it receives as
 *    `null`, so submitting a form that was never filled from the server clears
 *    every optional column on the record. A create dialog can open with defaults;
 *    an edit dialog cannot open at all until its detail fetch resolves.
 *  - The write goes through `describeWriteError` so a 400-duplicate, a 403 and a
 *    422 each read as the thing an admin can act on, rather than as a toast
 *    carrying a raw FastAPI payload.
 *  - Delete is two-step. `DELETE` on all five routers is a hard delete on a table
 *    with real rows behind it, and one mis-click is unrecoverable.
 *  - `busyRow` disables the icons on the row being written, so a double submit
 *    cannot create two records.
 *
 * Each of those is a bug this repository has already shipped a version of. The
 * hook exists so the panels differ only in their *fields* and their *columns*,
 * which is the part that genuinely differs per entity.
 *
 * ## The two role gates
 *
 * `canWrite` is `CONTENT_ROLES` — super_admin, admin, content_manager — because
 * all five routers gate `POST` and `PUT` on it. `canDelete` is read per entity
 * from `CATALOG_DELETE_ROLES`, which is *not* uniform: four of the five require
 * `ADMIN_ROLES` and `/faqs` alone accepts a content manager.
 *
 * Both are any-of checks over the full role list, via `hasAnyRole`. Do not
 * collapse either gate back to a single "minimum role" name tested with
 * `roles.includes(...)`: role membership is not implied by rank, so that form
 * denies a `super_admin`-only user a Delete button the API would have honoured.
 *
 * A panel that renders one Delete button for everyone either 403s a content
 * manager four times out of five, or hides a capability that genuinely exists.
 */
export type CrudMode = "create" | "update";

export type CrudDialog =
  | { mode: "create" }
  | { mode: "update"; ref: string; label: string }
  | null;

export interface CrudOptions<T, V> {
  /** Noun for error copy: "course", "scholarship", "exam", "article", "FAQ". */
  noun: string;
  /** Entity key into `CATALOG_DELETE_ROLES`. */
  entity: keyof typeof CATALOG_DELETE_ROLES;
  /** The list request. Usually `adminApi.<entity>s()`. */
  load: () => Promise<T[]>;
  /** Copy shown when the list request fails. */
  unreachableMessage: string;
  /**
   * The empty form for a create. Shared by reference — callers pass the
   * `EMPTY_*_FORM` constant and it is never mutated.
   */
  emptyValues: V;
  /**
   * The detail request for an edit.
   *
   * `null` for entities whose list row already carries every field the form
   * edits — which is `blog`, because `get_blog` filters to published posts and
   * a draft is a 404. When supplied, the dialog stays in its loading state
   * until this resolves, and stays closed if it rejects.
   */
  loadDetail?: (row: T) => Promise<V>;
  /** Maps a table row to its `PUT`/`DELETE` key. Always the numeric id. */
  refFor: (row: T) => string;
  /** A human name for a row, for toasts and the dialog title. */
  labelFor: (row: T) => string;
  /** Validates and shapes the payload. Returns the error rather than throwing. */
  build: (values: V, mode: CrudMode) => FormResult<Record<string, unknown>>;
  /** `POST`. The resolved value is only read for its `name`, if it has one. */
  create: (payload: Record<string, unknown>) => Promise<{ name?: string } | void>;
  /** `PUT` by ref. */
  update: (ref: string, payload: Record<string, unknown>) => Promise<{ name?: string } | void>;
  /** `DELETE` by ref. */
  remove: (ref: string) => Promise<void>;
  /** Optional: prefill straight from the row when `loadDetail` is absent. */
  valuesFromRow?: (row: T) => V;
}

export interface CrudState<T, V> {
  rows: T[];
  error: string | null;
  loading: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dialog: CrudDialog;
  /** `null` until the form is safe to show. See the file note. */
  values: V | null;
  formError: string | null;
  submitting: boolean;
  busyRow: string | null;
  pendingDelete: string | null;
  openCreate: () => void;
  openEdit: (row: T) => void;
  setValues: (values: V) => void;
  closeDialog: () => void;
  submit: () => void;
  confirmDelete: (row: T) => void;
  armDelete: (ref: string) => void;
  cancelDelete: () => void;
}

export function useCatalogCrud<T extends { id: number }, V>(
  opts: CrudOptions<T, V>,
): CrudState<T, V> {
  const { noun, entity, load, unreachableMessage, emptyValues, loadDetail, refFor, labelFor, build, create, update, remove, valuesFromRow } = opts;

  const { showToast, roles } = useApp();
  const { data, error, loading, reload } = useAdminResource<T[]>(load, { unreachableMessage });

  const canWrite = hasAnyRole(roles, CATALOG_WRITE_ROLES);
  const canDelete = hasAnyRole(roles, CATALOG_DELETE_ROLES[entity]);

  const [dialog, setDialog] = useState<CrudDialog>(null);
  const [values, setValues] = useState<V | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setValues(null);
    setFormError(null);
  }, []);

  const openCreate = useCallback(() => {
    setValues({ ...emptyValues });
    setFormError(null);
    setDialog({ mode: "create" });
  }, [emptyValues]);

  const openEdit = useCallback(
    (row: T) => {
      const ref = refFor(row);
      const label = labelFor(row);

      // The list row is enough for `blog`, and `get_blog` would 404 on a draft.
      if (!loadDetail) {
        if (!valuesFromRow) return;
        setValues(valuesFromRow(row));
        setFormError(null);
        setDialog({ mode: "update", ref, label });
        return;
      }

      setDialog({ mode: "update", ref, label });
      // `null`, not defaults: the dialog renders a loading state and its save
      // button stays disabled until the server's copy is in hand.
      setValues(null);
      setFormError(null);
      setBusyRow(ref);
      loadDetail(row)
        .then((detail) => setValues(detail))
        .catch((err: unknown) => {
          showToast({
            title: `Could not load the ${noun}`,
            description: describeWriteError(err, noun),
            variant: "error",
          });
          closeDialog();
        })
        .finally(() => setBusyRow(null));
    },
    [loadDetail, valuesFromRow, refFor, labelFor, closeDialog, noun, showToast],
  );

  const submit = useCallback(() => {
    if (dialog === null || values === null) return;

    const built = build(values, dialog.mode);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const finish = (title: string, name: string) => {
      showToast({ title, description: name, variant: "success" });
      closeDialog();
      reload();
    };

    const call =
      dialog.mode === "create"
        ? create(built.value).then((r) => finish(`${cap(noun)} created`, r?.name ?? noun))
        : update(dialog.ref, built.value).then((r) => finish(`${cap(noun)} updated`, r?.name ?? dialog.label));

    call
      .catch((err: unknown) => setFormError(describeWriteError(err, noun)))
      .finally(() => setSubmitting(false));
  }, [dialog, values, build, create, update, closeDialog, reload, noun, showToast]);

  const confirmDelete = useCallback(
    (row: T) => {
      const ref = refFor(row);
      const label = labelFor(row);
      setPendingDelete(null);
      setBusyRow(ref);
      remove(ref)
        .then(() => {
          showToast({ title: "Deleted", description: label, variant: "success" });
          reload();
        })
        .catch((err: unknown) => {
          showToast({
            title: "Could not delete",
            description: describeWriteError(err, noun),
            variant: "error",
          });
        })
        .finally(() => setBusyRow(null));
    },
    [refFor, labelFor, remove, reload, noun, showToast],
  );

  const armDelete = useCallback((ref: string) => setPendingDelete(ref), []);

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  return {
    rows: data ?? [],
    error,
    loading,
    canWrite,
    canDelete,
    dialog,
    values,
    formError,
    submitting,
    busyRow,
    pendingDelete,
    openCreate,
    openEdit,
    setValues,
    closeDialog,
    submit,
    confirmDelete,
    armDelete,
    cancelDelete,
  };
}

/** "FAQ" -> "FAQ", "course" -> "Course". Enough for the create toast. */
function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
