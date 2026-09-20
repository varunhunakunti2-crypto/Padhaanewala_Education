"use client";

import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight text-purple-950">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-gray-500">
        An unexpected error occurred. Our team has been notified and is
        looking into it.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="accent" size="md" onClick={reset}>
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