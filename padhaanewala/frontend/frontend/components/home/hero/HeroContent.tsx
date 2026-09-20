"use client";

import { motion, useReducedMotion } from "motion/react";
import { Play, Flame, Sparkles } from "lucide-react";
import Link from "next/link";
import { HeroSearch } from "@/components/home/hero/HeroSearch";
import { HeroStats } from "@/components/home/hero/HeroStats";

export function HeroContent() {
  const reduce = useReducedMotion();

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="relative z-10">
      {/* eyebrow */}
      <motion.div {...fade(0.08)} className="flex items-center gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
          More than a college search
        </p>
        <span aria-hidden className="h-[2px] w-12 bg-purple-400/60 rounded-full" />
      </motion.div>

      {/* headline */}
      <motion.h1
        {...fade(0.18)}
        className="hero-headline mt-4 font-display font-extrabold text-white text-4xl sm:text-5xl lg:text-[3.6rem] tracking-[-0.035em] leading-[1.08] drop-shadow-[0_8px_28px_rgba(2,8,28,0.45)]"
      >
        <span className="block">Find the Right College</span>
        <span className="block">
          For{" "}
          <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 bg-clip-text text-transparent">
            Your Future.
          </span>
        </span>
      </motion.h1>

      {/* description */}
      <motion.p
        {...fade(0.3)}
        className="mt-5 max-w-[680px] text-[16px] leading-relaxed text-white/75 sm:text-[18px]"
      >
        Explore colleges, compare courses, understand fees, and discover
        opportunities that match your goals.
      </motion.p>

      {/* search */}
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-30 mt-7 max-w-2xl"
      >
        <HeroSearch />
        {/* Popup predictor CTA */}
        <div className="mt-3">
          <Link
            href="/college-predictor"
            className="btn-uiverse-arrow text-sm font-bold"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI College Predictor</span>
            <div className="arrow-wrapper">
              <div className="arrow" />
            </div>
          </Link>
        </div>
        {/* Popular searches chips below search bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-orange-400">
            <Flame className="h-3.5 w-3.5 fill-orange-400" /> Popular searches:
          </span>
          {["Engineering", "MBA", "Medical", "Computer Science", "Bangalore"].map((tag) => (
            <Link
              key={tag}
              href={`/colleges?q=${encodeURIComponent(tag)}`}
              className="rounded-full bg-white/10 px-3 py-1 text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              {tag}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* stats */}
      <HeroStats />

      {/* watch how it works */}
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.95, ease: "easeOut" }}
        className="mt-8"
      >
        <a
          href="#how-it-works"
          className="group inline-flex items-center gap-3.5"
          aria-label="Watch how it works, 2 minute video explainer"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-white/[0.08] text-white backdrop-blur transition-all duration-300 group-hover:border-purple-400 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-semibold text-white">Watch how it works</span>
            <span className="block text-xs text-white/50">2 min</span>
          </span>
        </a>
      </motion.div>
    </div>
  );
}