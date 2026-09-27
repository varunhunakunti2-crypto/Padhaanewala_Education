"use client";

import {
  AnimatedRatingMarquee,
  type MarqueeReview,
} from "@/components/reviews/AnimatedRatingMarquee";

/**
 * Renders nothing until real reviews are supplied.
 *
 * This section used to render 14 hardcoded testimonials copied from a coding
 * school's own website — named students, star ratings and "I landed my dream
 * tech job" quotes that had nothing to do with this platform and no record
 * behind them. There is no public reviews endpoint yet, so `reviews` is
 * currently always empty and the section is absent from the page.
 */
export function StudentTestimonials({ reviews = [] }: { reviews?: MarqueeReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <AnimatedRatingMarquee
      reviews={reviews}
      title="What Students Say"
      subtitle="Ratings and reviews left by students on their college profiles."
    />
  );
}
