"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [authReady, isAuthenticated, router]);

  if (!authReady) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-gray-500 dark:text-slate-400">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300">
          <GraduationCap className="h-7 w-7" />
        </span>
        <p className="text-sm font-medium">Loading your account…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}