"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const [accessCheckTimedOut, setAccessCheckTimedOut] = useState(false);
  const redirectedRef = useRef(false);

  /**
   * Hard deadline for the client-side check. The context normally settles both
   * flags (its own requests are bounded), but a wedged tab or a stalled fetch
   * must not leave an admin route looking like a permanent loading screen —
   * nor leave it renderable by default. Fail closed either way.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => setAccessCheckTimedOut(true), 8_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const settled = authReady && rolesReady;
    if (!settled && !accessCheckTimedOut) return;
    // A confirmed admin never needs redirecting, even if the timer fired first.
    if (settled && isAuthenticated && isAdmin) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else {
      // Includes an authenticated user whose roles never arrived: deny rather
      // than rendering admin content on an unresolved permission check.
      router.replace("/dashboard");
    }
  }, [authReady, rolesReady, isAuthenticated, isAdmin, accessCheckTimedOut, router]);

  // Never render the console until every check has positively succeeded, even
  // after the timeout fires. A late admin resolution can still show the console;
  // everyone else keeps seeing the loading copy until navigation completes.
  const allowed = authReady && rolesReady && isAuthenticated && isAdmin;
  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-gray-500 dark:text-slate-400">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <p className="text-sm font-medium">Checking your access…</p>
      </div>
    );
  }

  return <>{children}</>;
}