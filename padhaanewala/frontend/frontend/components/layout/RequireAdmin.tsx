"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

/**
 * Client-side guard for the admin console.
 *
 * This is UX, not a security boundary: every admin endpoint is role-gated
 * server-side via `require_role` in backend/app/dependencies.py. A student who
 * forces past this component still gets 403 on all 30+ admin reads.
 *
 * The admin console is invisible to everyone who is not an admin or
 * super_admin: unauthored visitors are sent to the login page and
 * authenticated non-admins are bounced straight to their own dashboard — the
 * `/admin` route is never rendered to them, so its existence is not advertised.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, rolesReady, isAdmin } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!authReady || !rolesReady) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [authReady, rolesReady, isAuthenticated, isAdmin, router]);

  if (!authReady || !rolesReady) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-gray-500 dark:text-slate-400">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <p className="text-sm font-medium">Checking your access…</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return <>{children}</>;
}