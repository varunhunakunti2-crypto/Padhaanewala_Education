import Link from "next/link";
import { Reveal } from "@/components/motion";

const groups = [
  {
    title: "Explore",
    links: [
      { label: "Colleges", href: "/colleges" },
      { label: "Courses", href: "/courses" },
      { label: "College Predictor", href: "/college-predictor" },
      { label: "Compare Colleges", href: "/compare" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Scholarships", href: "/scholarships" },
      { label: "Mock Tests", href: "/mock-tests" },
      { label: "Exams", href: "/exams" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms & Conditions", href: "/terms-conditions" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950 text-neutral-300">
      <Reveal>
      <div className="mx-auto grid w-full max-w-[1536px] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="foreground-accent flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-neutral-950">
              P
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              Padhaanewala
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-neutral-400">
            India&apos;s education discovery platform. Find colleges, courses,
            scholarships, mock tests and verified admission data in one place.
          </p>
        </div>

        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              {group.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      </Reveal>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-2 px-4 py-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Padhaanewala Edutech Services, Bengaluru 560100. All rights reserved.</p>
          <p>Data verification status shown for every college and course.</p>
        </div>
      </div>
    </footer>
  );
}