import Link from "next/link";
import { BadgeCheckIcon, StarIcon } from "@/components/icons";
import type { College } from "@/data/colleges";

export default function CollegeCard({ college }: { college: College }) {
  return (
    <Link
      href={`/college/${college.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
          {college.name}
        </h3>
        {college.verified && (
          <BadgeCheckIcon className="h-5 w-5 shrink-0 text-emerald-600" />
        )}
      </div>
      <p className="mt-1.5 text-sm text-neutral-500">
        {college.type} · {college.location}
      </p>

      <div className="mt-4 flex items-center gap-1 text-sm text-neutral-700">
        <StarIcon className="h-4 w-4 text-amber-400" />
        <span className="font-semibold">{college.rating}</span>
        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          {college.placement}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4">
        <div>
          <dt className="text-xs text-neutral-500">Annual Fees</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
            {college.fees}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Hostel</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
            {college.hasHostel ? "Available" : "Not available"}
          </dd>
        </div>
      </dl>

      <span className="mt-4 inline-flex w-fit items-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-neutral-800">
        View Details
      </span>
    </Link>
  );
}