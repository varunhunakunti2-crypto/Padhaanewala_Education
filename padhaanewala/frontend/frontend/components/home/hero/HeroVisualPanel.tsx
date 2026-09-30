"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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

const FLOATING_CARDS = [
  {
    title: "Top Engineering Colleges in India",
    action: "Explore now",
    href: "/colleges?stream=engineering",
    thumb: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=160&h=160&q=80",
    top: "140px",
    right: "16px",
    delay: 0.3,
  },
  {
    title: "Scholarships for Your Goals",
    action: "Find opportunities",
    href: "/scholarships",
    thumb: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=160&h=160&q=80",
    top: "235px",
    right: "16px",
    delay: 0.45,
  },
  {
    title: "Compare Colleges Side by Side",
    action: "Make smarter choices",
    href: "/compare",
    thumb: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=160&h=160&q=80",
    top: "330px",
    right: "16px",
    delay: 0.6,
  },
];

export function HeroVisualPanel() {
  return (
    <div className="relative hidden h-[600px] w-full lg:block">
      {/* Handwriting doodle top right */}
      <Handwriting />

      {/* 3 Floating Glassmorphic Cards on the right */}
      <div className="absolute right-0 top-0 h-full w-72 pointer-events-none">
        {FLOATING_CARDS.map((card) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: card.delay, ease: [0.22, 1, 0.36, 1] }}
            style={{ top: card.top, right: card.right }}
            className="pointer-events-auto absolute w-[240px]"
          >
            <Link
              href={card.href}
              className="group flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/60 p-2.5 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-white/40 hover:bg-slate-900/75"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
                <Image
                  src={card.thumb}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
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
        ))}

      </div>
    </div>
  );
}