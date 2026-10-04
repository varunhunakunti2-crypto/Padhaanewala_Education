"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { adminApi, CONTENT_ROLES, type AdminMedia } from "@/lib/api";
import { ENTITY_LOADERS, mediaEntityLabel, type MediaEntityOption } from "@/lib/entity-options";
import {
  EMPTY_MEDIA_FORM,
  MEDIA_ACCEPT_ATTRIBUTE,
  MEDIA_ENTITY_TYPES,
  MEDIA_IMAGE_TYPES,
  buildMediaUpload,
  describeMediaError,
  formatBytes,
  mediaMaxBytes,
  validateMediaFile,
  type MediaFormValues,
} from "@/lib/media-form";
import { useApp } from "@/lib/context/AppContext";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";

import { SectionHeading, IconAction } from "@/components/admin/primitives";

/** `campus-logo.png` → `campus logo`. A starting point, not an answer. */
function altTextFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The media library, with a real upload path.
 *
 * This panel used to render a purple gradient tile with a college's initials and
 * called it an uploaded asset, and its "Upload" button fired a toast naming a
 * create flow that did not exist. `POST /media/upload` has been on the backend
 * since Phase 0 with no client ever calling it, which is why a college could not
 * be added properly: there was nowhere to put its logo.
 *
 * The validation, the payload and the error wording live in `lib/media-form.ts`
 * so they can be tested without a DOM. The decisions that are *not* about
 * rendering, and the ones worth knowing about:
 *
 *  - **`entity_id` is cleared when `entity_type` changes.** College `5` and
 *    course `5` are different rows, and leaving the number in place is how an
 *    image ends up attached to the wrong thing with nothing to indicate it.
 *  - **The file input is a real `<input type="file">`**, not a styled `<div>`.
 *    A drop zone built from a div is unreachable by keyboard and announces
 *    nothing; the native control is focusable, labelled, and the `accept`
 *    attribute pre-filters the OS picker.
 *  - **A failed pre-check clears the selection** rather than holding a file that
 *    cannot be sent, so the form never shows a "chosen" file the submit button
 *    would refuse.
 *  - **Delete is two-step and inline**, matching `CollegesSection`, because a
 *    single click here removes the bytes from disk as well as the row.
 */
