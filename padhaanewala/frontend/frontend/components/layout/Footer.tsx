import Link from "next/link";
import { LEGAL_NAV } from "@/lib/legal";
import { FOOTER_COLS as NAV_FOOTER_COLS } from "@/lib/nav";
import { SITE } from "@/lib/site";
import { Logo } from "@/components/layout/Header";
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const FOOTER_COLS = NAV_FOOTER_COLS;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-purple-100 dark:border-slate-800/80 bg-white dark:bg-[#070b14]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-6">
          {/* Brand & Social Column */}
          <div className="lg:col-span-2">
            <Logo showTagline={true} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-slate-400">
              Your trusted partner in finding the right college, course and career path.
            </p>

            {/* Social Icons. Read from SITE.social so the handles are declared
                once; they used to be bare `https://instagram.com` et al, which
                linked every visitor to the social home page of the platform
                rather than to this company. */}
            <div className="mt-6 flex items-center gap-3 text-gray-700 dark:text-slate-300">
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 transition-all hover:border-purple-300 dark:hover:border-purple-500/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/40"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a
                href={SITE.social.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 transition-all hover:border-purple-300 dark:hover:border-purple-500/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/40"
              >
                <LinkedinIcon className="h-4 w-4" />
              </a>
              <a
                href={SITE.social.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 transition-all hover:border-purple-300 dark:hover:border-purple-500/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/40"
              >
                <YoutubeIcon className="h-4 w-4" />
              </a>
              <a
                href={SITE.social.x}
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 transition-all hover:border-purple-300 dark:hover:border-purple-500/60 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/40"
              >
                <XIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* 3 Nav Columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-block text-sm text-gray-500 dark:text-slate-400 transition-all duration-200 hover:translate-x-1 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Right handwritten doodle */}
          <div className="flex flex-col items-center justify-center lg:items-end">
            <div className="text-right select-none">
              <p className="font-hand text-3xl font-bold leading-tight text-purple-900 dark:text-purple-300">
                Better
                <br />
                Colleges
                <br />
                Brighter
                <br />
                Futures
              </p>
              <svg viewBox="0 0 100 20" className="ml-auto mt-1 w-24" fill="none">
                <path
                  d="M2 14 C 30 2, 70 2, 98 12"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Legal documents + copyright.
            These live in the bottom bar rather than a fourth FOOTER_COLS entry:
            the grid above is `lg:grid-cols-6` and fully consumed by
            brand (col-span-2) + 3 nav columns + the doodle block, so a "Legal"
            column would have meant either a 7th track with ~15rem-wide columns
            or dropping the brand block. A single wrapping row is also the more
            conventional placement, and it keeps the six documents together. */}
        <div className="mt-12 border-t border-gray-100 pt-6 dark:border-slate-800/80">
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:justify-start">
              {LEGAL_NAV.map((entry, index) => (
                <li key={entry.slug} className="flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-gray-300 dark:text-slate-700">
                      |
                    </span>
                  )}
                  <Link
                    href={entry.href}
                    className="text-xs text-gray-500 transition-colors hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400"
                  >
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 text-center text-xs text-gray-400 sm:text-left dark:text-slate-500">
            © {SITE.foundedYear}–2026 {SITE.name}. {SITE.legalName}, {SITE.address.locality},{" "}
            {SITE.address.region} {SITE.address.postalCode}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}