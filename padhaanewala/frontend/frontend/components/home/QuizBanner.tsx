"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react";

export function QuizBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="relative isolate overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-br from-[#f2effe] via-[#ede7fd] to-[#f6f2ff] p-8 sm:p-10 lg:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          {/* Left Column: Copy & Action */}
          <div className="lg:col-span-5">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Not sure where to start?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
              Get personalized college and course recommendations based on your interests,
              goals and exam scores.
            </p>
            <div className="mt-6">
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-purple-600/25 transition hover:bg-purple-700 active:scale-95"
              >
                Take a Quick Quiz <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Middle Column: Student with Laptop & Doodles */}
          <div className="relative flex items-center justify-center lg:col-span-4">
            {/* Doodle: Right College */}
            <div className="pointer-events-none absolute -top-4 left-6 z-10 select-none text-purple-600">
              <p className="font-hand text-xl font-bold tracking-wide">
                Right
                <br />
                College
              </p>
              <svg viewBox="0 0 40 30" className="w-8 -rotate-12" fill="none">
                <path
                  d="M10 2 C 20 10, 30 18, 32 28"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M25 26 L 32 28 L 33 21"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Doodle: Right Course Brighter Future */}
            <div className="pointer-events-none absolute -bottom-2 left-2 z-10 select-none text-purple-600">
              <p className="font-hand text-lg font-bold leading-tight">
                Right Course
                <br />
                Brighter Future
              </p>
              <svg viewBox="0 0 50 20" className="w-10 mt-1" fill="none">
                <path
                  d="M2 14 C 18 2, 35 2, 46 8"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M40 4 L 46 8 L 41 12"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Student Image */}
            <div className="relative h-56 w-56 sm:h-64 sm:w-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=500&h=500&q=80"
                alt="Student taking quiz"
                className="h-full w-full rounded-2xl object-cover shadow-lg ring-4 ring-white/80"
              />
            </div>
          </div>

          {/* Right Column: 3 Feature Pills */}
          <div className="flex flex-col gap-3 lg:col-span-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xs ring-1 ring-purple-100/60 backdrop-blur-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-gray-800 sm:text-sm">
                Personalized Suggestions
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xs ring-1 ring-purple-100/60 backdrop-blur-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-gray-800 sm:text-sm">
                Based on Your Interests
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xs ring-1 ring-purple-100/60 backdrop-blur-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-gray-800 sm:text-sm">
                100% Free
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
