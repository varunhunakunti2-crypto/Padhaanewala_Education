import Link from "next/link";
import { Search, ArrowRight, TrendingUp } from "lucide-react";
import { POPULAR_SEARCHES } from "@/lib/data";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const SEARCH_CARDS = [
  { label: "B.Tech Computer Science", q: "Computer Science", icon: TrendingUp, tone: "bg-purple-50 text-purple-600" },
  { label: "MBA in India", q: "MBA", icon: TrendingUp, tone: "bg-blue-50 text-blue-600" },
  { label: "Medical colleges", q: "Medical", icon: TrendingUp, tone: "bg-green-50 text-green-600" },
  { label: "Government colleges", q: "Government", icon: TrendingUp, tone: "bg-amber-50 text-amber-600" },
  { label: "Engineering in Pune", q: "Pune", icon: TrendingUp, tone: "bg-rose-50 text-rose-600" },
  { label: "Nursing colleges", q: "Nursing", icon: TrendingUp, tone: "bg-cyan-50 text-cyan-600" },
];

export function PopularCollegeSearches() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Trending now"
          title="Popular college searches"
          description="What students across India are searching for right now."
        />
      </Reveal>
      <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEARCH_CARDS.map((s) => (
            <Link
              key={s.label}
              href={`/colleges?q=${encodeURIComponent(s.q)}`}
              className="group flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3.5 transition hover:border-purple-200 hover:bg-purple-50/40"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-gray-900 group-hover:text-purple-700">{s.label}</span>
                <span className="block text-xs text-gray-400">Search colleges</span>
              </span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-purple-500" />
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Search className="h-3.5 w-3.5" /> Also popular:
          </span>
          {POPULAR_SEARCHES.map((p) => (
            <Link
              key={p}
              href={`/colleges?q=${encodeURIComponent(p)}`}
              className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-purple-50 hover:text-purple-700"
            >
              {p}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}