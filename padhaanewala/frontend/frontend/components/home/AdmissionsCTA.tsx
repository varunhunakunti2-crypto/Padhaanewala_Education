import Link from "next/link";
import { ArrowRight, BellRing, CalendarCheck } from "lucide-react";

export function AdmissionsCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-purple-600 to-blue-700 px-6 py-12 text-center shadow-2xl shadow-purple-700/25 sm:px-12 lg:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-10 -top-16 h-64 w-64 rounded-full bg-orange-400/25 blur-3xl animate-float-slow" />
          <div className="absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl animate-float-slower" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_55%)]" />
        </div>

        <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
          <BellRing className="h-3.5 w-3.5 text-amber-300" />
          Admission season 2026 is live
        </p>

        <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
          Start your admissions prep today
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-purple-100">
          Create your dashboard, follow colleges, set deadline alerts and get
          notified the moment applications open.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-base font-bold text-white shadow-lg shadow-orange-600/30 transition hover:brightness-105 active:scale-[0.98]"
          >
            <CalendarCheck className="h-5 w-5" />
            Build My Shortlist
          </Link>
          <Link
            href="/colleges"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-6 text-base font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur transition hover:bg-white/20"
          >
            Browse Colleges <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}