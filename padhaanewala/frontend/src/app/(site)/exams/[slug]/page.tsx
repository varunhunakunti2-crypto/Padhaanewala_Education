import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CalendarIcon, ClockIcon } from "@/components/icons";
import { examStatus, exams, type Exam } from "@/data/exams";
import { mockTests } from "@/data/mockTests";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return exams.map((exam) => ({ slug: exam.slug }));
}

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

function DateRow({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon && <CalendarIcon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="text-sm font-semibold text-neutral-800">{value}</dd>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const exam = exams.find((e) => e.slug === slug);
  if (!exam) return { title: "Exam Not Found" };
  return {
    title: `${exam.name} — Application Dates, Pattern & Result`,
    description: `${exam.name} by ${exam.conductingAuthority}: apply by ${exam.applicationDeadline}, exam on ${exam.examDate}, results ${exam.resultDate}.`,
  };
}

export default async function ExamDetailPage({ params }: Props) {
  const { slug } = await params;
  const exam = exams.find((e) => e.slug === slug);
  if (!exam) notFound();

  const status = examStatus(exam);
  const relatedExams = exams
    .filter((e) => e.slug !== exam.slug && (e.examType === exam.examType || e.conductingAuthority === exam.conductingAuthority))
    .slice(0, 3);
  const relatedMockTests = mockTests.filter((t) =>
    exam.name.toUpperCase().includes(t.examName.toUpperCase())
  );

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/exams" className="hover:text-neutral-900">
              Exams
            </Link>{" "}
            / <span className="text-neutral-900">{exam.name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
            >
              {statusLabels[status]}
            </span>
            <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold capitalize text-violet-700">
              {exam.examType}
            </span>
            <span className="inline-flex rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              {exam.mode}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {exam.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">
            Conducted by {exam.conductingAuthority}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={exam.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Official website
              <ArrowRightIcon className="h-4 w-4" />
            </a>
            {relatedMockTests.length > 0 && (
              <Link
                href={`/mock-tests/${relatedMockTests[0].slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-950 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
              >
                Take a {exam.name.replace(/\s\d{4}$/, "")} mock test
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">Key dates</h2>
            <div className="mt-4 rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <dl className="space-y-4">
                <DateRow label="Application starts" value={exam.applicationStart} icon />
                <div className="border-t border-black/5" />
                <DateRow label="Application deadline" value={exam.applicationDeadline} icon />
                <div className="border-t border-black/5" />
                <DateRow label="Exam date" value={exam.examDate} icon />
                <div className="border-t border-black/5" />
                <DateRow label="Result date" value={exam.resultDate} icon />
              </dl>
            </div>

            <h2 className="mt-10 text-xl font-bold tracking-tight text-neutral-950">
              Exam overview
            </h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              {exam.name} is a{exam.examType === "national" ? " national-level" : " state-level"}{" "}
              entrance examination conducted in {exam.mode} mode by {exam.conductingAuthority}. The
              exam opens for applications from {exam.applicationStart} and the last date to apply
              is {exam.applicationDeadline}. Refer to the official website for the complete
              syllabus, exam pattern, eligibility criteria and category-wise cutoffs.
            </p>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              Results are expected on {exam.resultDate}. Use Padhaanewala&apos;s college predictor
              and counselling cutoffs to convert your score into a shortlist of colleges.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/college-predictor"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Predict my colleges
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href={`/exams/${exam.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
              >
                <ClockIcon className="h-4 w-4" />
                Set reminder
              </Link>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <h3 className="text-sm font-bold text-neutral-950">At a glance</h3>
              <dl className="mt-4 space-y-3">
                <DateRow label="Exam type" value={exam.examType} />
                <div className="border-t border-black/5" />
                <DateRow label="Mode" value={exam.mode} />
                <div className="border-t border-black/5" />
                <DateRow label="Authority" value={exam.conductingAuthority} />
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {relatedExams.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">Related exams</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedExams.map((e: Exam) => (
              <Link
                key={e.id}
                href={`/exams/${e.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${statusStyles[examStatus(e)]}`}
                >
                  {statusLabels[examStatus(e)]}
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                  {e.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{e.conductingAuthority}</p>
                <p className="mt-3 text-xs text-neutral-500">
                  Exam date: <span className="font-semibold text-neutral-800">{e.examDate}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}