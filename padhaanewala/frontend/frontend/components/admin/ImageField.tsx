"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Images, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { adminApi, isForbidden, type AdminMedia } from "@/lib/api";
import { isRenderableImageUrl } from "@/lib/image-field";

/**
 * An image field that picks from the Media library.
 *
 * ## One place to upload
 *
 * The Media panel is the only screen that accepts a file. Every form that needs
 * an image — banners, blog covers, colleges, courses, exams, scholarships —
 * mounts this component, which reads the library and writes the chosen
 * `/api/v1/media/files/{id}` path into the entity's `image_url` string. That is
 * deliberate: a per-form upload box meant the same picture was uploaded several
 * times (once for each screen that showed it), and an image was stored in a
 * different place depending on which form happened to create it.
 *
 * ## Existing values are not thrown away
 *
 * Rows saved before this picker existed can hold an external URL or an older
 * path. The field shows that value and says plainly that it is not in the
 * library, because silently blanking it would remove a live image from the
 * public site the moment the form was opened. It is replaced only when the
 * admin picks something else; Remove is an explicit action.
 *
 * ## The library list is fetched when the dialog opens
 *
 * `GET /media` is walked to completion by `adminApi.media()`. Fetching it on
 * mount would mean every edit form issues that request even if the admin never
 * touches the image field, so the effect is keyed on `open`. A failed request
 * keeps the field usable: the current value is still shown and can be removed,
 * and the dialog offers a retry rather than pretending the library is empty.
 */
interface ImageFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}

function libraryError(err: unknown): string {
  if (isForbidden(err)) return "Your role cannot read the Media library.";
  return "The Media library could not be loaded. Check your connection and try again.";
}

export function ImageField({
  id,
  label,
  value,
  onChange,
  hint,
  disabled,
}: ImageFieldProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AdminMedia[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Only re-fetch when the dialog is opened or the admin asks for a retry. The
  // cleanup flag discards a response that arrives after the dialog is closed.
  // The resets happen in the click handlers rather than here: calling setState
  // synchronously in an effect cascades a render for no reason.
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    adminApi
      .media()
      .then((media) => {
        if (!ignore) setRows(media);
      })
      .catch((err: unknown) => {
        if (!ignore) setError(libraryError(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [open, attempt]);

  const startLoading = () => {
    setRows(null);
    setError(null);
    setLoading(true);
  };

  const openLibrary = () => {
    startLoading();
    setOpen(true);
  };

  const retry = () => {
    startLoading();
    setAttempt((n) => n + 1);
  };

  const trimmed = value.trim();
  const previewSrc = isRenderableImageUrl(value) ? trimmed : null;

  // Newest first: the image an admin just uploaded is the one they are most
  // likely to be looking for.
  const library = useMemo(
    () => [...(rows ?? [])].sort((a, b) => b.id - a.id),
    [rows],
  );
  const selected = useMemo(
    () => (rows ?? []).find((m) => m.url === trimmed) ?? null,
    [rows, trimmed],
  );

  // Only claim the value is outside the library once the list has actually
  // loaded; during loading every value looks unmatched.
  const legacy = trimmed !== "" && rows !== null && selected === null;

  const description = selected
    ? selected.file_name ?? selected.url
    : trimmed !== ""
      ? trimmed
      : "No image selected";

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="grid h-24 w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-32">
          {previewSrc ? (
            // The same-origin media path cannot be a build-time remote pattern,
            // and a legacy external URL cannot either, so next/image is the
            // wrong tool for this preview box.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid place-items-center gap-1 text-[11px] text-slate-400">
              <Images className="h-5 w-5" />
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-sm font-medium text-slate-700" title={trimmed || undefined}>
            {description}
          </p>
          {selected?.alt_text && (
            <p className="truncate text-xs text-slate-400">{selected.alt_text}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              id={id}
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              onClick={openLibrary}
            >
              <Images className="h-3.5 w-3.5" />
              {trimmed === "" ? "Choose from Media" : "Replace image"}
            </Button>
            {trimmed !== "" && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange("")}
              >
                <X className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>

          {legacy && (
            <p className="text-xs font-medium text-amber-600">
              This image is not in the Media library, so it cannot be reused elsewhere. It stays
              as it is until you choose a replacement.
            </p>
          )}
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Choose from Media"
        className="sm:max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Every image is uploaded in the Media library. Pick one here — the form saves its
            path, not a copy of the file.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading media…
            </div>
          ) : error ? (
            <div className="rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <p>{error}</p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="mt-2"
                onClick={retry}
              >
                Try again
              </Button>
            </div>
          ) : library.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">The Media library is empty.</p>
              <p className="mt-1 text-xs text-slate-400">
                Upload an image in Admin → Media, then come back and pick it.
              </p>
            </div>
          ) : (
            <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {library.map((media) => {
                const active = media.url === trimmed;
                return (
                  <button
                    key={media.id}
                    type="button"
                    aria-pressed={active}
                    title={media.file_name ?? media.url}
                    onClick={() => {
                      onChange(media.url);
                      setOpen(false);
                    }}
                    className={
                      "overflow-hidden rounded-xl border text-left transition " +
                      (active
                        ? "border-purple-500 ring-2 ring-purple-200"
                        : "border-slate-200 hover:border-purple-300 hover:shadow-sm")
                    }
                  >
                    <span className="grid h-24 place-items-center bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={media.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </span>
                    <span className="flex items-start gap-1.5 px-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-700">
                          {media.file_name ?? media.url}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {media.alt_text ?? "No alt text"}
                        </span>
                      </span>
                      {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
