"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createReference, reportError } from "@/lib/observability";
import "./globals.css";

/**
 * Errors thrown in the *root layout* — or in a nested layout — have no error
 * boundary above them, so `app/error.tsx` does not catch them and Next.js falls
 * back to its own built-in 500 page. This file closes that gap, which the
 * tracker recorded as a Phase 5.4 defect: there was no `global-error.tsx` at
 * all, so the worst possible failure produced an unbranded page and no report.
 *
 * This component *replaces* the root layout, so it has to render its own
 * `<html>` and `<body>`. Two consequences, both from the Next.js docs:
 *
 *   - Global styles are not included by the layout it replaces, so
 *     `./globals.css` is imported here; that import is what makes the Tailwind
 *     utilities in this file resolve. The built-in 500 page has no stylesheet at
 *     all, which is why it looks the way it does.
 *   - Nothing above it runs, so the theme class is absent and the page follows
 *     the OS colour scheme. That is also why there are no `dark:` variants
 *     below: they would never match.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [reference] = useState(createReference);

  useEffect(() => {
    reportError(error, { source: "global-error", digest: error.digest, reference });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error.digest, reference]);

  return (
    <html lang="en-IN">
      <head>
        <title>Something went wrong</title>
      </head>
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center font-sans text-gray-900">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-8 w-8"
            aria-hidden
          >
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-purple-950">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-md text-sm text-gray-500">
          An unexpected error occurred. If it keeps happening, contact us and quote
          the reference below.
        </p>
        <p className="mt-2 font-mono text-xs text-gray-400">
          Reference: {reference}
          {error.digest ? ` · server digest: ${error.digest}` : null}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-5 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-100"
          >
            Go to homepage
          </Link>
        </div>
      </body>
    </html>
  );
}
