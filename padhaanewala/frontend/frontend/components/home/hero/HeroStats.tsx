"use client";

import { motion, useReducedMotion } from "motion/react";

const STATS = [
  { value: "12K+", label: "Colleges", sub: "Across India", accent: "bg-purple-500" },
  { value: "500+", label: "Courses", sub: "Find your path", accent: "bg-blue-500" },
  { value: "2.4M+", label: "Students", sub: "Trust our platform", accent: "bg-amber-400" },
  { value: "98%", label: "Satisfaction", sub: "From verified reviews", accent: "bg-orange-500" },
];

export function HeroStats() {
  const reduce = useReducedMotion();
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
      {STATS.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 + i * 0.09, duration: 0.45, ease: "easeOut" }}
          className="sm:pl-5 sm:first:pl-0"
        >
          <span aria-hidden className={`block h-1 w-8 rounded-full ${s.accent}`} />
          <p className="mt-2.5 font-display text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-[2rem]">
            {s.value}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white/90">{s.label}</p>
          <p className="text-xs text-white/50">{s.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}