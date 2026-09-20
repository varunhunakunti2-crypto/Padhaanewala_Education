import Link from "next/link";
import { Flame, Star, TrendingUp, IndianRupee, MapPin } from "lucide-react";
import { COLLEGES } from "@/lib/data/colleges";
import { formatINR, formatCount, matchScore } from "@/lib/utils";
import { CampusArt } from "@/components/college/CampusArt";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

export function TrendingColleges() {
  const trending = [...COLLEGES]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 8);

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-white via-purple-50/60 to-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3.5 py-1.5 text-orange-600 ring-1 ring-inset ring-orange-200">
                <Flame className="h-3.5 w-3.5" /> On the rise
              </p>
              <h2 className="section-title font-display font-extrabold text-purple-950">
                Trending colleges <span className="not-italic">🔥</span>
              </h2>
              <p className="mt-3 max-w-lg text-base leading-relaxed text-gray-500">
                The most talked-about colleges right now — ranked by search
                volume and student engagement.
              </p>
            </div>
            <ButtonLink href="/colleges" variant="outline" size="sm" className="hidden sm:inline-flex">
              View all <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Reveal>

        <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {trending.map((c, i) => (
            <div key={c.id} className="w-[260px] shrink-0 snap-start sm:w-[280px] lg:w-auto">
              <Reveal delay={i * 0.06} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-purple-100/70 card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover">
                  <Link
                    href={`/colleges/${c.slug}`}
                    className="relative block"
                    aria-label={`View ${c.shortName}`}
                  >
                    <CampusArt
                      gradientId={c.gradientId}
                      initials={c.initials}
                      className="h-36 w-full transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-warm-gradient px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                      <Flame className="h-3 w-3" /> Trending
                    </span>
                    <span className="match-badge absolute right-3 top-3 rounded-full px-2.5 py-1 font-accent text-[11px] font-bold">
                      {matchScore(c.id)}% Match
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <Link
                      href={`/colleges/${c.slug}`}
                      className="font-display text-[1.05rem] font-bold leading-snug text-gray-900 transition-colors hover:text-purple-700 line-clamp-1"
                    >
                      {c.shortName}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3.5 w-3.5 text-purple-400" />
                      {c.city}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {c.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400">{formatCount(c.reviewCount)} reviews</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-purple-50/60 dark:bg-slate-800/80 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-slate-400">
                        <IndianRupee className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="font-semibold text-gray-900 dark:text-slate-100">
                          {formatINR(Math.min(...c.courses.map((x) => x.feePerYear)))}/yr
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-slate-400">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span className="font-semibold text-gray-900 dark:text-slate-100">{c.placement.placementRate}%</span>
                      </span>
                    </div>

                    <Link
                      href={`/colleges/${c.slug}`}
                      className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Explore <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}