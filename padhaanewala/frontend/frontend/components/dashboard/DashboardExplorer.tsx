"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  Search,
  CalendarClock,
  Award,
  Settings,
  ArrowRight,
  Bookmark,
  Bell,
  Briefcase,
  GraduationCap as EduIcon,
  Home,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/* ---------- data ---------- */

const NAV = [
  { id: "home", label: "Home", icon: <Home className="h-[19px] w-[19px]" />, active: true },
  { id: "jobs", label: "Jobs", icon: <Briefcase className="h-[19px] w-[19px]" /> },
  { id: "scholarships", label: "Scholarships", icon: <Award className="h-[19px] w-[19px]" /> },
  { id: "events", label: "Events", icon: <CalendarClock className="h-[19px] w-[19px]" /> },
];

const CHIPS = ["All Saved", "Events", "Scholarships", "Jobs", "Resources", "Careers"] as const;
type Chip = (typeof CHIPS)[number];

const SAVED = [
  {
    id: "s1",
    title: "Tech Day 2021",
    cat: "Tech",
    catClass: "bg-[#EDEDF1] text-[#55637B]",
    org: "NerdWallet",
  },
  {
    id: "s2",
    title: "Political Strategy Fellow",
    cat: "Politics",
    catClass: "bg-[#FFF2A8] text-[#8A6D00]",
    org: "Alect Political",
  },
  {
    id: "s3",
    title: "Paid Marketing Summer Intern",
    cat: "Marketing",
    catClass: "bg-[#E8C5F7] text-[#8A3FB8]",
    org: "Levi’s",
  },
  {
    id: "s4",
    title: "NY Times Paid Internship",
    cat: "Arts",
    catClass: "bg-[#FFDDBF] text-[#B3660F]",
    org: "The NY Times",
  },
];

/* ============ main ============ */

