"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { Heart, Scale, ArrowRight } from "lucide-react";
import { cn, BANNER_GRADIENTS } from "@/lib/utils";
import type { College } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function ViewTracker({ collegeId }: { collegeId: string }) {
  const { addRecentView } = useApp();
  useEffect(() => {
    addRecentView(collegeId);
  }, [collegeId, addRecentView]);
  return null;
}

export function HelpfulButton({ count }: { count: number }) {
  const { showToast } = useApp();
  return (
    <button
      onClick={() => showToast({ variant: "success", title: "Thanks for the feedback!" })}
      className="mt-3 inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
    >
      👍 Helpful ({count})
    </button>
  );
}

interface ActionsProps {
  collegeId: string;
  shortName: string;
  className?: string;
}

export function CollegeActions({ collegeId, shortName, className }: ActionsProps) {
  const { isSaved, toggleSave, isComparing, toggleCompare, compareFull, showToast } = useApp();
  const saved = isSaved(collegeId);
  const comparing = isComparing(collegeId);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Button
        variant="warm-gradient"
        onClick={() => showToast({ variant: "success", title: "Application started", description: `You're on your way to ${shortName}.` })}
        className="w-full"
        size="lg"
      >
        Apply Now
        <ArrowRight className="h-4 w-4" />
      </Button>
      <Button
        variant={saved ? "warm" : "accent"}
        onClick={() => toggleSave(collegeId, shortName)}
        className="w-full"
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current animate-pop-in")} />
        {saved ? "Saved" : "Save College"}
      </Button>
      <Button
        variant={comparing ? "secondary" : "outline"}
        disabled={!comparing && compareFull}
        onClick={() => toggleCompare(collegeId, shortName)}
        className="w-full"
      >
        <Scale className="h-4 w-4" />
        {comparing ? "In Compare List" : "Add to Compare"}
      </Button>
    </div>
  );
}

export function StickyMobileActions({ collegeId, shortName }: { collegeId: string; shortName: string }) {
  const { isSaved, toggleSave, isComparing, toggleCompare, showToast } = useApp();
  const saved = isSaved(collegeId);
  const comparing = isComparing(collegeId);

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-purple-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl gap-2">
        <button
          onClick={() => toggleSave(collegeId, shortName)}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
            saved
              ? "bg-warm-gradient text-white"
              : "bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 ring-1 ring-purple-200 dark:ring-slate-700 hover:bg-purple-100 dark:hover:bg-slate-700",
          )}
        >
          <Heart className={cn("h-4 w-4", saved && "fill-current animate-pop-in")} />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => toggleCompare(collegeId, shortName)}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
            comparing
              ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-slate-700"
              : "bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 ring-1 ring-purple-200 dark:ring-slate-700 hover:bg-purple-100 dark:hover:bg-slate-700",
          )}
        >
          <Scale className="h-4 w-4" />
          Compare
        </button>
        <button
          onClick={() => showToast({ variant: "success", title: "Application started", description: `You're on your way to ${shortName}.` })}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-warm-gradient text-sm font-bold text-white shadow-md shadow-orange-500/30"
        >
          Apply Now <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface FaqProps {
  faqs: { q: string; a: string }[];
}

export function FaqAccordion({ faqs }: FaqProps) {
  return (
    <section id="faq" className="py-10">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-purple-950 lg:text-3xl">
        Frequently Asked Questions
      </h2>
      <div className="mt-5 space-y-3">
        {faqs.map((faq, i) => (
          <details key={i} className="group rounded-2xl bg-white ring-1 ring-purple-100/60 card-shadow">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-gray-900 open:text-purple-700">
              {faq.q}
              <span className="shrink-0 grid h-6 w-6 place-items-center rounded-full bg-gray-100 transition group-open:bg-purple-100 group-open:rotate-180">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path d="M2.5 4.5 6 8 9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

interface SimilarProps {
  colleges: College[];
}

export function SimilarColleges({ colleges }: SimilarProps) {
  return (
    <section className="py-10">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-purple-950 lg:text-3xl">
        Similar Colleges
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {colleges.map((c) => (
          <a
            key={c.id}
            href={`/colleges/${c.slug}`}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-purple-100/60 card-shadow transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm ring-1 ring-white ${BANNER_GRADIENTS[c.gradientId] ?? BANNER_GRADIENTS.g0}`}
            >
              {c.initials}
            </span>
            <div className="min-w-0">
              <p className="font-display truncate font-bold text-gray-900">{c.shortName}</p>
              <p className="truncate text-xs text-gray-500">{c.city}, {c.state}</p>
              <p className="text-xs font-semibold text-amber-600">★ {c.rating}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}