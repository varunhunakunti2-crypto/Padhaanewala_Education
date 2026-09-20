import { Search, SlidersHorizontal, Heart, Sparkles, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";

const STEPS = [
  {
    icon: Search,
    title: "Search & filter",
    desc: "Find the right colleges by course, city, fees, exams and more.",
    color: "bg-blue-600",
    ring: "ring-blue-100",
  },
  {
    icon: SlidersHorizontal,
    title: "Compare side-by-side",
    desc: "Stack up to 4 colleges on fees, placements, hostels and ratings.",
    color: "bg-brand-gradient",
    ring: "ring-purple-100",
  },
  {
    icon: Heart,
    title: "Save your shortlist",
    desc: "Bookmark colleges and track deadlines in your personal dashboard.",
    color: "bg-orange-500",
    ring: "ring-orange-100",
  },
  {
    icon: Sparkles,
    title: "Get recommendations",
    desc: "We learn from your searches and suggest colleges made for you.",
    color: "bg-warm-gradient",
    ring: "ring-amber-100",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative isolate scroll-mt-24 overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading
          eyebrowTone="warm"
          eyebrow="How CampusPulse works"
          title="Your college search, simplified"
          description="A clear path from discovery to decision — built to bring students back."
          align="center"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="group relative h-full rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md ${s.color}`}>
                  <s.icon className="h-6 w-6" strokeWidth={1.9} />
                </div>
                <p className="mt-4 font-accent text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                <span
                  className={`absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-white ring-1 ${s.ring} text-gray-300 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:text-purple-500`}
                >
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/colleges" variant="accent" size="lg">
            Start exploring <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}