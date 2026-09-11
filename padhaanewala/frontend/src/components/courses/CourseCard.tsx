import Link from "next/link";
import { ArrowRightIcon, StarIcon } from "@/components/icons";
import type { Course } from "@/data/courses";

function tint(index: number) {
  const tints = [
    "bg-fuchsia-50 border-fuchsia-100",
    "bg-teal-50 border-teal-100",
    "bg-violet-50 border-violet-100",
    "bg-amber-50 border-amber-100",
    "bg-sky-50 border-sky-100",
    "bg-rose-50 border-rose-100",
    "bg-lime-50 border-lime-100",
    "bg-indigo-50 border-indigo-100",
    "bg-orange-50 border-orange-100",
    "bg-cyan-50 border-cyan-100",
  ];
  return tints[index % tints.length];
}

export default function CourseCard({ course, index }: { course: Course; index: number }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className={`group flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md ${tint(index)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-neutral-950 shadow-sm">
          {course.short}
        </span>
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-neutral-800">
          <StarIcon className="h-4 w-4 text-amber-400" />
          {course.colleges} colleges
        </span>
      </div>

      <h3 className="mt-4 text-base font-bold leading-snug text-neutral-950 group-hover:text-neutral-700">
        {course.name}
      </h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {course.category} · {course.duration}
      </p>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{course.tagline}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {course.careers.slice(0, 2).map((career) => (
          <span
            key={career}
            className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-neutral-600"
          >
            {career}
          </span>
        ))}
      </div>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
        Explore colleges
        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}