"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HeroCard } from "@/lib/content";

function Handwriting() {
  return (
    <div aria-hidden className="pointer-events-none absolute right-10 top-0 z-10 text-right text-white/50 select-none">
      <p className="font-hand text-[2rem] leading-[1.1] tracking-wide text-white/60">
        Better
        <br />
        Colleges
        <br />
        Brighter
        <br />
        Futures
      </p>
      <svg viewBox="0 0 100 12" className="ml-auto mt-1 w-24" fill="none" aria-hidden>
        <path
          d="M2 6 C 30 1, 70 1, 98 8"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

/**
 * The floating glassmorphic cards beside the hero search.
 *
 * `cards` is optional so the panel can still render in isolation (a story, a
 * test) without a data layer; `HomePage` always passes the resolved list. When
 * `cards` is undefined the panel shows the shipped defaults, and when it is an
 * empty array — an admin who cleared the slot — it shows nothing but the
 * handwriting doodle. That distinction is deliberate: "no cards" is a valid
 * authored state, not an error to paper over by re-injecting defaults.
 *
 * A hero that resolves to zero cards is still a hero, so the copy on the left
 * (`HeroContent`) never depended on these and needs no change.
 */
const FALLBACK_CARDS: HeroCard[] = [
  {
    title: "Top Engineering Colleges in India",
    action: "Explore now",
    href: "/colleges?stream=engineering",
    thumb:
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    title: "Scholarships for Your Goals",
    action: "Find opportunities",
    href: "/scholarships",
    thumb:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    title: "Compare Colleges Side by Side",
    action: "Make smarter choices",
    href: "/compare",
    thumb:
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=160&h=160&q=80",
  },
];

/**
 * The 44px thumbnail on a card: the admin's image, or the title's initial.
 *
 * ## Why a plain `<img>` and not `next/image`
 *
 * `card.thumb` is whatever the admin typed into the banner form. `next/image`
 * routes it through `/_next/image`, which rejects every host that is not in
 * `images.remotePatterns` — a build-time list that cannot know what an operator
 * will paste — and the rejection throws during render, taking the whole
 * homepage to the error boundary. `EntityImage` reached the same conclusion for
 * catalogue images; this is the hero's version of that rule. The same-origin
 * media path an upload produces is covered by `img-src 'self'`, and a remote
 * host is covered by `CSP_IMAGE_HOSTS` (see `proxy.ts`).
 *
 * `onError` covers the remaining cases — a typo'd URL, a dead host, a hotlink
 * the stock site refuses, or a host the CSP blocks. The letter placeholder that
 * was already the no-image state stands in, so a bad URL costs one thumbnail
 * instead of a crash.
 */
function CardThumb({ thumb, title }: { thumb?: string | null; title: string }) {
  const url = typeof thumb === "string" ? thumb.trim() : "";
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, see docstring
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          // Stock CDNs routinely 403 a hotlink based on Referer, and there is
          // no reason to tell a third-party host which hero card was clicked.
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-full w-full place-items-center text-lg font-bold text-purple-200"
        >
          {title.charAt(0)}
        </span>
      )}
    </div>
  );
}

/**
 * True when the link should open in a new tab.
 *
 * Internal navigation stays in-tab because that is the web's default and a
 * card that hijacks the tab is disorienting; an external URL opens in a new
 * tab so the visitor does not lose their place mid-search.
 */
export function opensInNewTab(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function HeroVisualPanel({ cards }: { cards?: HeroCard[] }) {
  // `undefined` (caller chose not to resolve) falls back; an explicit empty
  // array (admin cleared the slot) stays empty. No slice: the list scrolls.
  const visible = cards ?? FALLBACK_CARDS;

  return (
    <div className="relative hidden h-[600px] w-full lg:block">
      {/* Handwriting doodle top right */}
      <Handwriting />

      {/*
        Scrolling card column, starting below the handwriting doodle.
        There is no cap: the admin adds as many cards as the slot needs and the
        list scrolls inside the 600px panel (roughly six visible at a time)
        instead of running past the canvas. The old three-slot absolute
        positioning (`top: 140/235/330px`) only ever had room for three.

        `overscroll-contain` stops a wheel gesture at the end of the list from
        scrolling the page behind it, which otherwise makes the hero jump under
        the cursor.
      */}
      <div
        role="region"
        aria-label="Featured updates"
        className="absolute bottom-0 right-0 top-[140px] w-72 overflow-y-auto overflow-x-hidden overscroll-contain px-1 pb-6 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin]"
      >
        <div className="flex flex-col gap-3">
          {visible.map((card, index) => {
            const external = opensInNewTab(card.href);
            return (
              <motion.div
                key={`${card.href}-${index}`}
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                // Capped: card 20 should not wait three seconds to appear. The
                // stagger is a flourish, not a queue.
                transition={{
                  duration: 0.6,
                  delay: Math.min(0.3 + index * 0.15, 0.9),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="w-full shrink-0"
              >
                <Link
                  href={card.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/60 p-2.5 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-white/40 hover:bg-slate-900/75"
                >
                  <CardThumb thumb={card.thumb} title={card.title} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-white group-hover:text-purple-200">
                      {card.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-purple-300 group-hover:text-white">
                      {card.action}
                      <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}