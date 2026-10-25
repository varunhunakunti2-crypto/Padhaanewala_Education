"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import type { StripBanner } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * The homepage strip: admin-authored `position='home_top'` banners, rendered
 * under the fixed header and above the hero.
 *
 * ## Why the padding, not a wrapper band
 *
 * The site header is `fixed top-0`, so the first thing in `<main>` starts
 * underneath it. `pt-24` / `lg:pt-28` is the same clearance `HeroSection` uses,
 * which keeps the first promo card below the floating pill nav instead of
 * behind it.
 *
 * ## Multiple banners
 *
 * The admin can author any number, so the row is a horizontal snap scroller:
 * one card on a phone, two at `sm`, three at `lg`, and the rest reached by
 * scrolling. A single banner takes the full width — that is the "wide
 * promotional banner" the slot describes, and it should not look like a
 * quarter-full grid.
 *
 * ## Dismissals
 *
 * Stored as a list of banner ids in `localStorage`, not as one global flag:
 * dismissing a finished offer must not hide the next campaign. The banner
 * remains in the server-rendered HTML and is removed as soon as storage is read
 * after hydration, so a returning visitor may see a dismissed card for one
 * frame. Reading a cookie on the server instead would make `/` dynamic and opt
 * the whole homepage out of ISR, which is a much worse trade for a promo.
 */
const DISMISS_KEY = "padhaanewala:home-strip:dismissed:v1";

const GRADIENTS = [
  "from-purple-700 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-blue-700 to-cyan-600",
];

/**
 * External links open in a new tab; internal navigation stays in-tab.
 *
 * The same rule `opensInNewTab` applies to hero cards. Duplicated rather than
 * imported because that helper lives in `HeroVisualPanel`, and a strip should
 * not pull the hero's motion/animation graph into its bundle for one regex.
 */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function StripCard({
  banner,
  index,
  fullWidth,
  onDismiss,
}: {
  banner: StripBanner;
  index: number;
  fullWidth: boolean;
  onDismiss: (id: number) => void;
}) {
  // A dead host, a typo or a CSP-blocked origin falls back to the gradient
  // underneath instead of a broken-image frame. Same contract as the hero
  // thumbnails: the image is decoration, not the message.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(banner.image) && !imageFailed;

  const body = (
    <>
      {showImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, see docstring */}
          <img
            src={banner.image ?? ""}
            alt=""
            loading="lazy"
            decoding="async"
            // These are hotlinked stock images as often as not, and there is no
            // reason to tell a third-party host which page a visitor came from.
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Keeps the title legible whatever the image happens to be. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/10"
          />
        </>
      )}
      <span className="relative min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-bold leading-snug text-white">
          {banner.title}
        </span>
        {banner.subtitle && (
          <span className="mt-0.5 line-clamp-1 block text-xs font-medium text-white/75">
            {banner.subtitle}
          </span>
        )}
      </span>
      {banner.href && (
        <ArrowRight className="relative h-4 w-4 shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  const shell = cn(
    "group relative flex min-h-[84px] items-center gap-3 overflow-hidden rounded-2xl border border-white/10",
    "bg-gradient-to-br p-4 pr-12 shadow-sm transition duration-200",
    GRADIENTS[index % GRADIENTS.length],
    banner.href &&
      "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2",
  );

  return (
    <div
      className={cn(
        "relative shrink-0 snap-start",
        fullWidth
          ? "basis-full"
          : "basis-full sm:basis-[calc(50%-0.375rem)] lg:basis-[calc(33.333%-0.5rem)]",
      )}
    >
      {banner.href ? (
        <Link
          href={banner.href}
          target={isExternal(banner.href) ? "_blank" : undefined}
          rel={isExternal(banner.href) ? "noopener noreferrer" : undefined}
          className={shell}
        >
          {body}
        </Link>
      ) : (
        // A promo with no link is allowed by the schema; it still renders, it
        // just is not somewhere to click.
        <div className={shell}>{body}</div>
      )}

      <button
        type="button"
        onClick={() => onDismiss(banner.id)}
        aria-label={`Dismiss ${banner.title}`}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-950/40 text-white/80 backdrop-blur transition-colors hover:bg-slate-950/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Cross-tab updates (`storage`) and this tab's own dismissal land on the same
 * listener, which is what makes `useSyncExternalStore` the right tool: it reads
 * the browser's storage as an external system instead of copying it into state
 * in an effect (a cascading render the lint rules reject, and the pattern that
 * makes dismissal flash on every navigation).
 */
const DISMISS_EVENT = "padhaanewala:home-strip:dismissed";

const NO_DISMISSALS: readonly number[] = [];

/**
 * `useSyncExternalStore` compares snapshots with `Object.is`, so this has to
 * return the same reference while the stored value is unchanged. Re-reading a
 * raw string and reusing the parsed array is cheaper and less fragile than
 * module-level caches that go stale when another tab writes.
 */
let cachedRaw: string | null | undefined;
let cachedIds: readonly number[] = NO_DISMISSALS;

function parseDismissed(raw: string | null): readonly number[] {
  if (!raw) return NO_DISMISSALS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NO_DISMISSALS;
    const ids = parsed.filter((id): id is number => typeof id === "number");
    return ids.length ? ids : NO_DISMISSALS;
  } catch {
    return NO_DISMISSALS;
  }
}

function readDismissed(): readonly number[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DISMISS_KEY);
  } catch {
    /* storage disabled: behave like a first visit */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parseDismissed(raw);
  }
  return cachedIds;
}

function writeDismissed(ids: readonly number[]): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    /* storage disabled: the dismissal still applies until reload */
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

function subscribeToDismissals(onChange: () => void): () => void {
  // `storage` fires in *other* tabs; the custom event covers this one.
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

export function PromoStrip({ banners }: { banners: StripBanner[] }) {
  // The server snapshot is empty — it cannot know what this browser dismissed.
  // React renders the server HTML, then re-reads storage after hydration, which
  // is the no-mismatch way to show an honest server render.
  const dismissed = useSyncExternalStore(
    subscribeToDismissals,
    readDismissed,
    () => NO_DISMISSALS,
  );

  const dismiss = (id: number) => {
    if (dismissed.includes(id)) return;
    writeDismissed([...dismissed, id]);
  };

  const visible = banners.filter((b) => !dismissed.includes(b.id));
  if (visible.length === 0) return null;

  // Widths key off the authored count, not the visible count: dismissing one of
  // two must not make the survivor jump from half-width to full-width.
  const fullWidth = banners.length === 1;

  return (
    <section
      aria-label="Promotions"
      className="relative px-4 pt-24 pb-1 sm:px-6 lg:px-8 lg:pt-28"
    >
      <div className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-color:rgba(124,58,237,0.35)_transparent] [scrollbar-width:thin]">
        {visible.map((banner, index) => (
          <StripCard
            key={banner.id}
            banner={banner}
            index={index}
            fullWidth={fullWidth}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </section>
  );
}
