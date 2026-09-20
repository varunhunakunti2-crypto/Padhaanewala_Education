"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { getCollegesByIds, getRecommendedColleges, getRecommendationReason } from "@/lib/data/colleges";
import { CollegeCard } from "@/components/college/CollegeCard";
import { Reveal } from "@/components/ui/Reveal";

export function PickedForYou() {
  const { recentViews } = useApp();
  const recs = getRecommendedColleges(recentViews, 3);
  const reason = getRecommendationReason(getCollegesByIds(recentViews));

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-white to-purple-50/50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-3.5 py-1.5 text-white">
                <Wand2 className="h-3.5 w-3.5" /> Personalised
              </p>
              <h2 className="section-title font-display font-extrabold text-purple-950">
                Picked for you <span className="not-italic">✨</span>
              </h2>
              <p className="mt-3 max-w-lg flex flex-wrap items-center gap-2 text-base text-gray-500">
                <Sparkles className="h-4 w-4 text-orange-500" />
                {reason}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-purple-700"
            >
              Open your dashboard{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recs.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08}>
              <CollegeCard college={c} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}