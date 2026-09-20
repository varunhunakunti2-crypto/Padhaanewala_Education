"use client";

import { MotionConfig } from "motion/react";
import { HeroBackground } from "@/components/home/hero/HeroBackground";
import { HeroContent } from "@/components/home/hero/HeroContent";
import { HeroVisualPanel } from "@/components/home/hero/HeroVisualPanel";

export function HeroSection() {
  return (
    <section
      aria-label="Find your college — CampusMap hero"
      className="relative z-30 flex min-h-[100svh] flex-col bg-navy"
    >
      <HeroBackground imageUrl="/hero-bd.png" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pt-24 sm:px-6 lg:px-8 lg:pt-28 lg:pb-10">
        <MotionConfig reducedMotion="user">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <HeroContent />
            <HeroVisualPanel />
          </div>
        </MotionConfig>
      </div>
    </section>
  );
}