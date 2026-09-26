"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, ShieldAlert } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Client-side guard for the admin console.
 *
 * This is UX, not a security boundary: every admin endpoint is role-gated
 * server-side via `require_role` in backend/app/dependencies.py. A student who
 * forces past this component still gets 403 on all 30+ admin reads.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, rolesReady, isAdmin, refreshRoles } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [authReady, isAuthenticated, router]);

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

  if (!isAuthenticated) return null;

  if (!isAdmin) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white">
          Admin access required
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
          Your account does not have admin permissions, so the admin console is not available to you.
          If you believe this is a mistake, ask a super admin to grant you the admin role.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/dashboard" variant="accent" size="md">
            <LayoutDashboard className="h-4 w-4" /> Go to my dashboard
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="md">
            Back to homepage
          </ButtonLink>
        </div>
        <button
          type="button"
          onClick={() => void refreshRoles()}
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-gray-400 underline underline-offset-4 transition-colors hover:text-purple-600 dark:text-slate-500 dark:hover:text-purple-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          My permissions were just changed — re-check
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
