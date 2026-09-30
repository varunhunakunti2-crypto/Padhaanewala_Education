"use client";

import Link from "next/link";
import { ArrowRight, Bell, Bookmark, GraduationCap, Scale, Search } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { DASHBOARD_NAV } from "@/lib/nav";
import { SITE } from "@/lib/site";

/**
 * Signed-in account page: the colleges the user saved, and the notifications we
 * sent them.
 *
 * Dark mode. Every surface here was a hardcoded light-mode hex with no `dark:`
 * variant, so the global theme toggle — which persists to `localStorage` and adds
 * a class to `<html>` before first paint — did nothing at all on this page. A
 * student who chose dark mode, then signed in, got a white page. The tokens are
 * declared once below rather than repeated per element, so this cannot drift
 * again: a new element picks up the right colour in both themes by naming a
 * token, not by inventing a hex.
 *
 * Navigation. The sidebar used to carry its own hardcoded list that duplicated
 * the header's and had already drifted from it. It now renders `DASHBOARD_NAV`,
 * which is derived from `PRIMARY_NAV` in `lib/nav.ts`.
 */
const T = {
  page: "bg-[#FAF9F6] dark:bg-[#0b1020] text-[#16204A] dark:text-slate-100",
  aside: "border-[#EEE9E2] dark:border-slate-800 bg-white dark:bg-slate-900",
  card: "bg-white dark:bg-slate-900 ring-1 ring-[#EFE9E2] dark:ring-slate-800",
  subtle: "bg-[#FAF9F6] dark:bg-slate-800/60 ring-1 ring-[#EFE9E2] dark:ring-slate-800",
  divider: "bg-[#EEE9E2] dark:bg-slate-800",
  heading: "text-[#16204A] dark:text-white",
  body: "text-[#55637B] dark:text-slate-400",
  muted: "text-[#8A96A9] dark:text-slate-500",
  accent: "text-[#3159C9] dark:text-indigo-400",
  navIdle: "text-[#55637B] dark:text-slate-400 hover:bg-[#F4F2EC] dark:hover:bg-slate-800",
  navActive: "bg-[#EEF1FF] text-[#3159C9] dark:bg-indigo-500/15 dark:text-indigo-300",
  avatar: "bg-[#DCE4F5] text-[#3159C9] dark:bg-indigo-500/20 dark:text-indigo-300",
} as const;

