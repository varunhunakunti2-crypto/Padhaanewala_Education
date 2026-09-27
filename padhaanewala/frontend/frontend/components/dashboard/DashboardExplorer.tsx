"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  Bell,
  Bookmark,
  GraduationCap,
  Home,
  Scale,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { SITE } from "@/lib/site";

/* ---------- data ---------- */

const NAV = [
  { id: "home", label: "Overview", href: "/dashboard", icon: <Home className="h-[19px] w-[19px]" />, active: true },
  { id: "colleges", label: "Colleges", href: "/colleges", icon: <GraduationCap className="h-[19px] w-[19px]" /> },
  { id: "compare", label: "Compare", href: "/compare", icon: <Scale className="h-[19px] w-[19px]" /> },
  { id: "scholarships", label: "Scholarships", href: "/scholarships", icon: <Award className="h-[19px] w-[19px]" /> },
  { id: "mock-tests", label: "Mock Tests", href: "/mock-tests", icon: <Sparkles className="h-[19px] w-[19px]" /> },
];

/* ============ main ============ */

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
    showToast,
  } = useApp();

  const displayName = profile?.name?.trim() || "";
  const firstName = displayName ? displayName.split(" ")[0] : "there";
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "U";

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#FAF9F6] text-[#16204A] lg:grid-cols-[300px_1fr]">
      {/* ================= SIDEBAR ================= */}
      <aside className="hidden border-r border-[#EEE9E2] bg-white px-4 py-6 lg:block">
        {/* brand */}
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#16204A] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-[19px] font-extrabold tracking-tight">{SITE.name}</span>
            <span className="block text-[11px] font-medium text-[#A8B0BE]">{SITE.tagline}</span>
          </span>
        </Link>

        {/* profile */}
        {displayName ? (
          <button
            type="button"
            onClick={() => showToast({ variant: "info", title: "Profile", description: "Open your profile settings." })}
            className="mt-6 flex w-full items-center gap-3 rounded-[18px] bg-[#FAF9F6] p-3 text-left ring-1 ring-[#EFE9E2] transition hover:bg-[#F4F2EC]"
          >
            <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[#DCE4F5] text-[17px] font-bold text-[#3159C9]">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold">{displayName}</span>
            </span>
          </button>
        ) : (
          <Link
            href="/login"
            className="mt-6 flex w-full items-center gap-3 rounded-[18px] bg-[#FAF9F6] p-3 text-left ring-1 ring-[#EFE9E2] transition hover:bg-[#F4F2EC]"
          >
            <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[#DCE4F5] text-[17px] font-bold text-[#3159C9]">
              U
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">Sign in</span>
              <span className="block text-[13px] text-[#8A96A9]">Sync your saved colleges</span>
            </span>
          </Link>
        )}

        {/* nav */}
        <nav className="mt-4 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold text-[#55637B] transition hover:bg-[#F4F2EC] ${
                n.active ? "bg-[#EEF1FF] text-[#3159C9]" : ""
              }`}
            >
              {n.icon} {n.label}
            </Link>
          ))}
        </nav>

        <div className="my-6 h-px bg-[#EEE9E2]" />

        <nav className="space-y-1">
          <Link
            href="/reviews"
            className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold text-[#55637B] transition hover:bg-[#F4F2EC]"
          >
            <Settings className="h-[19px] w-[19px]" /> Reviews
          </Link>
        </nav>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="min-w-0 px-5 py-6 sm:px-7 lg:px-8">
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#DCE4F5] text-[17px] font-bold text-[#3159C9]">
              {initial}
            </span>
            <div>
              <h1 className="font-display text-[21px] font-extrabold tracking-tight">
                {displayName ? `Welcome back, ${firstName}` : "Your dashboard"}
              </h1>
              <p className="text-[14px] text-[#8A96A9]">Your saved colleges, comparisons and updates in one place.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/colleges"
              aria-label="Search colleges"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F0EA] text-[#A8B0BE] transition hover:text-[#3159C9]"
            >
              <Search className="h-[18px] w-[18px]" />
            </Link>
            {displayName ? (
              <span className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 ring-1 ring-[#EFE9E2]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#DCE4F5] text-[14px] font-bold text-[#3159C9]">
                  {initial}
                </span>
                <span className="text-sm font-semibold">{displayName}</span>
              </span>
            ) : null}
          </div>
        </header>

        {/* saved / compare summary */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Link
            href="/colleges"
            className="group flex flex-col overflow-hidden rounded-[24px] bg-white p-6 ring-1 ring-[#EFE9E2] transition hover:ring-[#DCE4F5]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#EEF1FF] text-[#3159C9]">
              <Bookmark className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">
              {savedSync === "loading" ? "—" : savedColleges.length}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold">Colleges saved</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#3159C9]">
              Browse colleges <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/compare"
            className="group flex flex-col overflow-hidden rounded-[24px] bg-white p-6 ring-1 ring-[#EFE9E2] transition hover:ring-[#DCE4F5]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#FFF2E8] text-[#B3660F]">
              <Scale className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">{compareList.length}</p>
            <p className="mt-0.5 text-[15px] font-semibold">In comparison</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#3159C9]">
              Open comparison <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <div className="flex flex-col overflow-hidden rounded-[24px] bg-white p-6 ring-1 ring-[#EFE9E2]">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#FDE8EE] text-[#F45D76]">
              <Bell className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">{unread}</p>
            <p className="mt-0.5 text-[15px] font-semibold">Unread updates</p>
            <p className="mt-3 text-[14px] text-[#8A96A9]">Listed below.</p>
          </div>
        </div>

        {/* saved colleges — from the signed-in user's own account */}
        <div className="mt-5 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#EFE9E2]">
          <div className="flex items-center justify-between border-b border-[#EEE9E2] px-6 py-4">
            <h2 className="font-display text-[17px] font-extrabold tracking-tight">
              Your saved colleges
            </h2>
            <Link
              href="/colleges"
              className="text-[13px] font-bold text-[#3159C9] hover:underline"
            >
              Find more
            </Link>
          </div>

          <div className="divide-y divide-[#EEE9E2]">
            {savedSync === "loading" ? (
              <p className="px-6 py-10 text-center text-[14px] text-[#A8B0BE]">
                Loading your saved colleges&hellip;
              </p>
            ) : savedSync === "error" ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] text-[#55637B]">
                  {savedSyncMessage ?? "We could not load your saved colleges."}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshSavedColleges()}
                  className="mt-3 text-[13px] font-bold text-[#3159C9] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : savedSync === "no-profile" ? (
              <p className="px-6 py-10 text-center text-[14px] text-[#55637B]">
                {savedSyncMessage ??
                  "Complete your student profile to save colleges across devices."}
              </p>
            ) : savedCollegeRecords.length === 0 ? (
              <p className="px-6 py-10 text-center text-[14px] text-[#A8B0BE]">
                You haven&apos;t saved any colleges yet. Save one from a college profile and
                it will appear here on any device you sign in from.
              </p>
            ) : (
              savedCollegeRecords.map((record) => (
                <Link
                  key={record.id}
                  href={`/colleges/${record.college.slug}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-[#FAF9F7]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{record.college.name}</p>
                    <p className="mt-0.5 text-[13px] text-[#8A96A9]">
                      {[record.college.city, record.college.state].filter(Boolean).join(", ") ||
                        "Location not recorded"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#A8B0BE]" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* notifications */}
        <div className="mt-5 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#EFE9E2]">
          <div className="flex items-center justify-between border-b border-[#EEE9E2] px-6 py-4">
            <h2 className="font-display text-[17px] font-extrabold tracking-tight">Recent updates</h2>
            {unread > 0 ? (
              <span className="rounded-full bg-[#FDE8EE] px-3 py-1 text-[12px] font-bold text-[#F45D76]">
                {unread} unread
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-[#EEE9E2]">
            {notifications.length === 0 ? (
              <p className="px-6 py-10 text-center text-[14px] text-[#A8B0BE]">
                No updates yet. We&apos;ll let you know when something changes.
              </p>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="px-6 py-4">
                  <p className="text-[15px] font-semibold">{n.title}</p>
                  {n.message ? <p className="mt-1 text-[14px] text-[#55637B]">{n.message}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
