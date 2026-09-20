"use client";

import Link from "next/link";
import { RobotViewer } from "@/components/ai/RobotViewer";

export function AskAiFab() {
  return (
    <Link
      href="/ask-ai"
      aria-label="Ask Padhaanewala AI"
      title="Ask Padhaanewala AI — College & Exam Assistant"
      className="fixed bottom-36 right-4 z-[70] flex h-14 w-14 items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 sm:bottom-24 sm:right-6 drop-shadow-2xl"
    >
      <div className="relative h-22 w-22 flex-shrink-0 flex items-center justify-center pointer-events-none -m-4">
        <RobotViewer className="h-full w-full" autoRotate={false} modelScale={1.45} />
      </div>
    </Link>
  );
}
