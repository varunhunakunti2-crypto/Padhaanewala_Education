import Link from "next/link";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

const CITIES = [
  {
    name: "Bangalore",
    tag: "Tech capital",
    href: "/colleges?q=Bangalore",
    grad: "from-purple-600 via-blue-600 to-indigo-700",
    ring: "hover:ring-purple-300",
    accent: "text-purple-200",
  },
  {
    name: "Mumbai",
    tag: "Finance hub",
    href: "/colleges?q=Mumbai",
    grad: "from-blue-600 via-indigo-600 to-slate-700",
    ring: "hover:ring-blue-300",
    accent: "text-blue-200",
  },
  {
    name: "Delhi",
    tag: "Capital city",
    href: "/colleges?q=Delhi",
    grad: "from-rose-500 via-orange-500 to-amber-500",
    ring: "hover:ring-rose-300",
    accent: "text-rose-100",
  },
  {
    name: "Hyderabad",
    tag: "Startup hub",
    href: "/colleges?q=Hyderabad",
    grad: "from-amber-500 via-orange-600 to-rose-600",
    ring: "hover:ring-amber-300",
    accent: "text-amber-100",
  },
  {
    name: "Chennai",
    tag: "Education hub",
    href: "/colleges?q=Chennai",
    grad: "from-teal-500 via-emerald-600 to-cyan-700",
    ring: "hover:ring-teal-300",
    accent: "text-teal-100",
  },
  {
    name: "Pune",
    tag: "Student city",
    href: "/colleges?q=Pune",
    grad: "from-indigo-500 via-purple-600 to-fuchsia-600",
    ring: "hover:ring-indigo-300",
    accent: "text-indigo-100",
  },
];

function CitySkyline({ grad }: { grad: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${grad}`}>
      {/* glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(255,255,255,0.35),transparent_50%)]" />
      {/* sun */}
      <div className="absolute right-5 top-5 h-9 w-9 rounded-full bg-white/70 shadow-[0_0_30px_rgba(255,255,255,0.6)]" />
      {/* skyline */}
      <svg viewBox="0 0 300 120" className="absolute inset-x-0 bottom-0 h-[58%] w-full" preserveAspectRatio="none">
        <path
          d="M0 120V92h14v-16h12v16h10V66h16v26h8V54h14v38h12v-14h16v14h10V70h16v28h12v-10h18v10h8V58h16v34h10v-18h14v18h10V76h18v22h10v-8h16v14h12V82h14v38H0Z"
          fill="rgba(255,255,255,0.85)"
        />
        <g fill="rgba(255,255,255,0.95)">
          <rect x="26" y="82" width="12" height="8" rx="1" opacity="0.6" />
          <rect x="70" y="70" width="12" height="8" rx="1" opacity="0.6" />
          <rect x="130" y="96" width="12" height="8" rx="1" opacity="0.6" />
          <rect x="168" y="86" width="12" height="8" rx="1" opacity="0.6" />
          <rect x="240" y="80" width="12" height="8" rx="1" opacity="0.6" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}

export function PopularDestinations() {
  return (
    <section className="relative isolate overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1.5 text-purple-700 ring-1 ring-inset ring-purple-200">
              <MapPin className="h-3.5 w-3.5" /> Top destinations
            </p>
            <h2 className="section-title font-display font-extrabold text-purple-950">
              Where do you want to study?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-500">
              Explore colleges in India&apos;s brightest cities for campus life, jobs
              and student culture.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {CITIES.map((city, i) => (
            <Reveal key={city.name} delay={i * 0.06}>
              <Link
                href={city.href}
                className={`group relative block h-40 overflow-hidden rounded-2xl ring-1 ring-purple-100/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:h-48 ${city.ring}`}
              >
                <CitySkyline grad={city.grad} />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                        <Building2 className="h-3 w-3" /> {city.tag}
                      </p>
                      <h3 className="mt-0.5 font-display text-lg font-extrabold text-white drop-shadow-sm sm:text-xl">
                        {city.name}
                      </h3>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-all duration-300 group-hover:bg-white group-hover:text-purple-700">
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}