export function MediaSection() {
  const { showToast, roles } = useApp();
  // Mirrors `require_role(*CONTENT_ROLES)` on the upload route. A reader without
  // one of these roles is shown the library and no upload control, rather than a
  // button that 403s.
  const canWrite = CONTENT_ROLES.some((role) => roles.includes(role));

  const { data, error, loading, reload } = useAdminResource<AdminMedia[]>(() => adminApi.media(), {
    unreachableMessage: "Could not reach the media API.",
  });
  const all = useMemo(() => data ?? [], [data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [values, setValues] = useState<MediaFormValues>(EMPTY_MEDIA_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [options, setOptions] = useState<{
    type: string;
    rows: MediaEntityOption[];
    error: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);

  // Object URLs are a leak, not a detail: each one pins the whole file in memory
  // until it is revoked, and the dialog is opened and closed repeatedly.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setValues(EMPTY_MEDIA_FORM);
    setFile(null);
    setFileError(null);
    setFormError(null);
    setOptions(null);
  }, []);

  /**
   * Options are fetched when the dialog opens rather than with the table, so
   * visiting the library costs one request instead of four. Re-fetched on every
   * type change, and tagged with the type they belong to so a response for a
   * type the admin has already navigated away from is ignored rather than
   * rendered — the id space is per-type, so the previous list is stale the
   * instant the type changes.
   */
  useEffect(() => {
    if (!dialogOpen) return;
    const type = values.entity_type;
    const load = ENTITY_LOADERS[type];
    if (!load) return;
    let ignore = false;
    load()
      .then((rows) => {
        if (ignore) return;
        setOptions({ type, rows, error: null });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        // Kept visible rather than swallowed: an empty dropdown reads as "there
        // are no colleges", and the admin would conclude the image cannot be
        // attached rather than that the list request failed.
        setOptions({ type, rows: [], error: describeMediaError(err) });
      });
    return () => {
      ignore = true;
    };
  }, [dialogOpen, values.entity_type]);

  // Loading, empty and error are all derived during render, so switching type
  // never needs an effect to clear state — the previous list simply stops
  // matching the type and is discarded.
  const noLoader = !ENTITY_LOADERS[values.entity_type];
  const currentOptions = options?.type === values.entity_type ? options : null;
  const optionRows = currentOptions?.rows ?? null;
  const optionsError = currentOptions?.error ?? null;
  const optionsLoading = dialogOpen && !noLoader && optionRows === null;

  const pickFile = (next: File | null) => {
    setFormError(null);
    if (!next) {
      setFile(null);
      setFileError(null);
      return;
    }
    const checked = validateMediaFile(next);
    if (!checked.ok) {
      setFile(null);
      setFileError(checked.error);
      return;
    }
    setFileError(null);
    setFile(next);
    setValues((v) => (v.alt_text.trim() === "" ? { ...v, alt_text: altTextFromName(next.name) } : v));
  };

  const submit = async () => {
    const built = buildMediaUpload(values, file);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await adminApi.uploadMedia(built.body);
      showToast({
        title: "Image uploaded",
        description: `${created.file_name ?? "Image"} → ${mediaEntityLabel(created.entity_type)} #${created.entity_id}`,
        variant: "success",
      });
      closeDialog();
      reload();
    } catch (err) {
      setFormError(describeMediaError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (record: AdminMedia) => {
    setPendingDelete(null);
    setBusyRow(record.id);
    try {
      await adminApi.deleteMedia(record.id);
      showToast({ title: "File deleted", description: record.file_name ?? undefined, variant: "success" });
      reload();
    } catch (err) {
      showToast({ title: "Could not delete", description: describeMediaError(err), variant: "error" });
    } finally {
      setBusyRow(null);
    }
  };

  const setValue = <K extends keyof MediaFormValues>(key: K, value: MediaFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const selectedEntityLabel = optionRows?.find((o) => String(o.id) === values.entity_id)?.label ?? null;

  return (
    <div>
      <SectionHeading
        title="Media library"
        description="College logos, covers and campus imagery"
        count={all.length}
        action={
          canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Upload image
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading media…</p>
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-sm text-slate-400">No files uploaded yet.</p>
          {canWrite && (
            <p className="mt-1 text-xs text-slate-400">
              A college can be created without a logo, but it will have none until an image is
              attached here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {all.map((m) => {
            const busy = busyRow === m.id;
            return (
              <div key={m.id} className="group overflow-hidden rounded-xl border border-slate-100">
                <div className="grid h-24 place-items-center bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.alt_text ?? m.file_name ?? ""}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-xs font-medium text-slate-600" title={m.file_name ?? undefined}>
                    {m.file_name ?? m.url}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {mediaEntityLabel(m.entity_type)}
                    {m.entity_id === null ? "" : ` #${m.entity_id}`}
                    {m.image_type ? ` · ${m.image_type}` : ""}
                  </p>
                  {m.file_size !== null && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatBytes(m.file_size)}</p>
                  )}
                </div>
                {canWrite && (
                  <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-2 py-1.5">
                    {pendingDelete === m.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(m)}
                          className="inline-flex h-7 items-center rounded-lg bg-red-500 px-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                        >
                          Delete anyway
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <IconAction
                        title={`Delete ${m.file_name ?? "file"}`}
                        onClick={() => setPendingDelete(m.id)}
                        disabled={busy}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={dialogOpen} onClose={closeDialog} title="Upload image">
        <div className="space-y-4">
          <div>
            <Label htmlFor="media-file">Image file</Label>
            {/* The native control is the accessible one. The wrapper only adds
                drag-and-drop on top of it, and never replaces it. */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={
                "rounded-xl border border-dashed p-3 transition " +
                (dragging ? "border-purple-400 bg-purple-50/60" : "border-slate-300")
              }
            >
              <input
                id="media-file"
                type="file"
                accept={MEDIA_ACCEPT_ATTRIBUTE}
                disabled={submitting}
                onChange={(e) => {
                  pickFile(e.target.files?.[0] ?? null);
                  // Cleared so choosing the same file twice in a row fires
                  // `change` again — otherwise the second attempt looks like
                  // nothing happened.
                  e.target.value = "";
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
              />
              <p className="mt-2 text-xs text-slate-400">
                Drop a file here, or paste the alt text below. PNG, JPEG, GIF or WebP, up to{" "}
                {formatBytes(mediaMaxBytes())}.
              </p>
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={values.alt_text || "Preview of the selected file"}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-lg bg-slate-50 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{file?.name}</p>
                <p className="text-xs text-slate-400">{file ? formatBytes(file.size) : ""}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={submitting}
                onClick={() => pickFile(null)}
              >
                Clear
              </Button>
            </div>
          )}

          <div>
            <Label htmlFor="media-entity-type">Attached to</Label>
            <Select
              id="media-entity-type"
              value={values.entity_type}
              disabled={submitting}
              onChange={(e) => {
                // The id is cleared with the type. Ids are per-type, so carrying
                // `5` from a college into the course list attaches the image to a
                // completely unrelated row, and the grid would then show it on
                // the wrong record with nothing to give it away.
                setValues((v) => ({ ...v, entity_type: e.target.value, entity_id: "" }));
                setFormError(null);
              }}
            >
              {MEDIA_ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="media-entity-id">{mediaEntityLabel(values.entity_type)}</Label>
            <Select
              id="media-entity-id"
              value={values.entity_id}
              disabled={submitting || optionsLoading || noLoader}
              error={optionsError !== null}
              onChange={(e) => setValue("entity_id", e.target.value)}
            >
              <option value="">
                {optionsLoading
                  ? `Loading ${mediaEntityLabel(values.entity_type).toLowerCase()}s…`
                  : "Select…"}
              </option>
              {(optionRows ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            {optionsError && (
              <p className="mt-1.5 text-xs text-red-600">
                The list could not be loaded, so an image cannot be attached. Reload the page to
                try again.
              </p>
            )}
            {noLoader && (
              <p className="mt-1.5 text-xs text-red-600">
                No list is wired up for “{mediaEntityLabel(values.entity_type)}”, so an image
                cannot be attached to it.
              </p>
            )}
            {optionRows !== null && optionRows.length === 0 && !optionsError && !noLoader && (
              <p className="mt-1.5 text-xs text-slate-400">
                There are no {mediaEntityLabel(values.entity_type).toLowerCase()}s to attach to yet.
              </p>
            )}
            {selectedEntityLabel && (
              <p className="mt-1.5 text-xs text-slate-400">Will be attached to “{selectedEntityLabel}”.</p>
            )}
          </div>

          <div>
            <Label htmlFor="media-image-type">Image type</Label>
            <Input
              id="media-image-type"
              list="media-image-types"
              maxLength={50}
              placeholder="logo, cover, campus…"
              value={values.image_type}
              disabled={submitting}
              onChange={(e) => setValue("image_type", e.target.value)}
            />
            <datalist id="media-image-types">
              {MEDIA_IMAGE_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div>
            <Label htmlFor="media-alt-text">Alt text</Label>
            <Input
              id="media-alt-text"
              maxLength={255}
              placeholder="Describe the image for screen readers"
              value={values.alt_text}
              disabled={submitting}
              onChange={(e) => setValue("alt_text", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Read aloud when the image cannot be seen. An image with no alt text is announced by
              its file name instead.
            </p>
          </div>

          <div>
            <Label htmlFor="media-display-order">Display order</Label>
            <Input
              id="media-display-order"
              inputMode="numeric"
              placeholder="0"
              value={values.display_order}
              disabled={submitting}
              onChange={(e) => setValue("display_order", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">Lower numbers are listed first.</p>
          </div>

          {/* aria-live so a rejected upload is announced, not just shown. */}
          <p aria-live="polite" className="min-h-5 text-sm text-red-600">
            {formError ?? fileError ?? ""}
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void submit()}
              disabled={submitting || optionsError !== null}
            >
              <Upload className="h-4 w-4" />
              {submitting ? "Uploading…" : "Upload image"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
