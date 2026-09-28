"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createReference, reportError } from "@/lib/observability";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  /**
   * The previous version of this file rendered the words "Our team has been
   * notified" and notified nobody: no Sentry, no `console.error`, no reporting
   * SDK, and the `error` and `digest` props were destructured away and thrown
   * out unused. A visitor who hit a broken page left no artefact anywhere.
   *
   * What replaced it makes no claim about delivery at all, because the
   * transport is fire-and-forget and cannot honestly promise one. The reference
   * is generated locally and is always real; reporting it is a side effect in an
   * effect, not state, so the copy is identical before and after the request and
   * nothing cascades.
   */
  const [reference] = useState(createReference);

  useEffect(() => {
    reportError(error, { source: "app/error", digest: error.digest, reference });
    // `error` gets a fresh identity on some React versions when the boundary
    // re-renders; `error.digest` is the stable identifier and is the real
    // dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error.digest, reference]);

  return (
    <section className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight text-purple-950">
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
        <Button variant="accent" size="md" onClick={retry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-5 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-100"
        >
          Go to homepage <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
