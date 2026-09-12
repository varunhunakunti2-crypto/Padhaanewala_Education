import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CompareIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Compare Colleges",
  description:
    "Side-by-side college comparison is coming soon. Until then, use the college directories and predictor to shortlist.",
};

export default function ComparePage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <CompareIcon className="h-8 w-8 text-neutral-700" />
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
              Compare colleges
            </h1>
          </div>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            Side-by-side comparison across fees, placements, ratings and courses is coming soon.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-16 text-center">
          <p className="text-sm font-medium text-neutral-700">
            This feature is being built. You can already compare the essentials manually:
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/colleges"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Browse colleges
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/college-predictor"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-950 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              Predict my colleges
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}