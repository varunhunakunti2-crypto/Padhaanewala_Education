"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Maximize2,
  Mic,
  MonitorUp,
  Play,
  ShieldCheck,
  Video,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MockTest } from "@/lib/types";

export const MAX_VIOLATIONS = 3;

export type PermState = "pending" | "granted" | "denied";

export interface PermissionStatus {
  camera: PermState;
  mic: PermState;
  screen: PermState;
  fullscreen: PermState;
}

const PERMISSION_ROWS: { key: keyof PermissionStatus; icon: React.ReactNode; label: string }[] = [
  { key: "camera", icon: <Eye className="h-4 w-4" />, label: "Camera access" },
  { key: "mic", icon: <Mic className="h-4 w-4" />, label: "Microphone access" },
  { key: "screen", icon: <MonitorUp className="h-4 w-4" />, label: "Share entire screen" },
  { key: "fullscreen", icon: <Maximize2 className="h-4 w-4" />, label: "Full-screen mode" },
];

/**
 * Pre-test gate: requests camera, microphone, screen-share and full-screen
 * before the timer starts.
 */
export function TestSetupScreen({
  test,
  perms,
  screenError,
  onRequestSetup,
  onBegin,
}: {
  test: MockTest;
  perms: PermissionStatus;
  screenError: string | null;
  onRequestSetup: () => void;
  onBegin: () => void;
}) {
  const allGranted = Object.values(perms).every((p) => p === "granted");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950 p-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-400">
              <Video className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold text-white sm:text-2xl">
                Full-Screen Mock Test
              </h1>
              <p className="text-sm text-slate-400">{test.title}</p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-slate-300">
            This test runs in a locked, full-screen mode. Before it starts you must allow the
            permissions below. Leaving this tab, switching windows or exiting full screen is
            detected, and after <b className="text-white">{MAX_VIOLATIONS} violations</b> the test
            is submitted automatically.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Violations are enforced by this browser session only. They are not uploaded or reviewed
            by an administrator, so treat this as a focus tool rather than a proctored exam.
          </p>

          <ul className="mt-6 space-y-3">
            {PERMISSION_ROWS.map(({ key, icon, label }) => {
              const st = perms[key];
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-300">
                    {icon}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-200">{label}</span>
                  {st === "granted" ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Granted
                    </span>
                  ) : st === "denied" ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <XCircle className="h-4 w-4" /> Blocked
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">Waiting…</span>
                  )}
                </li>
              );
            })}
          </ul>

          {screenError && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {screenError}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={onRequestSetup}>
              <ShieldCheck className="h-4 w-4" />{" "}
              {perms.camera === "pending" ? "Start secure setup" : "Retry blocked access"}
            </Button>
            <Button variant="warm" size="lg" disabled={!allGranted} onClick={onBegin}>
              Begin test <Play className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <Link
              href="/mock-tests"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to all mock tests
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