function Avatar({ initial, className = "" }: { initial: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${T.avatar} ${className}`}>
      {initial}
    </span>
  );
}

export default function DashboardExplorer() {
  const {
    profile,
    savedColleges,
    savedCollegeRecords,
    savedSync,
    savedSyncMessage,
    compareList,
    refreshSavedColleges,
    notifications,
  } = useApp();

  const displayName = profile?.name?.trim() || "";
  const firstName = displayName ? displayName.split(" ")[0] : "there";
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "U";
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className={`grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr] ${T.page}`}>
      {/* ================= SIDEBAR ================= */}
      {/* `pt-24` clears the global floating header, which is `fixed` and ends
          78px down the viewport (16px margin-top + 62px pill). Without it the
          brand block and profile chip render underneath the header pill. This
          also clears the compact scrolled header, which ends at 62px. The
          sidebar and <main> must share the same offset or the two columns
          start at different heights. */}
      <aside className={`hidden border-r px-4 pb-6 pt-24 lg:block ${T.aside}`}>
        {/* brand */}
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#16204A] text-white dark:bg-indigo-600">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <span className={`font-display block text-[19px] font-extrabold tracking-tight ${T.heading}`}>
              {SITE.name}
            </span>
            <span className={`block text-[11px] font-medium ${T.muted}`}>{SITE.tagline}</span>
          </span>
        </Link>

        {/* profile */}
        {displayName ? (
          <div
            className={`mt-6 flex w-full items-center gap-3 rounded-[18px] p-3 text-left ${T.subtle}`}
          >
            <Avatar initial={initial} className="h-[50px] w-[50px] text-[17px]" />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[16px] font-bold ${T.heading}`}>{displayName}</span>
            </span>
          </div>
        ) : (
          <Link href="/login" className={`mt-6 flex w-full items-center gap-3 rounded-[18px] p-3 text-left ${T.subtle}`}>
            <Avatar initial="U" className="h-[50px] w-[50px] text-[17px]" />
            <span className="min-w-0 flex-1">
              <span className={`block text-[16px] font-bold ${T.heading}`}>Sign in</span>
              <span className={`block text-[13px] ${T.muted}`}>Sync your saved colleges</span>
            </span>
          </Link>
        )}

        {/* nav — sourced from the manifest, so it cannot drift from the header */}
        <nav className="mt-4 space-y-1">
          {DASHBOARD_NAV.map((n) => {
            const Icon = n.icon;
            const active = n.href === "/dashboard";
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold transition ${active ? T.navActive : T.navIdle}`}
              >
                <Icon className="h-[19px] w-[19px]" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="min-w-0 px-5 pb-6 pt-24 sm:px-7 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar initial={initial} className="h-[46px] w-[46px] text-[17px]" />
            <div>
              <h1 className={`font-display text-[21px] font-extrabold tracking-tight ${T.heading}`}>
                {displayName ? `Welcome back, ${firstName}` : "Your account"}
              </h1>
              <p className={`text-[14px] ${T.muted}`}>
                Your saved colleges and our latest updates, in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/colleges"
              aria-label="Search colleges"
              className={`grid h-10 w-10 place-items-center rounded-full transition ${T.subtle} ${T.muted} hover:text-[#3159C9] dark:hover:text-indigo-300`}
            >
              <Search className="h-[18px] w-[18px]" />
            </Link>
            {displayName ? (
              <span className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 ring-1 ${T.card}`}>
                <Avatar initial={initial} className="h-8 w-8 text-[14px]" />
                <span className="text-sm font-semibold">{displayName}</span>
              </span>
            ) : null}
          </div>
        </header>

        {/* saved / compare summary */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Link href="/colleges" className={`group flex flex-col overflow-hidden rounded-[24px] p-6 transition hover:ring-indigo-300 dark:hover:ring-indigo-500/40 ${T.card}`}>
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#EEF1FF] text-[#3159C9] dark:bg-indigo-500/15 dark:text-indigo-300">
              <Bookmark className="h-5 w-5" />
            </span>
            <p className={`font-display mt-4 text-3xl font-extrabold tabular-nums ${T.heading}`}>
              {savedSync === "loading" ? "—" : savedColleges.length}
            </p>
            <p className={`mt-0.5 text-[15px] font-semibold ${T.heading}`}>Colleges saved</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold ${T.accent}`}>
              Browse colleges <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link href="/compare" className={`group flex flex-col overflow-hidden rounded-[24px] p-6 transition hover:ring-indigo-300 dark:hover:ring-indigo-500/40 ${T.card}`}>
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#FFF2E8] text-[#B3660F] dark:bg-amber-500/15 dark:text-amber-400">
              <Scale className="h-5 w-5" />
            </span>
            <p className={`font-display mt-4 text-3xl font-extrabold tabular-nums ${T.heading}`}>{compareList.length}</p>
            <p className={`mt-0.5 text-[15px] font-semibold ${T.heading}`}>In comparison</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold ${T.accent}`}>
              Open comparison <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <div className={`flex flex-col overflow-hidden rounded-[24px] p-6 ${T.card}`}>
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#FDE8EE] text-[#F45D76] dark:bg-rose-500/15 dark:text-rose-400">
              <Bell className="h-5 w-5" />
            </span>
            <p className={`font-display mt-4 text-3xl font-extrabold tabular-nums ${T.heading}`}>{unread}</p>
            <p className={`mt-0.5 text-[15px] font-semibold ${T.heading}`}>Unread updates</p>
            <p className={`mt-3 text-[14px] ${T.muted}`}>Listed below.</p>
          </div>
        </div>

        {/* saved colleges — from the signed-in user's own account */}
        <div className={`mt-5 overflow-hidden rounded-[22px] ${T.card}`}>
          <div className={`flex items-center justify-between border-b px-6 py-4 ${T.divider}`}>
            <h2 className={`font-display text-[17px] font-extrabold tracking-tight ${T.heading}`}>
              Your saved colleges
            </h2>
            <Link href="/colleges" className={`text-[13px] font-bold ${T.accent} hover:underline`}>
              Find more
            </Link>
          </div>

          <div className={`divide-y ${T.divider}`}>
            {savedSync === "loading" ? (
              <p className={`px-6 py-10 text-center text-[14px] ${T.muted}`}>
                Loading your saved colleges&hellip;
              </p>
            ) : savedSync === "error" ? (
              <div className="px-6 py-10 text-center">
                <p className={`text-[14px] ${T.body}`}>
                  {savedSyncMessage ?? "We could not load your saved colleges."}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshSavedColleges()}
                  className={`mt-3 text-[13px] font-bold ${T.accent} hover:underline`}
                >
                  Try again
                </button>
              </div>
            ) : savedSync === "no-profile" ? (
              <p className={`px-6 py-10 text-center text-[14px] ${T.body}`}>
                {savedSyncMessage ??
                  "Complete your student profile to save colleges across devices."}
              </p>
            ) : savedCollegeRecords.length === 0 ? (
              <p className={`px-6 py-10 text-center text-[14px] ${T.muted}`}>
                You haven&apos;t saved any colleges yet. Save one from a college profile and
                it will appear here on any device you sign in from.
              </p>
            ) : (
              savedCollegeRecords.map((record) => (
                <Link
                  key={record.id}
                  href={`/colleges/${record.college.slug}`}
                  className={`flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-[#FAF9F7] dark:hover:bg-slate-800/60`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-[15px] font-semibold ${T.heading}`}>{record.college.name}</p>
                    <p className={`mt-0.5 text-[13px] ${T.muted}`}>
                      {[record.college.city, record.college.state].filter(Boolean).join(", ") ||
                        "Location not recorded"}
                    </p>
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 ${T.muted}`} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* notifications */}
        <div className={`mt-5 overflow-hidden rounded-[22px] ${T.card}`}>
          <div className={`flex items-center justify-between border-b px-6 py-4 ${T.divider}`}>
            <h2 className={`font-display text-[17px] font-extrabold tracking-tight ${T.heading}`}>Recent updates</h2>
            {unread > 0 ? (
              <span className="rounded-full bg-[#FDE8EE] px-3 py-1 text-[12px] font-bold text-[#F45D76] dark:bg-rose-500/15 dark:text-rose-400">
                {unread} unread
              </span>
            ) : null}
          </div>
          <div className={`divide-y ${T.divider}`}>
            {notifications.length === 0 ? (
              <p className={`px-6 py-10 text-center text-[14px] ${T.muted}`}>
                No updates yet. We&apos;ll let you know when something changes.
              </p>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="px-6 py-4">
                  <p className={`text-[15px] font-semibold ${T.heading}`}>{n.title}</p>
                  {n.message ? <p className={`mt-1 text-[14px] ${T.body}`}>{n.message}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
