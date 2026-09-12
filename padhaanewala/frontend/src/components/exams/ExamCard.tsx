import Link from "next/link";
import { CalendarIcon, ClockIcon } from "@/components/icons";
import { examStatus, type Exam } from "@/data/exams";

const statusStyles: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700",
  upcoming: "bg-amber-50 text-amber-700",
  results: "bg-neutral-100 text-neutral-600",
};

const statusLabels: Record<string, string> = {
  open: "Application open",
  upcoming: "Upcoming",
  results: "Results out",
};

export default function ExamCard({ exam }: { exam: Exam }) {
  const status = examStatus(exam);
  return (
    <Link
      href={`/exams/${exam.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
        <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-violet-700">
          {exam.examType}
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
        {exam.name}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">{exam.conductingAuthority}</p>

      <dl className="mt-4 space-y-2.5 border-t border-black/5 pt-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
            <CalendarIcon className="h-3.5 w-3.5" />
            Exam date
          </dt>
          <dd className="font-semibold text-neutral-800">{exam.examDate}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
            <ClockIcon className="h-3.5 w-3.5" />
            Application deadline
          </dt>
          <dd className="font-semibold text-neutral-800">
            {exam.applicationDeadline}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-neutral-500">Mode</dt>
          <dd className="font-medium text-neutral-800">{exam.mode}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-neutral-500">Result</dt>
          <dd className="font-medium text-neutral-800">{exam.resultDate}</dd>
        </div>
      </dl>

      <span className="mt-4 inline-flex w-fit items-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-neutral-800">
        View details
      </span>
    </Link>
  );
}