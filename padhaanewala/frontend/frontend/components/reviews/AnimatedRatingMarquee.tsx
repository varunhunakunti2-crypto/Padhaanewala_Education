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

// TOP ROW (Row 1): Moves RIGHT ->
const DEFAULT_ROW1: MarqueeReview[] = [
  {
    id: "r1",
    name: "Honey Atalkar",
    role: "Software Engineering Student",
    rating: 4.2,
    avatarBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    avatarText: "HA",
    comment: "Sheryians Coding School – Best Place To Learn Coding Offline! ☀️ The Teachers Explain Every Topic Step By Step",
  },
  {
    id: "r2",
    name: "Parth gup Ta",
    role: "Frontend Developer",
    rating: 4.7,
    avatarBg: "bg-gradient-to-br from-purple-600 to-indigo-600",
    avatarText: "P",
    comment: "Learning At Sheryians Coding School Has Been An Amazing Experience! The Mentors Explain Everything Clearly",
  },
  {
    id: "r3",
    name: "Mohd Siraj",
    role: "Web Developer",
    rating: 4.1,
    avatarBg: "bg-gradient-to-br from-blue-600 to-cyan-600",
    avatarText: "MS",
    comment: "I Had A Great Experience At Coaching. They Are Highly Supportive And Knowledgeable Mentors",
  },
  {
    id: "r4",
    name: "Neha Sharma",
    role: "UI/UX Designer",
    rating: 4.9,
    avatarBg: "bg-gradient-to-br from-pink-500 to-rose-600",
    avatarText: "NS",
    comment: "The practical project-based learning model helped me land my dream tech job within 3 months!",
  },
  {
    id: "r5",
    name: "Vikram Rathore",
    role: "Full Stack Engineer",
    rating: 4.8,
    avatarBg: "bg-gradient-to-br from-emerald-500 to-teal-700",
    avatarText: "VR",
    comment: "Concepts of Data Structures & Algorithms were explained from absolute scratch with real industry examples.",
  },
  {
    id: "r6",
    name: "Priyanshu Gupta",
    role: "System Engineer",
    rating: 4.6,
    avatarBg: "bg-gradient-to-br from-red-500 to-amber-600",
    avatarText: "PG",
    comment: "Mentors guide you 1-on-1 throughout the course. Highly recommended for every tech enthusiast!",
  },
  {
    id: "r7",
    name: "Ananya Sen",
    role: "React Native Developer",
    rating: 4.9,
    avatarBg: "bg-gradient-to-br from-violet-600 to-purple-800",
    avatarText: "AS",
    comment: "Outstanding coding environment! The live coding sessions & peer code reviews doubled my confidence.",
  },
];

// DOWN ROW (Row 2): Moves LEFT <-
const DEFAULT_ROW2: MarqueeReview[] = [
  {
    id: "r8",
    name: "Akshat Sahu",
    role: "Software Developer",
    rating: 4.7,
    avatarBg: "bg-gradient-to-br from-yellow-500 to-amber-600",
    avatarText: "AS",
    comment: "The Best Institute Is In Bhopal. I Have Learnt A Lot By Coming Here. After Coming Here, I Just Started Coding",
  },
  {
    id: "r9",
    name: "Om Singhal",
    role: "Backend Developer",
    rating: 4.4,
    avatarBg: "bg-gradient-to-br from-rose-500 to-red-600",
    avatarText: "OS",
    comment: "☀️ Sheryians Coding School – Best Place To Learn Coding Online! ☀️ I Am Currently Learning Coding",
  },
  {
    id: "r10",
    name: "Aditya Kumar",
    role: "Coding Mentor",
    rating: 4.2,
    avatarBg: "bg-gradient-to-br from-indigo-500 to-purple-700",
    avatarText: "AK",
    comment: "We Proudly Share Our Teaching Coding School, Helping Students Master New Technologies",
  },
  {
    id: "r11",
    name: "Sneha Patel",
    role: "DevOps Engineer",
    rating: 4.8,
    avatarBg: "bg-gradient-to-br from-teal-500 to-emerald-600",
    avatarText: "SP",
    comment: "Top notch curriculum with live doubts support! Never felt lost during any complex programming module.",
  },
  {
    id: "r12",
    name: "Rohan Verma",
    role: "AI & ML Aspirant",
    rating: 4.6,
    avatarBg: "bg-gradient-to-br from-violet-600 to-fuchsia-600",
    avatarText: "RV",
    comment: "Hands down the best place to clear your coding fundamentals and build impressive portfolio projects!",
  },
  {
    id: "r13",
    name: "Devansh Saxena",
    role: "Cloud Architect",
    rating: 4.7,
    avatarBg: "bg-gradient-to-br from-sky-500 to-blue-700",
    avatarText: "DS",
    comment: "Super smooth learning curve! Every complex backend architecture topic was broken down effortlessly.",
  },
  {
    id: "r14",
    name: "Ishita Roy",
    role: "Cybersecurity Specialist",
    rating: 4.9,
    avatarBg: "bg-gradient-to-br from-orange-500 to-pink-600",
    avatarText: "IR",
    comment: "Best investment in my tech career. The live projects gave me true hands-on engineering exposure!",
  },
];

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
  title = "What Students Say",
  subtitle = "Real reviews & ratings from thousands of aspiring coders & learners",
}: {
  title?: string;
  subtitle?: string;
}) {
  // Duplicate arrays to create infinite seamless loop
  const topRowItems = [...DEFAULT_ROW1, ...DEFAULT_ROW1, ...DEFAULT_ROW1];
  const downRowItems = [...DEFAULT_ROW2, ...DEFAULT_ROW2, ...DEFAULT_ROW2];

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
        <div className="mt-4 flex gap-4 py-2 sm:gap-5">
          <div className="animate-marquee-left flex gap-4 sm:gap-5">
            {downRowItems.map((rev, idx) => (
              <ReviewCardItem key={`down-${rev.id}-${idx}`} review={rev} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
