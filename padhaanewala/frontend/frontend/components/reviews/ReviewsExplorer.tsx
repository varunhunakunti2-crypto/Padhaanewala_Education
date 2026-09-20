"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, ThumbsUp, PenLine, BadgeCheck, Building2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Rating } from "@/components/ui/Rating";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { cn, initialsOf, formatDate } from "@/lib/utils";
import { COLLEGES } from "@/lib/data";
import { ALL_DEGREES } from "@/lib/data";
import type { Review } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";
import { AnimatedRatingMarquee } from "@/components/reviews/AnimatedRatingMarquee";

const ROLE_ICON: Record<Review["role"], typeof Building2> = {
  Alumni: Building2,
  Student: UserRound,
  Parent: UserRound,
};

const SAMPLE_REVIEWS: Review[] = COLLEGES.flatMap((c, ci) =>
  c.reviews.map((r) => ({
    ...r,
    collegeId: c.id,
    collegeName: c.shortName,
    collegeSlug: c.slug,
  })),
).slice(0, 12);

interface ExtendedReview extends Review {
  collegeId?: string;
  collegeName?: string;
  collegeSlug?: string;
}

export function ReviewCard({ review, showCollege = false }: { review: ExtendedReview; showCollege?: boolean }) {
  const [helpful, setHelpful] = useState(review.helpful);
  const [voted, setVoted] = useState(false);
  const Icon = ROLE_ICON[review.role] ?? UserRound;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:border-purple-200 dark:hover:border-purple-600 hover:shadow-lg hover:shadow-purple-900/5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 dark:bg-purple-950/70 text-sm font-bold text-purple-700 dark:text-purple-300">
          {review.initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{review.author}</p>
            {review.verified && (
              <span title="Verified review"><BadgeCheck className="h-4 w-4 text-green-500" /></span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Icon className="h-3 w-3" /> {review.role} · {review.program}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Rating value={review.rating} size={14} showValue />
        <span className="text-[11px] text-slate-400">{formatDate(review.date)}</span>
      </div>

      <h3 className="mt-2 font-semibold text-gray-900 dark:text-slate-100">{review.title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{review.body}</p>

      {showCollege && review.collegeSlug && (
        <Link
          href={`/colleges/${review.collegeSlug}`}
          className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 transition hover:bg-purple-50 dark:hover:bg-purple-950/50"
        >
          <Building2 className="h-3.5 w-3.5" /> {review.collegeName}
        </Link>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => {
            setHelpful((h) => h + (voted ? -1 : 1));
            setVoted((v) => !v);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            voted ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-300",
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({helpful})
        </button>
      </div>
    </div>
  );
}

export function ReviewForm({ collegeShortName, onDone }: { collegeShortName?: string; onDone?: () => void }) {
  const { addReview } = useApp();
  const [form, setForm] = useState({
    college: collegeShortName ?? "",
    course: "",
    year: "",
    name: "",
    role: "Student" as Review["role"],
    rating: 5,
    title: "",
    body: "",
  });
  const [hovered, setHovered] = useState(0);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const author = form.name.trim() || "Anonymous";
    addReview({
      id: `rv-${Date.now()}`,
      author,
      initials: initialsOf(author),
      role: form.role,
      program: form.course,
      rating: form.rating,
      title: form.title,
      body: form.body,
      date: new Date().toISOString(),
      helpful: 0,
      verified: false,
    });
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {!collegeShortName && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rv-col">College *</Label>
          <Select
            id="rv-col"
            value={form.college}
            onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
            required
          >
            <option value="">Select a college</option>
            {COLLEGES.map((c) => (
              <option key={c.id} value={c.shortName}>{c.shortName}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rv-course">Course *</Label>
        <Select id="rv-course" value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} required>
          <option value="">Select course</option>
          {ALL_DEGREES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-year">Year *</Label>
        <Select id="rv-year" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} required>
          <option value="">Select year</option>
          <option>Class of 2026</option>
          <option>Class of 2025</option>
          <option>Class of 2024</option>
          <option>Class of 2023</option>
          <option>Current Student</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-name">Your name</Label>
        <Input id="rv-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Optional" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-role">Your status</Label>
        <Select id="rv-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Review["role"] }))}>
          <option>Student</option>
          <option>Alumni</option>
          <option>Parent</option>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label>Your rating *</Label>
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Rate ${i} star`}
              onClick={() => setForm((f) => ({ ...f, rating: i }))}
              onMouseEnter={() => setHovered(i)}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition",
                  (hovered || form.rating) >= i ? "fill-amber-400 text-amber-400" : "text-slate-300",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rv-title">Review title *</Label>
        <Input id="rv-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="One-line summary" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rv-body">Your review *</Label>
        <textarea
          id="rv-body"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          rows={4}
          required
          placeholder="Share your experience — academics, faculty, campus, placements..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" size="lg" className="w-full">
          <PenLine className="h-4 w-4" /> Submit review
        </Button>
      </div>
    </form>
  );
}

export function ReviewsExplorer() {
  const { reviews } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState("All");
  const [college, setCollege] = useState("All");

  const all = useMemo<ExtendedReview[]>(() => {
    const base: ExtendedReview[] = SAMPLE_REVIEWS.map((r) => r as ExtendedReview);
    const user: ExtendedReview[] = reviews.map((r) => ({ ...r, collegeId: "", collegeName: undefined, collegeSlug: undefined }));
    return [...user, ...base];
  }, [reviews]);

  const filtered = all.filter(
    (r) => (role === "All" || r.role === role) && (college === "All" || r.collegeName === college),
  );

  const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-900 dark:via-purple-950/50 dark:to-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-display text-4xl font-extrabold text-purple-900 dark:text-purple-300">{avg.toFixed(1)}</p>
            <Rating value={Math.round(avg)} size={14} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{all.length} verified reviews</p>
            <p className="text-xs text-slate-500 dark:text-gray-300">Across {COLLEGES.length} colleges on Padhaanewala</p>
          </div>
        </div>
        <Button variant="accent" onClick={() => setShowForm(true)}>
          <PenLine className="h-4 w-4" /> Write a review
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", "Student", "Alumni", "Parent"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              role === r ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 bg-white text-slate-600",
            )}
          >
            {r === "All" ? "All roles" : r}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-52">
          <Select value={college} onChange={(e) => setCollege(e.target.value)}>
            <option value="All">All colleges</option>
            {COLLEGES.map((c) => (
              <option key={c.id} value={c.shortName}>{c.shortName}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => (
          <ReviewCard key={r.id} review={r} showCollege />
        ))}
      </div>

      {!filtered.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          No reviews match your filters.
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Write a review">
        <ReviewForm onDone={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}