"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  FileText,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  IndianRupee,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/FormField";
import { cn, formatDate } from "@/lib/utils";
import { searchExams, EXAM_STAGES } from "@/lib/data/exams";
import type { Exam } from "@/lib/types";

const STAGE_TONE: Record<string, "green" | "yellow" | "red" | "blue"> = {
  "Registration Open": "green",
  "Registration Closed": "yellow",
  "Admit Cards Out": "blue",
  "Results Declared": "red",
};

export function ExamCard({ exam }: { exam: Exam }) {
  const nextDate = exam.dates.filter((d) => new Date(d.date) >= new Date())[0];
  return (
    <Link
      href={`/exams/${exam.slug}`}
      className="group flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:-translate-y-0.5 hover:border-purple-200 dark:hover:border-purple-700 hover:shadow-lg hover:shadow-purple-900/5 dark:hover:shadow-purple-950/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-gray-900 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300">
            {exam.shortName}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-400">{exam.conductingBody}</p>
        </div>
        <Badge variant={STAGE_TONE[exam.stage] ?? "gray"}>{exam.stage}</Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-300">{exam.overview}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
          {nextDate ? `Next: ${nextDate.label}` : "Dates announced"}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
          {exam.duration}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
          {exam.type}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
          {exam.coursesAccepted[0]}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-700 dark:text-purple-300">
          View exam details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function ExamsExplorer({ list }: { list?: Exam[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("All");
  const exams = list ?? searchExams(query);
  const filtered = stage === "All" ? exams : exams.filter((e) => e.stage === stage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams..."
            className="pl-10"
            aria-label="Search exams"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", ...EXAM_STAGES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                stage === s
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((e) => (
          <ExamCard key={e.id} exam={e} />
        ))}
      </div>

      {!filtered.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 py-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No exams match your search.</p>
        </div>
      )}
    </div>
  );
}

export function ExamImportantDates({ exam }: { exam: Exam }) {
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-5 py-3">
        <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-slate-100">
          <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Important dates
        </h3>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {exam.dates.map((d) => {
          const past = new Date(d.date) < today;
          return (
            <div key={d.label} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                {past ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                )}
                <span className="text-sm text-slate-600 dark:text-slate-300">{d.label}</span>
                {d.tentative && <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">TENTATIVE</span>}
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatDate(d.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExamFaqs({ exam }: { exam: Exam }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {exam.faqs.map((f, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{f.q}</span>
            <Chevron className={cn("h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform", open === i && "rotate-180")} />
          </button>
          {open === i && <p className="px-5 pb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-300">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ExamQuickFacts({ exam }: { exam: Exam }) {
  const facts: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Conducting body", value: exam.conductingBody, icon: <Users className="h-4 w-4" /> },
    { label: "Exam type", value: exam.type, icon: <FileText className="h-4 w-4" /> },
    { label: "Duration", value: exam.duration, icon: <Clock className="h-4 w-4" /> },
    { label: "Questions", value: `${exam.questionCount} Qs`, icon: <FileText className="h-4 w-4" /> },
    { label: "Marking", value: exam.marking, icon: <IndianRupee className="h-4 w-4" /> },
    { label: "Negative marking", value: exam.negativeMarking, icon: <AlertCircle className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {facts.map((f) => (
        <div key={f.label} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400">
            {f.icon} {f.label}
          </span>
          <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-slate-100">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ExamOfficialLink({ exam, className }: { exam: Exam; className?: string }) {
  return (
    <a
      href={exam.website}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:hover:bg-purple-500",
        className,
      )}
    >
      Official website <ExternalLink className="h-4 w-4" />
    </a>
  );
}