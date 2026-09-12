import Link from "next/link";
import { AwardIcon, ClockIcon } from "@/components/icons";
import type { Scholarship } from "@/data/scholarships";

export default function ScholarshipCard({
  scholarship,
}: {
  scholarship: Scholarship;
}) {
  return (
    <Link
      href={`/scholarships/${scholarship.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <AwardIcon className="h-7 w-7 shrink-0 text-amber-500" />
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          {scholarship.ownership === "government" ? "Government" : "Private"}
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
        {scholarship.name}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">{scholarship.provider}</p>

      <p className="mt-3 text-xs leading-relaxed text-neutral-600">
        {scholarship.eligibility}
      </p>

      <div className="mt-4 flex items-end justify-between gap-2 border-t border-black/5 pt-4">
        <div>
          <p className="text-xs text-neutral-500">Scholarship amount</p>
          <p className="text-sm font-bold text-emerald-700">{scholarship.amount}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-neutral-500">Deadline</p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-800">
            <ClockIcon className="h-3.5 w-3.5 text-neutral-400" />
            {scholarship.deadline}
          </span>
        </div>
      </div>
    </Link>
  );
}