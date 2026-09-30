"use client";

import { Headset, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AdmissionHelpBannerProps {
  className?: string;
}

export function AdmissionHelpBanner({ className }: AdmissionHelpBannerProps = {}) {
  return (
    <div className={cn("mt-12 sm:mt-16 w-full", className)}>
      <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-orange-100 dark:border-orange-500/30 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-slate-900 dark:via-purple-950/70 dark:to-slate-900 px-6 py-5 sm:flex-row shadow-sm">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30">
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">Need help choosing the right college?</p>
            <p className="text-sm text-gray-500 dark:text-gray-300">Talk to our counsellors — free, expert admission guidance.</p>
          </div>
        </div>
        <Link
          href="/admission"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 text-sm font-bold text-white shadow-md shadow-orange-500/30 transition hover:brightness-110"
        >
          Get Admission Help <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}