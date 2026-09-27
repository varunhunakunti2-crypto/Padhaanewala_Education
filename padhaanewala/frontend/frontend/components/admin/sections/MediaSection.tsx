"use client";

import { useMemo } from "react";
import { adminApi } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, AddButton } from "@/components/admin/primitives";

interface MediaRow {
  id: number;
  url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  alt_text: string | null;
  entity_type: string | null;
  entity_id: number | null;
}

/**
 * Reads the real media table.
 *
 * This library was never wired to storage: it rendered a purple gradient tile
 * with the college's initials for each of the 10 invented colleges and called it
 * an uploaded asset, and its "Remove media" button only fired a toast. It now
 * lists rows from `/media` — the actual `file_name` and `url` the backend
 * returns — and says plainly when the library is empty rather than dressing up
 * placeholders as uploads.
 */
export function MediaSection() {
  const { data, error, loading } = useAdminResource<MediaRow>(
    () => adminApi.media() as Promise<MediaRow[]>,
    { unreachableMessage: "Could not reach the media API." },
  );
  const all = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <SectionHeading
        title="Media library"
        description="College logos, banners and campus imagery"
        count={all.length}
        action={<AddButton label="Upload" />}
      />
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading media…</p>
      ) : all.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          No files uploaded yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {all.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-xl border border-slate-100">
              <div className="grid h-24 place-items-center bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt_text ?? m.file_name ?? ""} className="h-full w-full object-contain" />
              </div>
              <div className="px-3 py-2">
                <p className="truncate text-xs font-medium text-slate-600" title={m.file_name ?? undefined}>
                  {m.file_name ?? m.url}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
