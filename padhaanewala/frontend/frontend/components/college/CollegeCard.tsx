"use client";

import Link from "next/link";
import {
  MapPin,
  Heart,
  Scale,
  GraduationCap,
  TrendingUp,
  IndianRupee,
  BedDouble,
  Award,
  BadgeCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import type { College } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";
import { cn, formatINR, matchScore } from "@/lib/utils";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { CampusArt, CollegeLogo } from "@/components/college/CampusArt";

interface CollegeCardProps {
  college: College;
}

export function CollegeCard({ college }: CollegeCardProps) {
  const { isSaved, toggleSave, isComparing, toggleCompare } = useApp();
  const saved = isSaved(college.id);
  const comparing = isComparing(college.id);
  const minFee = Math.min(...college.courses.map((c) => c.feePerYear));
  const maxFee = Math.max(...college.courses.map((c) => c.feePerYear));
  const popular = college.courses.slice(0, 3);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-purple-100/60 dark:ring-slate-800 card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover hover:ring-purple-200 dark:hover:ring-slate-700">
      <div className="relative">
        <Link href={`/colleges/${college.slug}`} className="block" aria-label={`View ${college.shortName}`}>
          <CampusArt
            gradientId={college.gradientId}
            initials={college.initials}
            className="h-32 w-full transition-transform duration-500 group-hover:scale-[1.05] sm:h-36"
          />
        </Link>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <span className="match-badge rounded-full px-2.5 py-1 font-accent text-[11px] font-bold">
            {matchScore(college.id)}% Match
          </span>
          {college.featured && (
            <Badge variant="yellow" className="shadow-sm">
              <BadgeCheck className="h-3 w-3" /> Featured
            </Badge>
          )}
        </div>
        <button
          aria-label={saved ? `Remove ${college.shortName} from saved` : `Save ${college.shortName}`}
          aria-pressed={saved}
          onClick={() => toggleSave(college.id, college.shortName)}
          className={cn(
            "absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full shadow-md transition-all",
            saved
              ? "bg-warm-gradient text-white animate-pop-in"
              : "bg-white/95 dark:bg-slate-800/90 text-gray-500 dark:text-slate-300 backdrop-blur hover:text-red-500",
          )}
        >
          <Heart className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <CollegeLogo
              initials={college.initials}
              gradientId={college.gradientId}
              size="md"
              className="-mt-8 ring-4 ring-white dark:ring-slate-900"
            />
            <div className="min-w-0">
              <Link
                href={`/colleges/${college.slug}`}
                className="font-display text-[1.06rem] font-bold leading-snug text-gray-900 dark:text-slate-100 transition-colors hover:text-purple-700 dark:hover:text-purple-300 line-clamp-2"
              >
                {college.shortName}
              </Link>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                {college.city}, {college.state}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Rating value={college.rating} showValue count={college.reviewCount} />
          <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
          <Badge variant={college.sector === "Government" ? "blue" : "orange"}>
            {college.sector}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {college.rankings.slice(0, 1).map((r) => (
            <Badge key={r.agency} variant="amber">
              <Award className="h-3 w-3" /> {r.agency} #{r.rank}
            </Badge>
          ))}
          {college.accreditation.slice(0, 2).map((a) => (
            <Badge key={a} variant="purple">
              {a}
            </Badge>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {popular.map((course) => (
            <p
              key={course.name}
              className="flex items-center gap-1.5 truncate text-xs text-gray-600 dark:text-slate-300"
            >
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="truncate">{course.name}</span>
            </p>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-purple-50/60 dark:bg-slate-800/80 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <IndianRupee className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {minFee === maxFee ? formatINR(minFee) : `${formatINR(minFee)} – ${formatINR(maxFee)}`}/yr
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="font-semibold text-gray-900 dark:text-slate-100">{college.placement.placementRate}% placed</span>
          </span>
          {college.facilities.hostel && (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-300" title="Hostel available">
              <BedDouble className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span className="hidden sm:inline">Hostel</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-slate-800 pt-3">
          <Link
            href={`/colleges/${college.slug}`}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient text-sm font-semibold text-white transition hover:brightness-110"
          >
            View College <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            aria-pressed={comparing}
            onClick={() => toggleCompare(college.id, college.shortName)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold ring-1 ring-inset transition",
              comparing
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-700 animate-pop-in"
                : "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700",
            )}
          >
            {comparing ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
            {comparing ? "Added" : "Compare"}
          </button>
        </div>
      </div>
    </article>
  );
}