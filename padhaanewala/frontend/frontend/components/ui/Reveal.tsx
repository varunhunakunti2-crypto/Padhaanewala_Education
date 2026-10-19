"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInView } from "@/components/ui/useInView";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/**
 * Fade-and-rise on scroll.
 *
 * This was a `motion.div` with `whileInView`, which put the whole
 * `motion/react` runtime in the client bundle for one opacity/transform
 * transition. The styles live in `globals.css` (`.reveal` / `.reveal.is-visible`,
 * including the reduced-motion override that neutralises them) and `useInView`
 * supplies the trigger.
 */
export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>("-60px");
  return (
    <div
      ref={ref}
      className={cn("reveal", inView && "is-visible", className)}
      style={{ "--reveal-y": `${y}px`, transitionDelay: `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
