"use client";

import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarqueeReview {
  id: string;
  name: string;
  role: string;
  rating: number;
  avatarBg?: string;
  avatarText?: string;
  comment: string;
}

function AnimatedStarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-extrabold text-amber-500 dark:text-amber-400">{rating.toFixed(1)}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => {
          const isFull = i < full;
          const isHalf = i === full && hasHalf;

          return (
            <span
              key={i}
              className="star-shimmer inline-block"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              {isFull ? (
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
              ) : isHalf ? (
                <span className="relative inline-block h-3.5 w-3.5">
                  <Star className="absolute inset-0 h-3.5 w-3.5 fill-slate-200 dark:fill-slate-800 text-slate-200 dark:text-slate-800" />
                  <StarHalf className="absolute inset-0 h-3.5 w-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                </span>
              ) : (
                <Star className="h-3.5 w-3.5 fill-slate-200 dark:fill-slate-800 text-slate-200 dark:text-slate-800" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCardItem({ review }: { review: MarqueeReview }) {
  return (
    <div className="group relative w-[330px] shrink-0 rounded-2xl border border-purple-100/80 dark:border-slate-800/80 bg-white dark:bg-[#070a13] p-4 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-purple-300 dark:hover:border-purple-500/50 hover:bg-purple-50/40 dark:hover:bg-[#0f1427] hover:shadow-xl hover:shadow-purple-900/10 dark:hover:shadow-purple-900/20 sm:w-[370px] sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white shadow-md ring-2 ring-purple-100 dark:ring-white/10",
            review.avatarBg ?? "bg-purple-600",
          )}
        >
          {review.avatarText}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
            {review.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-medium">{review.role}</p>
        </div>
      </div>

      <div className="my-3 border-b border-slate-100 dark:border-slate-800/60" />

      <div className="mb-2">
        <AnimatedStarRating rating={review.rating} />
      </div>

      <p className="line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-normal sm:text-sm">
        {review.comment}
      </p>
    </div>
  );
}

export function AnimatedRatingMarquee({
  reviews,
  title = "What Students Say",
  subtitle,
}: {
  reviews: MarqueeReview[];
  title?: string;
  subtitle?: string;
}) {
  if (reviews.length === 0) return null;

  // Split the incoming reviews across two rows and duplicate each row so the
  // marquee can loop seamlessly.
  const half = Math.ceil(reviews.length / 2);
  const row1 = reviews.slice(0, half);
  const row2 = reviews.slice(half);
  const topRowItems = [...row1, ...row1, ...row1];
  const downRowItems = row2.length > 0 ? [...row2, ...row2, ...row2] : [];

  return (
    <section className="relative overflow-hidden bg-slate-50/70 dark:bg-[#070b14] border-y border-purple-100/60 dark:border-slate-800/80 py-12 text-gray-900 dark:text-white sm:py-16">
      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 dark:bg-purple-900/15 blur-[120px]"
      />

      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 mb-8 sm:mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-500/30 bg-purple-100/80 dark:bg-purple-950/50 px-3.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest">
          ⭐ Student Feedback
        </span>
        <h2 className="mt-3 font-display text-2xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Marquee Wrapper with side fade gradients */}
      <div className="relative w-full overflow-hidden">
        {/* Left & Right edge blur masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent dark:from-[#070b14] dark:via-[#070b14]/80 sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent dark:from-[#070b14] dark:via-[#070b14]/80 sm:w-32" />

        {/* TOP LAYER (Row 1): Moves RIGHT -> */}
        <div className="flex gap-4 py-2 sm:gap-5">
          <div className="animate-marquee-right flex gap-4 sm:gap-5">
            {topRowItems.map((rev, idx) => (
              <ReviewCardItem key={`top-${rev.id}-${idx}`} review={rev} />
            ))}
          </div>
        </div>

        {/* DOWN LAYER (Row 2): Moves LEFT <- */}
        {downRowItems.length > 0 && (
          <div className="mt-4 flex gap-4 py-2 sm:gap-5">
            <div className="animate-marquee-left flex gap-4 sm:gap-5">
              {downRowItems.map((rev, idx) => (
                <ReviewCardItem key={`down-${rev.id}-${idx}`} review={rev} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
