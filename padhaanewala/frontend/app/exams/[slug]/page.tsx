import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Users,
  IndianRupee,
  BellRing,
  ChevronRight,
  Building2,
} from "lucide-react";
import { EXAM_STAGES } from "@/lib/data/exams";
import { resolveExam, resolveSlugs } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import {
  ExamFaqs,
  ExamImportantDates,
  ExamOfficialLink,
  ExamQuickFacts,
} from "@/components/exams/ExamComponents";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await resolveSlugs("exams");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: exam } = await resolveExam(slug);
  if (!exam) return { title: "Exam not found" };
  return {
    title: `${exam.shortName} — Exam Details`,
    description: `${exam.shortName} (${exam.name}): eligibility, application dates, exam pattern, fees and FAQs. Conducted by ${exam.conductingBody}.`,
    alternates: { canonical: absoluteUrl(`/exams/${exam.slug}`) },
  };
}

export default async function ExamDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { data: exam } = await resolveExam(slug);
  if (!exam) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalProgram",
    name: exam.name,
    description: exam.overview || undefined,
    educationalLevel: exam.level === "UG" ? "Undergraduate" : "Postgraduate",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-purple-700">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/exams" className="hover:text-purple-700">Exams</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-purple-700">{exam.shortName}</span>
      </nav>

      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-6 text-white sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="yellow">{exam.stage}</Badge>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {exam.shortName}
            </h1>
            <p className="mt-1 text-sm text-white/75">{exam.name}</p>
            <p className="mt-1 text-xs text-white/60">Conducted by {exam.conductingBody}</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85">{exam.overview}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ExamOfficialLink exam={exam} />
              <ButtonLink href="/colleges" variant="warm-gradient" size="md" className="rounded-full">
                Find colleges accepting {exam.shortName}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      {/* Quick facts */}
      <div className="mt-6">
        <ExamQuickFacts exam={exam} />
      </div>

      {/* Eligibility + Fees + Pattern */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <Users className="h-4 w-4 text-purple-600" /> Eligibility
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{exam.eligibility}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <IndianRupee className="h-4 w-4 text-purple-600" /> Application fees
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{exam.fees}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <FileText className="h-4 w-4 text-purple-600" /> Exam pattern
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {exam.pattern.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <span className="rounded-lg bg-slate-50 px-2.5 py-2"><b>{exam.questionCount}</b> questions</span>
            <span className="rounded-lg bg-slate-50 px-2.5 py-2"><b>{exam.duration}</b></span>
          </div>
        </div>
      </div>

      {/* Dates + sidebar */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ExamImportantDates exam={exam} />
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <h3 className="flex items-center gap-2 font-bold text-gray-900">
                    <BellRing className="h-4 w-4 text-purple-600" /> Admission notifications
                  </h3>
                </div>
                <div className="space-y-2 p-5">
                  <p className="text-sm text-slate-600">Current stage:</p>
                  <Badge variant={exam.stage === "Registration Open" ? "green" : exam.stage === "Results Declared" ? "gray" : "yellow"}>
                    {exam.stage}
                  </Badge>
                  <p className="mt-2 text-xs text-slate-400">
                    Stage updates will appear here as announced by {exam.conductingBody}.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="text-sm font-bold text-gray-900">Courses accepted</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {exam.coursesAccepted.map((c) => (
                    <Badge key={c} variant="purple">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <Building2 className="h-4 w-4 text-purple-600" /> Colleges accepting {exam.shortName}
          </h3>
          <ul className="mt-3 space-y-2">
            {exam.collegesAccepting.slice(0, 5).map((c) => (
              <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> {c}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {EXAM_STAGES.map((s) => (
              <Badge key={s} variant="gray">{s}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="mt-8">
        <SectionHeading eyebrow="FAQs" title="Exam FAQs" align="left" />
        <div className="mt-4">
          <ExamFaqs exam={exam} />
        </div>
      </div>

      <div className="mt-4">
        <ButtonLink href="/exams" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" /> Back to all exams
        </ButtonLink>
      </div>
    </div>
  );
}