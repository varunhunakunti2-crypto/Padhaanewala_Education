"use client";

import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    num: "1",
    title: "Search",
    desc: "Enter your interests or exam and explore options.",
    color: "bg-purple-600",
  },
  {
    num: "2",
    title: "Compare",
    desc: "Compare colleges, courses, fees and placements.",
    color: "bg-blue-600",
  },
  {
    num: "3",
    title: "Shortlist",
    desc: "Save your favorites and review key details.",
    color: "bg-orange-500",
  },
  {
    num: "4",
    title: "Decide",
    desc: "Make a confident choice and apply.",
    color: "bg-purple-700",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left/Center: Title and Steps */}
        <div className="flex-1">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
              How It Works
            </h2>
            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              Find your future in just a few simple steps.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, idx) => (
              <div key={step.num} className="relative flex flex-col items-start">
                <div className="flex w-full items-center justify-between">
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white shadow-sm ${step.color}`}
                  >
                    {step.num}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="hidden flex-1 items-center px-4 lg:flex">
                      <div className="h-0.5 w-full bg-purple-100" />
                      <ArrowRight className="h-3.5 w-3.5 -ml-1 text-purple-300" />
                    </div>
                  )}
                </div>

                <h3 className="mt-3.5 text-base font-bold text-gray-900">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500 sm:text-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side handwritten doodle */}
        <div className="hidden shrink-0 lg:block lg:pl-8">
          <div className="relative text-center select-none">
            <p className="font-hand text-3xl font-bold leading-tight text-purple-700">
              Simple Steps
              <br />
              <span className="text-purple-900">Brighter</span>
              <br />
              Future
            </p>
            <svg viewBox="0 0 100 40" className="mx-auto mt-2 w-28" fill="none">
              <path
                d="M10 32 C 40 38, 70 25, 90 8"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M80 6 L 90 8 L 88 18"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
