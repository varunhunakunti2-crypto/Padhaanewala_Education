"use client";

import { X, MapPin, TrendingUp } from "lucide-react";
import type { College } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";
import { formatINR } from "@/lib/utils";
import { Rating } from "@/components/ui/Rating";
import { Logo } from "@/components/compare/parts";

export default function ComparisonCards({ colleges }: { colleges: College[] }) {
  const { toggleCompare } = useApp();
  return (
    <div className="space-y-4">
      {colleges.map((c) => (
        <article key={c.id} className="relative rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow">
          <button
            aria-label={`Remove ${c.shortName}`}
            onClick={() => toggleCompare(c.id, c.shortName)}
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-4">
            <Logo c={c} size="h-12 w-12 rounded-xl" />
            <div>
              <a href={`/colleges/${c.slug}`} className="font-display font-bold text-gray-900 hover:text-purple-700">
                {c.shortName}
              </a>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3.5 w-3.5" /> {c.city}, {c.state}
              </p>
              <Rating value={c.rating} className="mt-1" showValue count={c.reviewCount} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Fees / yr</p>
              <p className="font-semibold text-gray-900 tabular-nums">
                {formatINR(Math.min(...c.courses.map((x) => x.feePerYear)))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Placement</p>
              <p className="font-bold text-emerald-600 tabular-nums">{c.placement.placementRate}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg. package</p>
              <p className="font-semibold text-gray-900 tabular-nums">{formatINR(c.placement.averagePackage)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Hostel</p>
              <p className={c.facilities.hostel ? "font-semibold text-emerald-600" : "text-gray-400"}>
                {c.facilities.hostel ? "Available" : "No"}
              </p>
            </div>
            <div className="col-span-2 border-t border-gray-100 pt-2">
              <p className="mb-1 flex items-center gap-1 text-xs text-gray-400">
                <TrendingUp className="h-3.5 w-3.5" /> Programs
              </p>
              <div className="flex flex-wrap gap-1">
                {c.courses.slice(0, 3).map((course) => (
                  <span key={course.name} className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-medium text-purple-700">
                    {course.degree}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}