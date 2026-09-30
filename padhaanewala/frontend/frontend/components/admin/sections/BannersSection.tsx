"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, isForbidden, type AdminBanner } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/admin/primitives";

const GRADIENTS = [
  "bg-gradient-to-br from-purple-700 to-indigo-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-blue-700 to-cyan-600",
];

/** Homepage banners backed by `GET/POST/PUT/DELETE /api/v1/banners`. */
export function BannersSection() {
  const { data, error, loading, reload } = useAdminResource(
    () => adminApi.banners(),
    {
      forbiddenMessage: "You do not have permission to manage banners.",
      unreachableMessage: "Could not reach the banners API.",
    },
  );

  const banners = useMemo(
    () => data ?? null,
    [data],
  );
  const { showToast } = useApp();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", image_url: "", link_url: "" });

  const toggle = async (banner: AdminBanner) => {
    setBusyId(banner.id);
    try {
      const updated = await adminApi.updateBanner(banner.id, { is_active: !banner.is_active });
      reload(); void updated;
      showToast({
        title: `${updated.is_active ? "Activated" : "Paused"} ${banner.title}`,
        description: "Banner visibility updated.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not update banner",
        description: isForbidden(err) ? "You lack permission." : "Please retry.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    if (!draft.title.trim()) return;
    setBusyId(-1);
    try {
      const created = await adminApi.createBanner({
        title: draft.title.trim(),
        image_url: draft.image_url.trim() || null,
        link_url: draft.link_url.trim() || null,
        is_active: true,
      });
      reload(); void created;
      setDraft({ title: "", image_url: "", link_url: "" });
      setCreating(false);
      showToast({ title: "Banner created", description: created.title, variant: "success" });
    } catch (err) {
      showToast({
        title: "Could not create banner",
        description: isForbidden(err) ? "You lack permission." : "Please retry.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (banner: AdminBanner) => {
    setBusyId(banner.id);
    try {
      await adminApi.deleteBanner(banner.id);
      reload();
      showToast({ title: "Banner deleted", description: banner.title, variant: "success" });
    } catch (err) {
      showToast({
        title: "Could not delete banner",
        description: isForbidden(err) ? "You lack permission." : "Please retry.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Homepage banners"
        description="Control which promotional banners are live"
        count={banners?.length}
        action={
          <Button type="button" size="sm" variant="accent" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" /> Add banner
          </Button>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {creating && (
        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="banner-title">Title</Label>
            <Input
              id="banner-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Admission Open 2027"
            />
          </div>
          <div>
            <Label htmlFor="banner-image">Image URL</Label>
            <Input
              id="banner-image"
              value={draft.image_url}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="banner-link">Link URL</Label>
            <Input
              id="banner-link"
              value={draft.link_url}
              onChange={(e) => setDraft((d) => ({ ...d, link_url: e.target.value }))}
              placeholder="/colleges"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="button" size="sm" variant="primary" disabled={busyId === -1} onClick={create}>
              {busyId === -1 ? "Creating…" : "Create banner"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading banners…
        </p>
      ) : banners && banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No banners configured yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(banners ?? []).map((b, i) => (
            <div key={b.id} className="rounded-2xl border border-slate-200 p-4">
              <div
                className={cn(
                  "grid h-28 place-items-center rounded-xl text-white",
                  GRADIENTS[i % GRADIENTS.length],
                )}
              >
                {b.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_url} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <span className="px-3 text-center text-sm font-bold">{b.title}</span>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-gray-900">{b.title}</p>
              <p className="truncate text-xs text-slate-400">
                {b.position} · order {b.display_order}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant={b.is_active ? "green" : "gray"}>
                  {b.is_active ? "Active" : "Paused"}
                </Badge>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    variant={b.is_active ? "danger" : "secondary"}
                    disabled={busyId === b.id}
                    onClick={() => toggle(b)}
                  >
                    {b.is_active ? "Pause" : "Activate"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={busyId === b.id}
                    onClick={() =>
                      showToast({
                        title: "Edit banner",
                        description: "Inline editing is not wired in this build.",
                        variant: "info",
                      })
                    }
                    aria-label={`Edit ${b.title}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={busyId === b.id}
                    onClick={() => remove(b)}
                    aria-label={`Delete ${b.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
