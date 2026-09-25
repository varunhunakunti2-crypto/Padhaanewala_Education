"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

/**
 * The 3D bot pulls in the whole three.js runtime plus a ~1 MB GLB. This FAB is
 * mounted by the root layout, so an eager import meant every page in the app
 * paid that cost. Loading it dynamically with `ssr: false` keeps three.js out of
 * the initial bundle and defers both the JS and the model fetch until the FAB
 * actually mounts.
 */
const RobotViewer = dynamic(
  () => import("@/components/ai/RobotViewer").then((m) => m.RobotViewer),
  {
    ssr: false,
    loading: () => (
      <span className="grid h-full w-full place-items-center rounded-full bg-purple-500/15" />
    ),
  },
);

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
