"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/AppContext";
import { NAV } from "@/components/admin/nav";
import type { SectionKey } from "@/components/admin/types";
import {
  AnalyticsSection,
  AuditSection,
  BannersSection,
  BlogsSection,
  CollegesSection,
  CounsellorsSection,
  CoursesSection,
  DashboardSection,
  ExamsSection,
  FaqsSection,
  LeadsSection,
  MediaSection,
  MockTestsSection,
  NotificationsSection,
  QuestionsSection,
  ReviewsSection,
  ScholarshipsSection,
  SeoSection,
  SettingsSection,
  StudentsSection,
} from "@/components/admin/sections";

/**
 * Admin console shell: sidebar navigation plus a section switch.
 *
 * Each panel lives in its own module under `admin/sections/`, and the shared
 * presentational pieces are in `admin/primitives.tsx`. This file previously held
 * all 20 panels inline (1279 lines).
 */
export function AdminDashboard() {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const { enquiries, profile } = useApp();

  const leads = useMemo(
    () =>
      enquiries.map((e) => ({
        id: e.id,
        name: e.name,
        mobile: e.mobile,
        course: e.course,
        state: e.state || "—",
        status: e.status,
      })),
    [enquiries],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple">Admin Console</Badge>
            <Badge variant="gray">Synced 2 min ago</Badge>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Padhaanewala Admin
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as{" "}
            <span className="font-semibold text-slate-700">{profile?.name || "Super Admin"}</span> ·
            full platform control
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800"
        >
          View site <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-xs font-bold text-slate-500">ADMIN NAVIGATION</span>
              <Badge variant="purple">{NAV.length} modules</Badge>
            </div>
            <nav className="flex overflow-x-auto p-2 no-scrollbar lg:max-h-[calc(100vh-12rem)] lg:flex-col lg:overflow-y-auto lg:scroll-thin">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                const badge =
                  item.key === "leads"
                    ? leads.length                      : undefined;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                        : "text-slate-600 hover:bg-purple-50",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" /> {item.label}
                    </span>
                    {badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          active ? "bg-white/20 text-white" : "bg-purple-50 text-purple-600",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {section === "dashboard" && <DashboardSection go={setSection} />}
          {section === "analytics" && <AnalyticsSection />}
          {section === "colleges" && <CollegesSection />}
          {section === "courses" && <CoursesSection />}
          {section === "scholarships" && <ScholarshipsSection />}
          {section === "exams" && <ExamsSection />}
          {section === "mocktests" && <MockTestsSection />}
          {section === "questions" && <QuestionsSection />}
          {section === "students" && <StudentsSection />}
          {section === "reviews" && <ReviewsSection />}
          {section === "blogs" && <BlogsSection />}
          {section === "faqs" && <FaqsSection />}
          {section === "banners" && <BannersSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "leads" && <LeadsSection />}
          {section === "counsellors" && <CounsellorsSection />}
          {section === "media" && <MediaSection />}
          {section === "seo" && <SeoSection />}
          {section === "settings" && <SettingsSection />}
          {section === "audit" && <AuditSection />}
        </main>
      </div>
    </div>
  );
}
