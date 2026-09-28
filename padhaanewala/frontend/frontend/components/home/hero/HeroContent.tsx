"use client";

import { motion, useReducedMotion } from "motion/react";
import { Flame, Scale } from "lucide-react";
import Link from "next/link";
import { HeroSearch } from "@/components/home/hero/HeroSearch";
import { HeroStats } from "@/components/home/hero/HeroStats";

export function HeroContent({
  collegeCount = 0,
  courseCount = 0,
}: {
  collegeCount?: number;
  courseCount?: number;
}) {
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
        {/* Secondary CTA. This was the AI College Predictor, which is de-listed:
            the predictor's ranking data (`cutoffs`, `seat_matrix`) is empty, so
            the button led to a page that could only ever say "no results". */}
        <div className="mt-3">
          <Link
            href="/compare"
            className="btn-uiverse-arrow text-sm font-bold"
          >
            <Scale className="h-4 w-4" />
            <span>Compare Colleges</span>
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
      <HeroStats colleges={collegeCount} courses={courseCount} />

      {/* The "Watch how it works — 2 min" video CTA used to live here, anchored
          to `#how-it-works`. No element on any page carried that id, so the
          site's largest call to action did nothing but claim a video exists.
          Removed rather than repointed: there is no video to link to. */}
    </div>
  );
}
