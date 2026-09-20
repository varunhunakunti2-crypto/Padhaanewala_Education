import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  CalendarDays,
  FileQuestion,
  Sparkles,
  MessagesSquare,
  GraduationCap,
  Headset,
  Newspaper,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdmissionHelpButton } from "@/components/admission/AdmissionForm";
import { BLOG_POSTS } from "@/lib/data/blog";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "College admission guides, entrance exam tips, counselling strategies, mock tests and career advice — all curated for Indian students.",
};

const HUBS = [
  { title: "Entrance Exams", desc: "Registration dates, patterns and official links for all major exams.", href: "/exams", icon: CalendarDays, tone: "from-purple-600 to-blue-600" },
  { title: "Mock Tests", desc: "Practice with a real exam timer and instant analytics.", href: "/mock-tests", icon: FileQuestion, tone: "from-emerald-500 to-teal-500" },
  { title: "AI College Predictor", desc: "Get a personalised college shortlist from your rank.", href: "/college-predictor", icon: Sparkles, tone: "from-orange-500 to-amber-500" },
  { title: "Ask AI Assistant", desc: "Instant answers to any education question.", href: "/ask-ai", icon: MessagesSquare, tone: "from-blue-600 to-cyan-500" },
  { title: "Scholarships", desc: "Find funding and track application deadlines.", href: "/scholarships", icon: GraduationCap, tone: "from-amber-500 to-yellow-500" },
  { title: "Blog & Articles", desc: "Guides on admissions, careers, exams and education news.", href: "/blog", icon: Newspaper, tone: "from-rose-500 to-pink-500" },
];

export default function ResourcesPage() {
  const guides = BLOG_POSTS.slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="max-w-2xl">
        <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
          <BookOpen className="h-4 w-4" /> Student resource hub
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Resources
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
          Every tool and guide you need — exams, mock tests, the predictor, AI assistance,
          scholarships and expert articles.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((h) => (
          <Link
            key={h.href}
            href={h.href}
            className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white ${h.tone}`}>
              <h.icon className="h-5 w-5" />
            </span>
            <h3 className="font-display mt-3 text-base font-bold text-gray-900">{h.title}</h3>
            <p className="mt-1 flex-1 text-sm text-gray-500">{h.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition group-hover:text-purple-700">
              Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-14">
        <SectionHeading
          eyebrow="Guides & articles"
          title="Latest from the blog"
          align="left"
          action={
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
              View all articles <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/blog/${g.slug}`}
              className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <Badge variant="blue" className="w-fit">{g.category}</Badge>
              <h3 className="font-display mt-3 text-base font-bold leading-snug text-gray-900">{g.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-2">{g.excerpt}</p>
              <div className="mt-3 text-xs text-gray-400">{g.readTime} · {g.author}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-14 rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 p-8 text-center text-white shadow-xl">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Want personalised advice?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-purple-100">
          Our counsellors provide free guidance for college selection, cutoffs and admission strategy.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <AdmissionHelpButton label="Talk to a counsellor" />
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
          >
            <Headset className="h-4 w-4" /> Open dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}