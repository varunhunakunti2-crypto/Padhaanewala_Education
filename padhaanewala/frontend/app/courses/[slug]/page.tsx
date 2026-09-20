import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CalendarDays,
  FileText,
  IndianRupee,
  Briefcase,
  Building2,
  Users,
  ListChecks,
} from "lucide-react";
import {
  getCourseBySlug,
  getCourseDetail,
  getRelatedCourses,
  collegesOffering,
  COURSES,
} from "@/lib/data/courses";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CollegeCard } from "@/components/college/CollegeCard";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  return {
    title: `${course.name} — Course Details`,
    description: course.description,
  };
}

function FaqList({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="space-y-2">
      {faqs.map((f) => (
        <details key={f.q} className="group rounded-2xl border border-slate-100 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
          </summary>
          <p className="px-5 pb-4 text-sm leading-relaxed text-slate-500">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const course = getCourseBySlug(slug);
  if (!course) notFound();
  const detail = getCourseDetail(slug);
  const colleges = collegesOffering(slug).slice(0, 6);
  const related = getRelatedCourses(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-purple-700">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/courses" className="hover:text-purple-700">Courses</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-medium text-purple-700">{course.name}</span>
      </nav>

      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 p-6 text-white sm:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="yellow">{course.level}</Badge>
              {course.hot && <Badge variant="orange">Trending</Badge>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{course.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{course.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-2.5 text-center backdrop-blur">
                <p className="flex items-center justify-center gap-1 text-xs text-white/60"><Clock className="h-3.5 w-3.5" /> Duration</p>
                <p className="text-sm font-bold">{course.duration}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2.5 text-center backdrop-blur">
                <p className="flex items-center justify-center gap-1 text-xs text-white/60"><IndianRupee className="h-3.5 w-3.5" /> Avg. fees</p>
                <p className="text-sm font-bold">{formatINR(course.avgFeeYear)}/yr</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2.5 text-center backdrop-blur">
                <p className="flex items-center justify-center gap-1 text-xs text-white/60"><Building2 className="h-3.5 w-3.5" /> Colleges</p>
                <p className="text-sm font-bold">{colleges.length}+ on platform</p>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <ButtonLink href="/colleges" variant="warm-gradient" size="md" className="rounded-full">
              Find colleges for {course.degree}
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* Overview + stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <ListChecks className="h-4 w-4 text-purple-600" /> Overview
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {course.description} This {course.duration} program at the {course.level} level costs an average of
            {formatINR(course.avgFeeYear)} per year. {colleges.length} colleges on Padhaanewala offer this course —
            filter by state, ownership and fees to shortlist your options.
          </p>
        </div>
        <div className="space-y-3">
          {detail && (
            <>
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-xs text-slate-400">Entrance exams</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.entranceExams.slice(0, 6).map((e) => (
                    <Badge key={e} variant="purple">{e}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-xs text-slate-400">Top recruiters</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.topRecruiters.slice(0, 5).map((r) => (
                    <Badge key={r} variant="blue">{r}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Eligibility + Admission */}
      {detail && (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <Users className="h-4 w-4 text-purple-600" /> Eligibility
            </h2>
            <ul className="mt-3 space-y-2">
              {detail.eligibility.map((e) => (
                <li key={e} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <FileText className="h-4 w-4 text-purple-600" /> Admission procedure
            </h2>
            <ol className="mt-3 space-y-2">
              {detail.admissionProcedure.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-purple-600 text-[11px] font-bold text-white">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Careers */}
      {detail && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Briefcase className="h-4 w-4 text-purple-600" /> Career opportunities
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detail.careerOpportunities.map((c) => (
              <div key={c} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> {c}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.careerSectors.map((s) => (
              <Badge key={s} variant="gray">{s}</Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">{detail.entranceExamNote}</p>
        </div>
      )}

      {/* Colleges offering */}
      <div className="mt-10">
        <SectionHeading
          eyebrow="Colleges"
          title={`Colleges offering ${course.degree}`}
          align="left"
          action={
            <ButtonLink href={`/colleges?course=${encodeURIComponent(course.degree)}`} variant="outline" size="sm">
              View all (course filter) <ArrowLeft className="h-4 w-4 rotate-180" />
            </ButtonLink>
          }
        />
        {colleges.length ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {colleges.map((c) => (
              <CollegeCard key={c.id} college={c} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No colleges in the current catalogue offer this exact degree — check back soon.
          </p>
        )}
      </div>

      {/* FAQs */}
      {detail && detail.faqs.length > 0 && (
        <div className="mt-10">
          <SectionHeading eyebrow="Questions" title="Course FAQs" align="left" />
          <div className="mt-4">
            <FaqList faqs={detail.faqs} />
          </div>
        </div>
      )}

      {/* Related */}
      <div className="mt-10">
        <SectionHeading eyebrow="You may also like" title="Related courses" align="left" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((c) => (
            <Link
              key={c.slug}
              href={`/courses/${c.slug}`}
              className="group rounded-2xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-900/5"
            >
              <Badge variant="blue">{c.level}</Badge>
              <h3 className="mt-2 font-bold text-gray-900 group-hover:text-purple-700">{c.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{c.duration} · {formatINR(c.avgFeeYear)}/yr</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <ButtonLink href="/courses" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" /> Back to all courses
        </ButtonLink>
        <ButtonLink href="/college-predictor" variant="accent" size="md">
          Predict my college <CalendarDays className="h-4 w-4" />
        </ButtonLink>
      </div>

      <div className="mt-6">
        <AdmissionHelpBanner />
      </div>
    </div>
  );
}