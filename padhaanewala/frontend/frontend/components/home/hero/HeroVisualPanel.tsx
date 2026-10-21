"use client";

import { motion } from "motion/react";
import Image from "next/image";
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

/** Cards are dropped when the hero has no room to place them. */
const MAX_CARDS = 3;

/**
 * Vertical offset per slot. The panel is a fixed-height absolute canvas, so
 * the positions are authored rather than flowed — which is why the count is
 * capped above: a fourth card would run past the canvas edge.
 *
 * The gap between slots (95px) is the card height (80px) plus breathing room,
 * and the first slot starts at 140px so the cards clear the handwriting doodle.
 */
const CARD_TOP_PX = [140, 235, 330];

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
  // array (admin cleared the slot) stays empty.
  const visible = (cards ?? FALLBACK_CARDS).slice(0, MAX_CARDS);

  return (
    <div className="relative hidden h-[600px] w-full lg:block">
      {/* Handwriting doodle top right */}
      <Handwriting />

      {/* Floating Glassmorphic Cards on the right */}
      <div className="absolute right-0 top-0 h-full w-72 pointer-events-none">
        {visible.map((card, index) => {
          const external = opensInNewTab(card.href);
          return (
            <motion.div
              key={`${card.href}-${index}`}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ top: CARD_TOP_PX[index], right: 16 }}
              className="pointer-events-auto absolute w-[240px]"
            >
              <Link
                href={card.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/60 p-2.5 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-white/40 hover:bg-slate-900/75"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
                  {card.thumb ? (
                    <Image
                      src={card.thumb}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid h-full w-full place-items-center text-lg font-bold text-purple-200"
                    >
                      {card.title.charAt(0)}
                    </span>
                  )}
                </div>
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
  );
}