export default function DashboardExplorer() {
  const { profile, savedColleges, showToast } = useApp();
  const [chip, setChip] = useState<Chip>("All Saved");
  const name = profile?.name ?? "Pushkar";
  const firstName = (name || "there").trim().split(" ")[0];

  const rows = useMemo(
    () =>
      chip === "All Saved"
        ? SAVED
        : SAVED.filter((r) => {
            const map: Record<string, string> = {
              Events: "Tech",
              Scholarships: "Politics",
              Jobs: "Marketing",
              Resources: "Arts",
            };
            return r.cat === map[chip];
          }),
    [chip],
  );

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#FAF9F6] text-[#16204A] lg:grid-cols-[300px_1fr]">
      {/* ================= SIDEBAR ================= */}
      <aside className="hidden border-r border-[#EEE9E2] bg-white px-4 py-6 lg:block">
        {/* brand */}
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#16204A] text-white">
            <EduIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-[19px] font-extrabold tracking-tight">EduPath</span>
            <span className="block text-[11px] font-medium text-[#A8B0BE]">Learn · Explore · Grow</span>
          </span>
        </Link>

        {/* profile */}
        <button
          type="button"
          onClick={() => showToast({ variant: "info", title: "Profile", description: "Open your EduPath profile settings." })}
          className="mt-6 flex w-full items-center gap-3 rounded-[18px] bg-[#FAF9F6] p-3 text-left ring-1 ring-[#EFE9E2] transition hover:bg-[#F4F2EC]"
        >
          <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[#DCE4F5] text-[17px] font-bold text-[#3159C9]">
            {(name || "P").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold">{name}</span>
            <span className="block text-[13px] text-[#8A96A9]">B.Tech · 1st Year</span>
          </span>
          <span className="text-[#A8B0BE]">⌄</span>
        </button>

        {/* nav */}
        <nav className="mt-4 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => showToast({ variant: "info", title: n.label, description: "Section — coming soon." })}
              className={cn(
                "flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold text-[#55637B] transition hover:bg-[#F4F2EC]",
                n.active && "bg-[#EEF1FF] text-[#3159C9]",
              )}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </nav>

        <div className="my-6 h-px bg-[#EEE9E2]" />

        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => showToast({ variant: "info", title: "Settings", description: "Open account settings." })}
            className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold text-[#55637B] transition hover:bg-[#F4F2EC]"
          >
            <Settings className="h-[19px] w-[19px]" /> Settings
          </button>
          <button
            type="button"
            onClick={() => showToast({ variant: "info", title: "Updates", description: "3 new updates are available." })}
            className="relative flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold text-[#55637B] transition hover:bg-[#F4F2EC]"
          >
            <Bell className="h-[19px] w-[19px]" /> Updates
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#F45D76] px-1.5 text-[11px] font-bold text-white">3</span>
          </button>
        </nav>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="min-w-0 px-5 py-6 sm:px-7 lg:px-8">
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#DCE4F5] text-[17px] font-bold text-[#3159C9]">
              {(name || "P").charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-[21px] font-extrabold tracking-tight">
                Good morning, {firstName} <span>👋</span>
              </h1>
              <p className="text-[14px] text-[#8A96A9]">Here’s what’s fresh for you.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F0EA] text-[#A8B0BE]">
              <Search className="h-[18px] w-[18px]" />
            </span>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => showToast({ variant: "info", title: "Notifications", description: "3 unread updates." })}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-[#F2F0EA] text-[#A8B0BE]"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#F45D76] text-[10px] font-bold text-white ring-2 ring-white">3</span>
            </button>
            <button
              type="button"
              onClick={() => showToast({ variant: "info", title: "Profile", description: "Open your profile menu." })}
              className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 ring-1 ring-[#EFE9E2] transition hover:bg-[#FAF9F6]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#DCE4F5] text-[14px] font-bold text-[#3159C9]">
                {(name || "P").charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-semibold">{name}</span>
              <span className="text-[#A8B0BE]">⌄</span>
            </button>
          </div>
        </header>

        {/* featured row */}
        <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          {/* TOP PICK */}
          <article className="group flex flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-[#EFE9E2]">
            <div className="relative overflow-hidden">
              <div className="h-[150px] w-full bg-gradient-to-br from-[#E2E7F7] via-[#EEE9F4] to-[#F7E3E0]" />
              <span className="absolute right-5 top-5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#3159C9] shadow-sm">
                Top Pick
              </span>
            </div>
            <div className="p-6">
              <Badge variant="purple" className="mb-2">Apps & Extensions</Badge>
              <h2 className="font-display text-[22px] font-extrabold tracking-tight">
                Apps & Extensions Every Student Needs
              </h2>
              <p className="mt-3 text-[15px] leading-[1.6] text-[#66758C]">
                Explore our team’s favorite article-to-podcast apps, AI note-takers, organization tools and browser extensions.
              </p>
              <button
                type="button"
                onClick={() => showToast({ variant: "info", title: "Apps & Extensions", description: "Opening the full article." })}
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#3159C9] transition hover:text-[#16204A]"
              >
                Read the article <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>

          {/* NASA */}
          <article className="flex flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-[#EFE9E2]">
            <div className="flex items-center gap-3 px-6 pt-6">
              <span className="grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-[#111827] text-[20px]">🚀</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[#F45D76]">NASA</p>
                <h2 className="truncate font-display text-[17px] font-extrabold tracking-tight">
                  NASA Fellowship & Internship
                </h2>
              </div>
            </div>
            <p className="px-6 pt-3 text-[14px] leading-[1.6] text-[#66758C]">
              Leverage NASA’s unique missions and programs to enhance the capability, diversity and size of the nation’s future STEM workforce.
            </p>
            <div className="mt-auto flex items-center justify-between px-6 py-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8B0BE]">Type</p>
                  <p className="text-[13px] font-bold text-[#F45D76]">Internship</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8B0BE]">Time</p>
                  <p className="text-[13px] font-bold text-[#F45D76]">Ongoing</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Save NASA opportunity"
                onClick={() =>
                  showToast({
                    variant: savedColleges.includes("sat01") ? "info" : "success",
                    title: savedColleges.includes("sat01") ? "Removed from saved" : "Saved",
                    description: "NASA Fellowship & Internship",
                  })
                }
                className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F0EA] text-[#A8B0BE] transition hover:bg-[#EEF1FF] hover:text-[#3159C9]"
              >
                <Bookmark className="h-[17px] w-[17px]" />
              </button>
            </div>
          </article>
        </div>

        {/* filter chips */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition",
                chip === c ? "bg-[#EEF1FF] text-[#3159C9]" : "bg-white text-[#55637B] ring-1 ring-[#EFE9E2] hover:bg-[#F5F3ED]",
              )}
            >
              <Bookmark className="h-3.5 w-3.5" /> {c}
            </button>
          ))}
        </div>

        {/* saved list */}
        <div className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#EFE9E2]">
          <div className="grid grid-cols-[1fr_150px_1fr_44px] items-center gap-3 border-b border-[#EEE9E2] px-6 py-4 text-[12px] font-bold uppercase tracking-[0.12em] text-[#A8B0BE]">
            <span>Opportunity</span>
            <span>Category</span>
            <span>Organization</span>
            <span />
          </div>
          <div className="divide-y divide-[#EEE9E2]">
            {rows.length === 0 ? (
              <p className="px-6 py-10 text-center text-[14px] text-[#A8B0BE]">
                Nothing saved in {String(chip).toLowerCase()} yet.
              </p>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => showToast({ variant: "info", title: r.title, description: `Open from ${r.org}.` })}
                  className="grid w-full grid-cols-[1fr_150px_1fr_44px] items-center gap-3 px-6 py-[15px] text-left transition hover:bg-[#FAF9F6]"
                >
                  <span className="truncate text-[15px] font-semibold">{r.title}</span>
                  <span className={cn("grid w-fit place-items-center rounded-full px-3 py-1 text-[12px] font-bold", r.catClass)}>
                    {r.cat}
                  </span>
                  <span className="truncate text-[15px] text-[#55637B]">{r.org}</span>
                  <span aria-hidden className="justify-self-end text-[#A8B0BE]">
                    <Link2Icon />
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-end border-t border-[#EEE9E2] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                showToast({ variant: "info", title: "Suggest an opportunity", description: "Share something great with the community." })
              }
              className="rounded-full"
            >
              Suggest an opportunity
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Link2Icon() {
  return <Eye className="h-[17px] w-[17px]" />;
}
