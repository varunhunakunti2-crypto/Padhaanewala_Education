import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Cookie,
  FileText,
  Gavel,
  Home,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import {
  LEGAL_LAST_UPDATED,
  LEGAL_NAV,
  type LegalDoc,
  legalHref,
} from "@/lib/legal";
import { SITE } from "@/lib/site";

const ICONS: Record<LegalDoc["icon"], LucideIcon> = {
  shield: ShieldCheck,
  scroll: ScrollText,
  cookie: Cookie,
  alert: AlertTriangle,
  gavel: Gavel,
  wallet: Wallet,
  file: FileText,
};

/**
 * Formatted once at module scope. The input is a bare calendar date, so it is
 * pinned to UTC and an explicit locale: formatting it in the server's local
 * zone or with the ambient locale would render "26 September 2026" for some
 * builds and "September 27, 2026" for others, and would shift a day for anyone
 * west of UTC.
 */
const LAST_UPDATED_LABEL = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "long",
  timeZone: "UTC",
}).format(new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`));

/**
 * Shared shell for every document in `lib/legal.ts`: breadcrumb, title block,
 * sticky table of contents, prose, and cross-links to the sibling documents.
 *
 * A server component on purpose. An active-section highlight in the contents
 * list would need scroll observation, and measuring the DOM during render is
 * both a hydration hazard and a layout-thrash source; the anchor links work
 * without it.
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const Icon = ICONS[doc.icon];
  const others = LEGAL_NAV.filter((entry) => entry.slug !== doc.slug);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-20">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          <li>
            <Link
              href="/"
              className="inline-flex items-center gap-1 transition-colors hover:text-purple-600 dark:hover:text-purple-400"
            >
              <Home className="h-3 w-3" aria-hidden="true" />
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3 w-3" />
          </li>
          <li>
            <span className="text-gray-500 dark:text-slate-400">{doc.title}</span>
          </li>
        </ol>
      </nav>

      <header className="mt-5 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:ring-purple-800/60">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          Legal
        </span>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-purple-950 text-balance dark:text-white sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          {doc.description}
        </p>
        <p className="mt-4 text-xs text-gray-400 dark:text-slate-500">
          Last updated:{" "}
          <time dateTime={LEGAL_LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        </p>
      </header>

      <div className="mt-12 gap-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav aria-label={`${doc.title} contents`}>
            <p className="eyebrow text-gray-400 dark:text-slate-500">On this page</p>
            <ol className="mt-4 space-y-1 border-l border-purple-100 pl-4 dark:border-slate-800">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ml-[1.0625rem] block border-l-2 border-transparent pl-3 text-sm leading-snug text-gray-500 transition-colors hover:border-purple-400 hover:text-purple-700 dark:text-slate-400 dark:hover:text-purple-300"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="mt-12 min-w-0 lg:mt-0">
          <article className="legal-prose max-w-3xl">
                {doc.sections.map((section) => (
                  <section key={section.id} id={section.id}>
                    <h2>{section.heading}</h2>
                    {section.blocks.map((block, index) => {
                      switch (block.kind) {
                        case "p":
                          return <p key={index}>{block.text}</p>;
                        case "ul":
                          return (
                            <ul key={index}>
                              {block.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          );
                        // The DPDP notice's itemised table (DPDP Act s.5(1)
                        // requires a purpose, basis and retention period per
                        // category). A definition list rather than a table so it
                        // reflows to one column on a phone without horizontal
                        // scrolling, and so screen readers announce the term
                        // before its detail.
                        case "dl":
                          return (
                            <dl key={index} className="my-6 space-y-4">
                              {block.items.map((item) => (
                                <div
                                  key={item.term}
                                  className="rounded-2xl bg-white/60 p-5 ring-1 ring-purple-100/60 dark:bg-slate-900/60 dark:ring-slate-800"
                                >
                                  <dt className="font-semibold text-purple-950 dark:text-white">
                                    {item.term}
                                  </dt>
                                  <dd className="mt-1.5">{item.detail}</dd>
                                </div>
                              ))}
                            </dl>
                          );
                        case "note":
                          return (
                            <p key={index} className="legal-note">
                              {block.text}
                            </p>
                          );
                      }
                    })}
                  </section>
                ))}

          </article>

          <nav aria-label="Other legal documents" className="mt-16 border-t border-purple-100 pt-8 dark:border-slate-800/80">
            <p className="eyebrow text-gray-400 dark:text-slate-500">
              Other legal documents
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {others.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={entry.href}
                    className="group flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-purple-100/60 transition-colors hover:bg-purple-50/50 hover:ring-purple-200 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800/60 dark:hover:ring-slate-700"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {entry.title}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-purple-500 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-8 text-xs leading-relaxed text-gray-400 dark:text-slate-500">
            Questions about this document? Email{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="font-semibold text-purple-600 underline underline-offset-2 hover:text-purple-700 dark:text-purple-400"
            >
              {SITE.email}
            </a>
            . You can also read how to escalate a complaint on our{" "}
            <Link
              href={legalHref("grievance")}
              className="font-semibold text-purple-600 underline underline-offset-2 hover:text-purple-700 dark:text-purple-400"
            >
              Grievance Redressal
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </section>
  );
}
