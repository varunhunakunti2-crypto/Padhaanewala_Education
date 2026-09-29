"use client";

import Link from "next/link";
import {
  Building2,
  Scale,
  Award,
  CalendarDays,
  FileQuestion,
  MessagesSquare,
  Headset,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const ACTIONS = [
  {
    title: "Find Colleges",
    desc: "Search the college catalogue by course, city and budget.",
    href: "/colleges",
    icon: Building2,
    grad: "from-purple-600 to-indigo-600",
    shadow: "shadow-purple-600/25",
  },
  {
    title: "Compare Colleges",
    desc: "Side-by-side comparison of fees, placements & facilities.",
    href: "/compare",
    icon: Scale,
    grad: "from-blue-600 to-cyan-600",
    shadow: "shadow-blue-600/25",
  },
  {
    title: "Mock Tests",
    desc: "Practice exams with a real timer and instant score analysis.",
    href: "/mock-tests",
    icon: FileQuestion,
    grad: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    title: "AI Assistant",
    desc: "Ask anything about courses, exams and admissions.",
    href: "/ask-ai",
    icon: MessagesSquare,
    grad: "from-blue-600 to-cyan-500",
    shadow: "shadow-blue-600/25",
  },
  {
    title: "Scholarships",
    desc: "Discover scholarships and track deadlines.",
    href: "/scholarships",
    icon: Award,
    grad: "from-amber-500 to-yellow-500",
    shadow: "shadow-amber-500/25",
  },
  {
    title: "Admission Assistance",
    desc: "Free counselling to plan your admission.",
    href: "/admission",
    icon: Headset,
    grad: "from-rose-500 to-pink-500",
    shadow: "shadow-rose-500/25",
  },
  {
    title: "Entrance Exams",
    desc: "Dates, patterns and official links for every major exam.",
    href: "/exams",
    icon: CalendarDays,
    grad: "from-cyan-600 to-sky-600",
    shadow: "shadow-cyan-600/25",
  },
];

export function QuickActions() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Everything you need"
          title="Your complete education companion"
          description="Explore, compare, predict and plan — all from one place."
        />
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((a) => (
          <Reveal key={a.title} delay={0.05}>
            <Link
              href={a.href}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5"
            >
              <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${a.grad} ${a.shadow}`}>
                <a.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-gray-900">{a.title}</h3>
              <p className="mt-1 flex-1 text-sm text-gray-500">{a.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700">
                Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}