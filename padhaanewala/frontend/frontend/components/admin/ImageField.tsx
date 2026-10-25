"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/FormField";
import { adminApi } from "@/lib/api";
import { checkImageUrl, isRenderableImageUrl, IMAGE_URL_MAX } from "@/lib/image-field";
import {
  buildMediaUpload,
  describeMediaError,
  MEDIA_ACCEPT_ATTRIBUTE,
  validateMediaFile,
} from "@/lib/media-form";

/**
 * An image picker for an entity's `image_url`, offering both an upload and a
 * pasted URL.
 *
 * ## One value, two controls
 *
 * The column is a single string. The media library stores an upload and returns
 * it as a same-origin `/media/files/{id}` path; the URL box writes whatever the
 * admin types. Both land in the same `value`, so `onChange` is the only thing
 * the form has to wire up and the two controls cannot disagree about what is
 * saved.
 *
 * ## Why the upload decides the entity type from a prop
 *
 * `media.entity_type` is a soft reference with no foreign key, so a mistyped
 * entity pair writes a row no listing will ever find — `upload_media`'s own
 * docstring says the check is the client's job. This component is only ever
 * mounted inside a specific entity's edit form, so it passes that entity's type
 * and, when editing an existing record, its id. A create form has no id yet, so
 * the upload is attached with `entity_id=0`, which is honest about the fact that
 * the file is not yet linked to a saved row.
 *
 * ## SVG and size limits are not re-implemented
 *
 * `validateMediaFile` and `buildMediaUpload` already own those checks (including
 * the SVG refusal, which is a real security boundary — see the media module),
 * so this calls them rather than duplicating the rules a second time.
 */
interface ImageFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The `media.entity_type` this upload belongs to, e.g. `"college"`. */
  entityType: string;
  /** The saved row's id, or `undefined` on a create form that has none yet. */
  entityId?: number;
  hint?: string;
  disabled?: boolean;
}

export function ImageField({
  id,
  label,
  value,
  onChange,
  entityType,
  entityId,
  hint,
  disabled,
}: ImageFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show a preview for a value the server would accept. A `data:` URI is
  // renderable by the browser but refused by the backend, and previewing it
  // would promise a save that cannot happen.
  const previewSrc = isRenderableImageUrl(value) ? value.trim() : null;
  const check = value.trim() === "" ? null : checkImageUrl(value);

  async function upload(file: File | null) {
    setError(null);
    const checked = validateMediaFile(file);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    const built = buildMediaUpload(
      {
        entity_type: entityType,
        // A create form has no id yet; 0 means "not yet linked to a row", which
        // is what the soft reference can honestly express before the save.
        entity_id: String(entityId ?? 0),
        image_type: "cover",
        alt_text: "",
        display_order: "0",
      },
      file,
    );
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setUploading(true);
    try {
      const media = await adminApi.uploadMedia(built.body);
      // `AdminMedia.url` is the same-origin path the public pages read.
      onChange(media.url);
    } catch (err) {
      setError(describeMediaError(err));
    } finally {
      setUploading(false);
      // Reset the control so re-picking the same file still fires `change`.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-2">
          <Input
            id={id}
            value={value}
            maxLength={IMAGE_URL_MAX}
            placeholder="/media/files/12 or https://…"
            disabled={disabled}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={MEDIA_ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => upload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageUp className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {value.trim() !== "" && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={disabled || uploading}
                onClick={() => {
                  setError(null);
                  onChange("");
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
          {check && !check.ok && (
            <p className="text-xs font-medium text-red-600">{check.error}</p>
          )}
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          {hint && !error && !(check && !check.ok) && (
            <p className="text-xs text-slate-400">{hint}</p>
          )}
        </div>

        {/* Preview. Fixed box so the layout does not jump when an image loads,
            and a neutral dashed placeholder when there is nothing to show. */}
        <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-32">
          {previewSrc ? (
            // Admin-supplied hosts cannot be a build-time `images.remotePatterns`
            // entry, so next/image is the wrong tool for this box.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-[11px] text-slate-400">
              No image
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
