"use client";

import { Layers, ShieldCheck, Scale, UserCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Comprehensive Data",
    desc: "Access 12,000+ colleges and 500+ courses.",
    color: "text-purple-600",
    bg: "bg-purple-50",
    ring: "ring-purple-100",
  },
  {
    icon: ShieldCheck,
    title: "Unbiased & Reliable",
    desc: "Verified information and real student reviews.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-100",
  },
  {
    icon: Scale,
    title: "Smart Comparisons",
    desc: "Compare colleges, courses, fees and placements.",
    color: "text-orange-500",
    bg: "bg-orange-50",
    ring: "ring-orange-100",
  },
  {
    icon: UserCheck,
    title: "Personalized Guidance",
    desc: "Recommendations tailored to your goals.",
    color: "text-pink-500",
    bg: "bg-pink-50",
    ring: "ring-pink-100",
  },
];

export function WhyChooseSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
          Why Choose padhaanewala?
        </h2>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          We&apos;re building a simpler, smarter way to find your dream college.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div
                className={`grid h-16 w-16 place-items-center rounded-full ${f.bg} ${f.color} ring-8 ${f.ring} shadow-xs transition-transform duration-300 hover:scale-110`}
              >
                <Icon className="h-7 w-7" strokeWidth={1.9} />
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 sm:text-sm max-w-[220px]">
                {f.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
