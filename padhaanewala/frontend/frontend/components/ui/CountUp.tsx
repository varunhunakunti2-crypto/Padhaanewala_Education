"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/components/ui/useInView";

interface CountUpProps {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

/**
 * `easeOutExpo`, standing in for the `cubic-bezier(0.16, 1, 0.3, 1)` the motion
 * version animated with. The two are visually indistinguishable over a ~1.4s
 * count, and this keeps the animation entirely in this file instead of the
 * `motion/react` runtime.
 */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUp({ to, suffix = "", prefix = "", duration = 1400, className }: CountUpProps) {
  const [ref, inView] = useInView<HTMLSpanElement>("-40px");
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A zero-length run still resolves on the first frame, so the
    // reduced-motion path settles on the final value without a synchronous
    // setState in the effect body.
    const ms = reduce ? 0 : duration;

    // rAF rather than an interval so the count is in step with the frame; the
    // previous `animate(0, to, …)` was the only reason motion was imported here.
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = ms <= 0 ? 1 : Math.min((now - start) / ms, 1);
      setValue(Math.round(easeOutExpo(progress) * to));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
