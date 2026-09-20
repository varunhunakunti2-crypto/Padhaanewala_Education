import { Quote, Star } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const TESTIMONIALS = [
  {
    name: "Aisha Verma",
    role: "B.Tech CSE · VIT Vellore",
    initials: "AV",
    quote:
      "I shortlisted 6 colleges, compared them on CampusPulse and picked VIT. The fee & cutoff data matched exactly what I found during counselling.",
    grad: "from-purple-600 to-blue-600",
  },
  {
    name: "Rohan Iyer",
    role: "MBA · NMIMS Mumbai",
    initials: "RI",
    quote:
      "The dashboard reminders saved me from missing the last date of CAT acceptance and scholarship forms. Seriously, this should be a default for every aspirant.",
    grad: "from-orange-500 to-amber-500",
  },
  {
    name: "Fatima Shaikh",
    role: "B.Tech AI · SRM Chennai",
    initials: "FS",
    quote:
      "Recommendations were scarily accurate. Because I viewed AI courses in Chennai, it surfaced exactly the colleges I had in mind — plus a few better ones.",
    grad: "from-blue-600 to-indigo-600",
  },
];

function AvatarShell({ initials, grad }: { initials: string; grad: string }) {
  return (
    <span
      className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${grad}`}
    >
      {initials}
    </span>
  );
}

export function TestimonialStrip() {
  return (
    <section className="bg-gradient-to-b from-white to-purple-50/50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading
          eyebrow="Student love"
          title="Stories from students who chose right"
          align="center"
        />
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08} className="h-full">
              <figure
                className="flex h-full flex-col rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover"
              >
                <Quote className="h-7 w-7 text-purple-200" />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                  <AvatarShell initials={t.initials} grad={t.grad} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                  <span className="ml-auto flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}