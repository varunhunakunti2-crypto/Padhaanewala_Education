import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  MapPin,
  Phone,
  Heart,
  Users,
  ShieldCheck,
  Globe,
  BadgeCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about CampusPulse — our mission to help every Indian student find the right college, with transparency and data-driven discovery.",
};

const VALUES = [
  {
    icon: Heart,
    title: "Student-first",
    desc: "Every feature we build starts from a question students actually ask. We obsess over clarity, honesty and speed.",
    color: "bg-red-50 text-red-500",
  },
  {
    icon: ShieldCheck,
    title: "Data integrity",
    desc: "Our fee, cutoff and placement data is collected from verified sources and updated annually. We do not sell rankings.",
    color: "bg-purple-50 text-purple-500",
  },
  {
    icon: Users,
    title: "Transparency",
    desc: "We do not charge colleges for placement on our platform. A student's journey should not be decided by who paid more.",
    color: "bg-blue-50 text-blue-500",
  },
  {
    icon: Globe,
    title: "Accessible to all",
    desc: "CampusPulse is free to use for all students, regardless of background, language or economic status.",
    color: "bg-emerald-50 text-emerald-500",
  },
];

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      {/* hero */}
      <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-purple-100/80 via-white to-blue-50/70 dark:from-purple-950/60 dark:via-slate-900 dark:to-blue-950/60 dark:border dark:border-purple-800/40 px-6 py-14 text-center sm:px-12 lg:py-20 shadow-sm">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-12 -top-16 h-60 w-60 rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-3xl animate-float-slow" />
          <div className="absolute -right-10 top-10 h-64 w-64 rounded-full bg-orange-300/15 dark:bg-orange-500/10 blur-3xl animate-float-slower" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-900/50 px-4 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
          <BadgeCheck className="h-3.5 w-3.5" /> Since 2024
        </span>
        <h1 className="font-display mx-auto mt-5 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-purple-950 dark:text-white sm:text-4xl lg:text-[2.6rem]">
          Helping Indian students make smarter college decisions
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
          We started CampusPulse because finding the right college in India is
          harder than it needs to be. Outdated directories, confusing fees and
          unreliable rankings make a simple decision feel impossible.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 sm:text-base">
          We believe that by bringing real data together in one fast, usable
          place, we can save thousands of students from stress, bad decisions
          and wasted money.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/colleges"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition hover:bg-purple-700"
          >
            Explore colleges
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-6 text-sm font-semibold text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-slate-700 transition hover:bg-blue-50 dark:hover:bg-slate-700"
          >
            Contact us
          </Link>
        </div>
      </div>

      {/* values */}
      <div className="mt-16">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Our principles</p>
        <h2 className="font-display text-center text-2xl font-extrabold tracking-tight text-purple-950 sm:text-3xl">
          What we stand for
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${v.color}`}>
                <v.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-gray-900">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* contact */}
      <div className="mt-16 rounded-2xl bg-gradient-to-br from-purple-700 to-blue-700 p-8 text-white shadow-2xl card-shadow sm:p-12 lg:flex lg:items-center lg:gap-10 lg:p-14">
        <div className="flex-1">
          <h2 className="font-display text-2xl font-extrabold">Get in touch</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-purple-100">
            Questions, partnerships or just want to say hi? We are always listening.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-purple-100">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                <Mail className="h-4 w-4" />
              </span>
              hello@campuspulse.in
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                <Phone className="h-4 w-4" />
              </span>
              +91 90000 00000
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                <MapPin className="h-4 w-4" />
              </span>
              Bengaluru, Karnataka, India
            </li>
          </ul>
        </div>
        <div className="mt-8 lg:mt-0 lg:w-80">
          <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
            <h3 className="text-sm font-bold text-white">Quick facts</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-purple-200">Founded</dt><dd className="font-bold text-white">2024</dd></div>
              <div className="flex justify-between"><dt className="text-purple-200">Colleges listed</dt><dd className="font-bold text-white">1,400+</dd></div>
              <div className="flex justify-between"><dt className="text-purple-200">Students/month</dt><dd className="font-bold text-white">2.4 lakh+</dd></div>
              <div className="flex justify-between"><dt className="text-purple-200">Headquarters</dt><dd className="font-bold text-white">Bengaluru, India</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-gray-400">
        Built with care by the CampusPulse team for students who dream big.
      </p>
    </section>
  );
}