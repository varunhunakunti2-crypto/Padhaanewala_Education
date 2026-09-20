"use client";

import {
  X,
  GraduationCap,
  TrendingUp,
  BedDouble,
  Award,
  MapPin,
  IndianRupee,
  Briefcase,
  Building2,
  FileCheck2,
  Trophy,
} from "lucide-react";
import type { College } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";
import { formatINR, formatCount } from "@/lib/utils";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/compare/parts";
import { cn } from "@/lib/utils";

interface RowDef {
  label: string;
  icon: React.ReactNode;
  get: (c: College) => React.ReactNode;
  bestOf?: (c: College) => number;
  bestLow?: boolean;
}

function Row({ colleges }: { colleges: College[] }) {
  const { toggleCompare } = useApp();
  const rows: RowDef[] = [
    {
      label: "Location",
      icon: <MapPin className="h-4 w-4 text-purple-500" />,
      get: (c) => `${c.city}, ${c.state}`,
    },
    {
      label: "Type",
      icon: <Building2 className="h-4 w-4 text-blue-500" />,
      get: (c) => c.type,
    },
    {
      label: "Rating",
      icon: <Award className="h-4 w-4 text-amber-500" />,
      get: (c) => <Rating value={c.rating} showValue />,
      bestOf: (c) => c.rating,
    },
    {
      label: "Reviews",
      icon: <GraduationCap className="h-4 w-4 text-gray-400" />,
      get: (c) => `${formatCount(c.reviewCount)} reviews`,
      bestOf: (c) => c.reviewCount,
    },
    {
      label: "Cheapest annual fee",
      icon: <IndianRupee className="h-4 w-4 text-orange-500" />,
      get: (c) => `${formatINR(Math.min(...c.courses.map((x) => x.feePerYear)))}/yr`,
      bestOf: (c) => Math.min(...c.courses.map((x) => x.feePerYear)),
      bestLow: true,
    },
    {
      label: "Placement rate",
      icon: <Briefcase className="h-4 w-4 text-emerald-500" />,
      get: (c) => (
        <>
          <span className="font-bold tabular-nums">{c.placement.placementRate}%</span> ({c.placement.year})
        </>
      ),
      bestOf: (c) => c.placement.placementRate,
    },
    {
      label: "Avg. package",
      icon: <TrendingUp className="h-4 w-4 text-purple-500" />,
      get: (c) => formatINR(c.placement.averagePackage),
      bestOf: (c) => c.placement.averagePackage,
    },
    {
      label: "Highest package",
      icon: <TrendingUp className="h-4 w-4 text-orange-600" />,
      get: (c) => formatINR(c.placement.highestPackage),
      bestOf: (c) => c.placement.highestPackage,
    },
    {
      label: "Accreditation",
      icon: <Award className="h-4 w-4 text-blue-500" />,
      get: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.accreditation.map((a) => (
            <Badge key={a} variant="purple" className="text-xs">{a}</Badge>
          ))}
        </div>
      ),
    },
    {
      label: "Entrance exams",
      icon: <FileCheck2 className="h-4 w-4 text-orange-500" />,
      get: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.admission.entranceExams.map((e) => (
            <Badge key={e} variant="orange" className="text-xs">{e}</Badge>
          ))}
        </div>
      ),
    },
    {
      label: "Hostel",
      icon: <BedDouble className="h-4 w-4 text-blue-500" />,
      get: (c) => (
        <span className={c.facilities.hostel ? "font-semibold text-emerald-600" : "text-gray-400"}>
          {c.facilities.hostel ? "Yes" : "No"}
        </span>
      ),
    },
    {
      label: "Students",
      icon: <GraduationCap className="h-4 w-4 text-purple-500" />,
      get: (c) => formatCount(c.studentCount),
    },
    {
      label: "Established",
      icon: <Building2 className="h-4 w-4 text-gray-400" />,
      get: (c) => String(c.founded),
    },
    {
      label: "Top recruiters",
      icon: <Briefcase className="h-4 w-4 text-purple-500" />,
      get: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.placement.topRecruiters.slice(0, 4).map((r) => (
            <Badge key={r} variant="gray" className="text-xs">{r}</Badge>
          ))}
        </div>
      ),
    },
  ];

  const winnerFor = (row: RowDef): College | null => {
    if (!row.bestOf || colleges.length < 2) return null;
    return colleges.reduce((best, c) => {
      const a = row.bestOf!(c);
      const b = row.bestOf!(best);
      return row.bestLow ? (a < b ? c : best) : a > b ? c : best;
    }, colleges[0]!);
  };

  return (
    <div className="overflow-x-auto scroll-thin rounded-2xl bg-white ring-1 ring-purple-100/60 card-shadow">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-purple-100 bg-purple-50/60">
            <th className="sticky left-0 z-10 w-44 bg-purple-50/95 px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500 backdrop-blur">
              Comparison
            </th>
            {colleges.map((c) => (
              <th key={c.id} className="relative min-w-[230px] px-5 py-4">
                <button
                  aria-label={`Remove ${c.shortName}`}
                  onClick={() => toggleCompare(c.id, c.shortName)}
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-3">
                  <Logo c={c} size="h-11 w-11 rounded-lg" />
                  <div className="min-w-0 pr-6">
                    <a href={`/colleges/${c.slug}`} className="font-display block truncate font-bold text-gray-900 hover:text-purple-700">
                      {c.shortName}
                    </a>
                    <p className="truncate text-xs text-gray-500">{c.city}</p>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const winner = winnerFor(row);
            return (
              <tr key={row.label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                <td className="sticky left-0 z-10 w-44 bg-inherit px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    {row.icon}
                    {row.label}
                  </span>
                </td>
                {colleges.map((c) => {
                  const isBest = winner?.id === c.id;
                  return (
                    <td key={c.id} className="px-5 py-3.5 text-sm text-gray-800 align-top">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5",
                          isBest && "bg-emerald-50 ring-1 ring-inset ring-emerald-200",
                        )}
                      >
                        {row.get(c)}
                        {isBest && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                            <Trophy className="h-2.5 w-2.5" /> Best
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparisonTable({ colleges }: { colleges: College[] }) {
  return <Row colleges={colleges} />;
}