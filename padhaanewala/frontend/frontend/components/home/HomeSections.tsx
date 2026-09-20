import Link from "next/link";
import { CalendarDays, ArrowRight, ExternalLink, Building2, FileText } from "lucide-react";
import { EXAMS } from "@/lib/data/exams";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function UpcomingExams() {
  const upcoming = [...EXAMS]
    .filter((e) => e.stage === "Registration Open")
    .slice(0, 4);
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Exam calendar"
          title="Upcoming examinations"
          description="Registration windows, exam dates and results — all in one place."
          action={
            <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
              All exams <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {upcoming.map((exam) => {
          const nextDate = exam.dates.filter((d) => new Date(d.date) >= new Date())[0];
          return (
            <Reveal key={exam.id}>
              <Link
                href={`/exams/${exam.slug}`}
                className="group flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                  <CalendarDays className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-gray-900 group-hover:text-purple-700">
                      {exam.shortName}
                    </h3>
                    <Badge variant="green">{exam.stage}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{exam.conductingBody}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                    <FileText className="h-3.5 w-3.5 text-purple-500" />
                    {exam.type} · {exam.duration}
                  </p>
                  {nextDate && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      <b className="text-purple-700">{nextDate.label}:</b> {formatDate(nextDate.date)}
                    </p>
                  )}
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-500" />
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function HomeScholarships() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Free money for studies"
          title="Scholarships you can apply for"
          description="Merit and need-based scholarships with upcoming deadlines."
          action={
            <Link href="/scholarships" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
              All scholarships <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SCHOLARSHIPS.slice(0, 3).map((s) => (
          <Reveal key={s.id}>
            <Link
              href="/scholarships"
              className="group flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5"
            >
              <div className="flex items-center justify-between">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-lg text-white ${s.color}`}>🎓</span>
                <Badge variant="amber">Apply by {formatDate(s.deadline)}</Badge>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-gray-900">{s.name}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{s.provider}</p>
              <p className="mt-3 flex-1 text-sm text-slate-600">{s.eligibility}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-extrabold text-green-600">{s.amount}</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-700">
                  Details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function HomeMockTests() {
  const subjects = [
    { name: "JEE Main Mock Tests", desc: "Physics · Chemistry · Maths", exam: "jee-main", count: "45 Qs, 90 min" },
    { name: "NEET Mock Tests", desc: "Biology · Physics · Chemistry", exam: "neet-ug", count: "15+ Qs, timed" },
    { name: "CAT Practice", desc: "Quant · Reasoning · VARC", exam: "cat", count: "Section-wise drills" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Practice & improve"
          title="Free mock tests"
          description="Real exam timer, instant solutions and detailed analysis."
          action={
            <Link href="/mock-tests" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
              Start practicing <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {subjects.map((s) => (
          <Reveal key={s.name}>
            <Link
              href="/mock-tests"
              className="group flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                  <Building2 className="h-5 w-5" />
                </span>
                <Badge variant="purple">Free</Badge>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-gray-900">{s.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              <p className="mt-3 text-xs font-semibold text-purple-700">{s.count}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-purple-700">
                Take a mock <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function HomeArticles() {
  const articles = [
    { title: "JEE Main vs JEE Advanced: What's the Real Difference?", cat: "Exams", slug: "jee-main-vs-jee-advanced-difference", time: "6 min" },
    { title: "NEET UG 2027: Complete Eligibility Criteria Explained", cat: "NEET", slug: "neet-ug-2027-eligibility-criteria", time: "5 min" },
    { title: "Which B.Tech Branch Has the Best Future in 2027?", cat: "Careers", slug: "which-btech-branch-has-best-future", time: "9 min" },
    { title: "Top 10 Scholarships Engineering Students Must Not Miss", cat: "Scholarships", slug: "top-scholarships-for-engineering-students", time: "8 min" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Learn with us"
          title="Latest education articles"
          description="Expert guides on admissions, exams, scholarships and careers."
          action={
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
              View all articles <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {articles.map((a) => (
          <Reveal key={a.slug}>
            <Link
              href={`/blog/${a.slug}`}
              className="group flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5"
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-700 to-indigo-700 font-display text-[11px] font-extrabold uppercase tracking-wide text-white">
                {a.cat}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="purple">{a.cat}</Badge>
                  <span className="text-[11px] text-slate-400">{a.time} read</span>
                </div>
                <h3 className="mt-2 font-display text-base font-bold leading-snug text-gray-900 group-hover:text-purple-700">
                  {a.title}
                </h3>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-purple-600 to-blue-700 px-6 py-14 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-10 -top-16 h-64 w-64 rounded-full bg-orange-400/25 blur-3xl" />
            <div className="absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Confused about college admission? We can help.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            Get a free counselling session, personalised college shortlist and a step-by-step
            admission plan from our expert counsellors.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admission"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-7 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" /> Get Admission Help
            </Link>
            <Link
              href="/college-predictor"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Try College Predictor
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}