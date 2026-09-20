"use client";

import Link from "next/link";
import {
  Settings,
  Stethoscope,
  BarChart3,
  Palette,
  Scale,
  FlaskConical,
  BookOpen,
  Calculator,
  ArrowRight,
} from "lucide-react";

const CATEGORIES = [
  {
    name: "Engineering",
    count: "2,000+ Colleges",
    icon: Settings,
    href: "/colleges?stream=engineering",
    bgColor: "bg-[#eef5ff]",
    borderColor: "border-[#d8e6fa]",
    iconColor: "text-blue-500",
  },
  {
    name: "Medical",
    count: "800+ Colleges",
    icon: Stethoscope,
    href: "/colleges?stream=medical",
    bgColor: "bg-[#fff0f3]",
    borderColor: "border-[#ffdbe3]",
    iconColor: "text-rose-500",
  },
  {
    name: "Management",
    count: "1,200+ Colleges",
    icon: BarChart3,
    href: "/colleges?stream=management",
    bgColor: "bg-[#f5effe]",
    borderColor: "border-[#ebdcfc]",
    iconColor: "text-purple-600",
  },
  {
    name: "Design",
    count: "400+ Colleges",
    icon: Palette,
    href: "/colleges?stream=design",
    bgColor: "bg-[#fff4eb]",
    borderColor: "border-[#ffe3cc]",
    iconColor: "text-orange-500",
  },
  {
    name: "Law",
    count: "600+ Colleges",
    icon: Scale,
    href: "/colleges?stream=law",
    bgColor: "bg-[#eefbf4]",
    borderColor: "border-[#d1f5e2]",
    iconColor: "text-emerald-500",
  },
  {
    name: "Science",
    count: "700+ Colleges",
    icon: FlaskConical,
    href: "/colleges?stream=science",
    bgColor: "bg-[#f0f9ff]",
    borderColor: "border-[#d5effd]",
    iconColor: "text-sky-500",
  },
  {
    name: "Arts",
    count: "850+ Colleges",
    icon: BookOpen,
    href: "/colleges?stream=arts",
    bgColor: "bg-[#fdf2f8]",
    borderColor: "border-[#fce1ee]",
    iconColor: "text-pink-500",
  },
  {
    name: "Commerce",
    count: "600+ Colleges",
    icon: Calculator,
    href: "/colleges?stream=commerce",
    bgColor: "bg-[#fffbeb]",
    borderColor: "border-[#fef0c7]",
    iconColor: "text-amber-500",
  },
];

export function ExploreCategory() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
          Explore by Category
        </h2>
        <Link
          href="/courses"
          className="group flex items-center gap-1 text-sm font-semibold text-purple-700 transition hover:text-purple-900"
        >
          View All{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Grid of 8 Pastel Category Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group flex flex-col items-center justify-center rounded-2xl border ${cat.borderColor} ${cat.bgColor} p-4 text-center transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md`}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-xs transition-transform duration-300 group-hover:scale-110">
                <Icon className={`h-6 w-6 ${cat.iconColor}`} strokeWidth={1.8} />
              </div>
              <h3 className="mt-3.5 text-[15px] font-bold text-gray-900 group-hover:text-purple-700">
                {cat.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500">{cat.count}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
