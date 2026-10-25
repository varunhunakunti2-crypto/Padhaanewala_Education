"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * The two `position` values the public site lays out, and what each is for.
 *
 * `banners.position` is a free string on the backend so a new slot needs no
 * migration — but the console only offers positions a real component renders,
 * because a row filed under a typo'd position is invisible everywhere and
 * looks like a data-loss bug to the admin who just saved it.
 */
const SLOTS = [
  {
    value: "home_top",
    label: "Homepage strip",
    description:
      "The promotional strip above the hero. One banner runs full width; several " +
      "sit side by side and scroll sideways on smaller screens. Visitors can " +
      "dismiss a promo, which hides only that banner.",
  },
  {
    value: "hero_card",
    label: "Hero cards",
    description:
      "The floating cards beside the hero search. They stack in display order and " +
      "scroll inside the hero, so add as many as you need. Use a CTA line and a " +
      "short link — this is where a new exam or feature gets surfaced.",
  },
] as const;

type SlotValue = (typeof SLOTS)[number]["value"];

const HERO_SLOT: SlotValue = "hero_card";

interface BannerDraft {
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
}

const EMPTY_DRAFT: BannerDraft = { title: "", subtitle: "", image_url: "", link_url: "" };

/** Client-side mirror of `app/schemas/content.py`'s `_validate_banner_link`. */
function linkError(link: string): string | null {
  const value = link.trim();
  if (!value) return null;
  if (value.startsWith("//")) return "Protocol-relative links are not allowed.";
  if (value.startsWith("/")) return null;
  if (/^https?:\/\//i.test(value)) return null;
  return "Use an internal path (/scholarships) or a full https:// URL.";
}

/**
 * Create/edit form for one banner, shared by both slots.
 *
 * The subtitle is labelled per slot rather than hidden: on a hero card it is
 * the CTA line ("Register now"), in the strip it is a supporting line under the
 * title. Both layouts render it, so the input is always available — hiding it
 * made an admin-authored value invisible with no way to correct it.
 */
function BannerForm({
  slot,
  draft,
  setDraft,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  slot: SlotValue;
  draft: BannerDraft;
  setDraft: (next: BannerDraft) => void;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const invalidLink = linkError(draft.link_url);

  return (
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="banner-title">Title</Label>
        <Input
          id="banner-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Admission Open 2027"
        />
      </div>
      <div>
        <Label htmlFor="banner-subtitle">
          {slot === HERO_SLOT ? "CTA line" : "Supporting line"}
        </Label>
        <Input
          id="banner-subtitle"
          value={draft.subtitle}
          onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          placeholder={slot === HERO_SLOT ? "Register now" : "Applications close 30 June"}
        />
      </div>
      <div>
        <Label htmlFor="banner-image">Image URL</Label>
        <Input
          id="banner-image"
          value={draft.image_url}
          onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
          placeholder="https://…"
        />
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Best: upload the file in the Media library and paste its
          {" "}<code>/api/v1/media/files/…</code> path here. A third-party URL works
          only if that host is allowlisted in the site CSP; otherwise the card
          shows its initial instead.
        </p>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="banner-link">Link URL</Label>
        <Input
          id="banner-link"
          value={draft.link_url}
          onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
          placeholder="/exams/jee-advanced"
          aria-invalid={Boolean(invalidLink)}
        />
        {invalidLink && <p className="mt-1 text-xs text-red-600">{invalidLink}</p>}
      </div>
      <div className="flex items-end">
        <div className="flex w-full gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy || !draft.title.trim() || Boolean(invalidLink)}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/** What the public homepage would actually show for this banner right now.
 *
 * `is_active` alone is not the answer. `list_banners` hides a banner when it is
 * inactive **or** when today falls outside its `start_date`/`end_date` window,
 * and this panel now lists the inactive ones too — so a row can be paused,
 * scheduled for next month, or expired while `is_active` is still `true`.
 * Rendering the flag alone would label all three "Active", which is the same
 * class of bug as the missing `include_inactive` in the first place.
 */
function bannerStatus(banner: AdminBanner): { label: string; variant: "green" | "gray" | "amber" } {
  if (!banner.is_active) return { label: "Paused", variant: "gray" };

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  // `YYYY-MM-DD` sorts correctly as a string, and an absent bound means
  // "unbounded on that side" — the same reading `_is_visible` gives a null date.
  const bound = (value?: string | null) => (value ? Date.parse(`${value}T00:00:00Z`) : null);
  const start = bound(banner.start_date);
  const end = bound(banner.end_date);

  if (start !== null && start > todayUtc) return { label: "Scheduled", variant: "amber" };
  if (end !== null && end < todayUtc) return { label: "Expired", variant: "amber" };
  return { label: "Live", variant: "green" };
}

/** Banners and hero cards, backed by `GET/POST/PUT/DELETE /api/v1/banners`. */
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
  const [slot, setSlot] = useState<SlotValue>("home_top");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<BannerDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  /**
   * Bring the editor into view when it opens.
   *
   * The form renders above the card grid, so on a list taller than the screen
   * clicking "Edit" on a lower card looked like nothing happened — the form was
   * there, just off-screen. `scrollIntoView` is optional-called because jsdom
   * (the test environment) does not implement it.
   */
  useEffect(() => {
    if (creating || editingId !== null) {
      formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [creating, editingId]);

  const slotMeta = SLOTS.find((s) => s.value === slot) ?? SLOTS[0];

  /** Rows for the selected slot only — the list is filtered, not paginated. */
  const visible = useMemo(() => {
    if (!banners) return null;
    return banners.filter((b) => b.position === slot);
  }, [banners, slot]);

  /** Append new cards after the existing ones. The backend defaults to 0,
   *  which would put every new card ahead of the three seeded rows and make the
   *  list reorder itself on each save. `visible` includes paused rows, so a
   *  paused card's slot keeps its place in the scroll order when reactivated. */
  const nextDisplayOrder = () => {
    if (!visible || visible.length === 0) return 0;
    return Math.max(...visible.map((b) => b.display_order)) + 1;
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setCreating(true);
  };

  const startEdit = (banner: AdminBanner) => {
    setCreating(false);
    setEditingId(banner.id);
    setDraft({
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      image_url: banner.image_url ?? "",
      link_url: banner.link_url ?? "",
    });
  };

  const cancelForm = () => {
    setCreating(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  /**
   * Expire the public pages that read banners.
   *
   * Every mutation has to call this — not just create/edit/delete. A pause or
   * resume changes the set of cards the homepage renders just as much as a
   * delete does, and leaving it out meant the hero kept showing the old set
   * until the ISR window expired. That is how "I added 2 cards but only 1 is
   * visible" happens: the second card was paused when the page snapshot was
   * taken and resumed afterwards, with nothing telling the page to rebuild.
   *
   * Best-effort: a failed purge only delays the update, so it must not turn a
   * successful write into an error toast.
   */
  const purgePublic = async () => {
    try {
      await adminApi.revalidate(["banners"]);
    } catch {
      /* the ISR window will pick it up */
    }
  };

  /** Both create and edit end here, so the ISR purge runs for either. */
  const afterWrite = async (verb: string, title: string) => {
    reload();
    await purgePublic();
    showToast({ title: `${verb} ${title}`, description: "Changes are live on the homepage.", variant: "success" });
  };

  const create = async () => {
    if (!draft.title.trim()) return;
    setBusyId(-1);
    try {
      await adminApi.createBanner({
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        image_url: draft.image_url.trim() || null,
        link_url: draft.link_url.trim() || null,
        position: slot,
        display_order: nextDisplayOrder(),
        is_active: true,
      });
      cancelForm();
      await afterWrite("Created", draft.title.trim());
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

  const saveEdit = async () => {
    if (editingId === null || !draft.title.trim()) return;
    setBusyId(editingId);
    try {
      await adminApi.updateBanner(editingId, {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        image_url: draft.image_url.trim() || null,
        link_url: draft.link_url.trim() || null,
      });
      cancelForm();
      await afterWrite("Updated", draft.title.trim());
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

  const toggle = async (banner: AdminBanner) => {
    setBusyId(banner.id);
    try {
      const updated = await adminApi.updateBanner(banner.id, { is_active: !banner.is_active });
      reload();
      await purgePublic();
      showToast({
        title: `${updated.is_active ? "Enabled" : "Paused"} ${banner.title}`,
        // Not "visibility updated": enabling a banner whose schedule has expired
        // leaves it off the homepage. Report the status the row now actually has.
        description: `Banner is now ${bannerStatus(updated).label.toLowerCase()}.`,
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

  const remove = async (banner: AdminBanner) => {
    setBusyId(banner.id);
    try {
      await adminApi.deleteBanner(banner.id);
      if (editingId === banner.id) cancelForm();
      await afterWrite("Deleted", banner.title);
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
        title="Banners & hero cards"
        description="Promote exams, features and offers on the public site"
        count={visible?.length}
        action={
          <Button type="button" size="sm" variant="accent" onClick={startCreate}>
            <Plus className="h-4 w-4" /> Add banner
          </Button>
        }
      />

      {/* Slot switcher — a segmented control, since there are exactly two. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SLOTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setSlot(s.value);
              cancelForm();
            }}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              slot === s.value
                ? "border-purple-600 bg-purple-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-purple-300",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-slate-500">{slotMeta.description}</p>

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      <div ref={formRef} className="scroll-mt-24">
        {(creating || editingId !== null) && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
            {creating ? "New banner" : `Editing “${draft.title.trim() || "banner"}”`}
          </p>
        )}

        {creating && (
          <BannerForm
            slot={slot}
            draft={draft}
            setDraft={setDraft}
            busy={busyId === -1}
            submitLabel={busyId === -1 ? "Creating…" : "Create banner"}
            onSubmit={create}
            onCancel={cancelForm}
          />
        )}

        {editingId !== null && (
          <BannerForm
            slot={slot}
            draft={draft}
            setDraft={setDraft}
            busy={busyId === editingId}
            submitLabel={busyId === editingId ? "Saving…" : "Save changes"}
            onSubmit={saveEdit}
            onCancel={cancelForm}
          />
        )}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Loading banners…
        </p>
      ) : visible && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          {slot === HERO_SLOT
            ? "No hero cards yet. Add one to surface an exam or feature beside the search."
            : "No banners in this slot yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(visible ?? []).map((b, i) => (
            <div
              key={b.id}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                editingId === b.id
                  ? "border-purple-400 ring-2 ring-purple-100"
                  : "border-slate-200",
              )}
            >
              <div
                className={cn(
                  "grid h-28 place-items-center rounded-xl text-white",
                  GRADIENTS[i % GRADIENTS.length],
                )}
              >
                {b.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.image_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="px-3 text-center text-sm font-bold">{b.title}</span>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-gray-900">{b.title}</p>
              {b.subtitle && (
                <p className="truncate text-xs text-slate-500">{b.subtitle}</p>
              )}
              <p className="truncate text-xs text-slate-400">
                {b.position} · order {b.display_order}
              </p>
              {(b.start_date || b.end_date) && (
                <p className="truncate text-xs text-slate-400">
                  {b.start_date ?? "always"} → {b.end_date ?? "always"}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <Badge variant={bannerStatus(b).variant}>{bannerStatus(b).label}</Badge>
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
                    onClick={() => startEdit(b)}
                    aria-label={`Edit ${b.title}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
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
