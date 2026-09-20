import Link from "next/link";
import {
  Laptop,
  Cpu,
  Stethoscope,
  Briefcase,
  Palette,
  Scale,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

const COURSES = [
  {
    title: "Computer Science",
    desc: "AI · Data Science · CSE",
    href: "/colleges?q=computer science",
    icon: Laptop,
    stat: "240+ colleges",
    tile: "bg-gradient-to-br from-blue-600 to-indigo-600",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
  {
    title: "Engineering",
    desc: "B.Tech · M.Tech",
    href: "/colleges?q=B.Tech",
    icon: Cpu,
    stat: "320+ colleges",
    tile: "bg-gradient-to-br from-purple-600 to-blue-600",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
  {
    title: "Medicine",
    desc: "MBBS · BDS · Nursing",
    href: "/colleges?q=medicine",
    icon: Stethoscope,
    stat: "180+ colleges",
    tile: "bg-gradient-to-br from-orange-500 to-amber-500",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
  {
    title: "Business",
    desc: "MBA · BBA · PGDM",
    href: "/colleges?q=MBA",
    icon: Briefcase,
    stat: "210+ colleges",
    tile: "bg-gradient-to-br from-amber-500 to-yellow-500",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
  {
    title: "Design",
    desc: "B.Des · B.Arch · UX",
    href: "/colleges?q=design",
    icon: Palette,
    stat: "90+ colleges",
    tile: "bg-gradient-to-br from-violet-600 to-purple-600",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
  {
    title: "Law",
    desc: "LLB · BA-LLB · LLM",
    href: "/colleges?q=law",
    icon: Scale,
    stat: "120+ colleges",
    tile: "bg-gradient-to-br from-blue-700 to-purple-700",
    iconBg: "bg-white/15",
    chip: "bg-white/20",
  },
];

export function PopularCourses() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-blue-700 ring-1 ring-inset ring-blue-200">
                <GraduationCap className="h-3.5 w-3.5" /> Start exploring
              </p>
              <h2 className="section-title font-display font-extrabold text-purple-950">
                Popular courses
              </h2>
              <p className="mt-3 max-w-lg text-base leading-relaxed text-gray-500">
                From AI to law — jump straight into the stream you care about.
              </p>
            </div>
            <Link
              href="/courses"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-purple-700"
            >
              Browse all courses{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {COURSES.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.05}>
              <Link
                href={c.href}
                className={`group relative flex h-full flex-col overflow-hidden rounded-2xl p-4 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-5 ${c.tile}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.28),transparent_52%)]" />
                <span className={`relative grid h-11 w-11 place-items-center rounded-xl backdrop-blur ${c.iconBg}`}>
                  <c.icon className="h-5.5 w-5.5 drop-shadow" strokeWidth={1.9} />
                </span>
                <h3 className="relative mt-4 font-display text-[15px] font-bold leading-snug sm:text-base">
                  {c.title}
                </h3>
                <p className="relative mt-0.5 text-[11px] opacity-85 sm:text-xs">{c.desc}</p>
                <div className="relative mt-4 flex flex-1 items-end justify-between gap-1">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${c.chip}`}>
                    {c.stat}
                  </span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 opacity-0 transition-all duration-300 group-hover:opacity-100">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}