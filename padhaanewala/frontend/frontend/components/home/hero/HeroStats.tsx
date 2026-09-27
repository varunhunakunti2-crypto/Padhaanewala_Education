"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Catalogue counts come from the API via the home page.
 *
 * This used to show four hardcoded marketing numbers — "12K+ Colleges",
 * "500+ Courses", "2.4M+ Students" and "98% Satisfaction". None of them were
 * measured: the catalogue held 10 invented colleges, no user accounts at all,
 * and there is no review data behind the satisfaction figure. "Students" and
 * "Satisfaction" are gone entirely rather than guessed at; colleges and courses
 * are now the real row counts returned by the backend, and the strip disappears
 * when the catalogue is empty.
 */
export function HeroStats({ colleges, courses }: { colleges: number; courses: number }) {
  const reduce = useReducedMotion();

  const stats = [
    { value: colleges, label: "Colleges", sub: "Verified Karnataka listings" },
    { value: courses, label: "Courses", sub: "Published so far" },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-2 sm:divide-x sm:divide-white/10">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 + i * 0.09, duration: 0.45, ease: "easeOut" }}
          className="sm:pl-5 sm:first:pl-0"
        >
          <span aria-hidden className="block h-1 w-8 rounded-full bg-purple-500" />
          <p className="mt-2.5 font-display text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-[2rem]">
            {s.value.toLocaleString("en-IN")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white/90">{s.label}</p>
          <p className="text-xs text-white/50">{s.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}
