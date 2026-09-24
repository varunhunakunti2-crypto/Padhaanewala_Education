"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Award,
  CalendarDays,
  FileQuestion,
  ListChecks,
  Users,
  Star,
  Newspaper,
  HelpCircle,
  Image,
  Bell,
  Users2,
  Headset,
  Images as MediaIcon,
  Settings,
  ScrollText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ShieldAlert,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Activity,
  Clock,
  Send,
  Download,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  MapPin,
  Smartphone,
  Monitor,
  UserCheck,
} from "lucide-react";
import { cn, formatCount, formatINR, initialsOf } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { COLLEGES } from "@/lib/data";
import { COURSES } from "@/lib/data/courses";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import { EXAMS } from "@/lib/data/exams";
import { MOCK_TESTS } from "@/lib/data/mockTests";
import { BLOG_POSTS } from "@/lib/data/blog";
import { useApp } from "@/lib/context/AppContext";
import { useCatalogStats } from "@/lib/useStats";

type SectionKey =
  | "dashboard"
  | "colleges"
  | "courses"
  | "scholarships"
  | "exams"
  | "mocktests"
  | "questions"
  | "students"
  | "reviews"
  | "blogs"
  | "faqs"
  | "banners"
  | "notifications"
  | "leads"
  | "counsellors"
  | "media"
  | "seo"
  | "settings"
  | "audit"
  | "analytics";

const NAV: { key: SectionKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "colleges", label: "Colleges", icon: Building2 },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "scholarships", label: "Scholarships", icon: Award },
  { key: "exams", label: "Exams", icon: CalendarDays },
  { key: "mocktests", label: "Mock Tests", icon: FileQuestion },
  { key: "questions", label: "Questions", icon: ListChecks },
  { key: "students", label: "Students", icon: Users },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "blogs", label: "Blogs", icon: Newspaper },
  { key: "faqs", label: "FAQs", icon: HelpCircle },
  { key: "banners", label: "Banners", icon: Image },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "leads", label: "Leads", icon: Users2 },
  { key: "counsellors", label: "Counsellors", icon: Headset },
  { key: "media", label: "Media", icon: MediaIcon },
  { key: "seo", label: "SEO", icon: TrendingUp },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
];

const SAMPLE_STUDENTS = [
  { id: "s1", name: "Rahul Sharma", mobile: "98765 43210", state: "Maharashtra", course: "B.Tech CSE", status: "Active" },
  { id: "s2", name: "Priya Menon", mobile: "99887 76655", state: "Tamil Nadu", course: "B.Sc Nursing", status: "Active" },
  { id: "s3", name: "Arjun Bose", mobile: "91234 56780", state: "West Bengal", course: "MBA", status: "Inactive" },
  { id: "s4", name: "Sneha Iyer", mobile: "97654 32100", state: "Karnataka", course: "B.Pharm", status: "Active" },
  { id: "s5", name: "Rohit Verma", mobile: "98675 43210", state: "Rajasthan", course: "B.Tech CSE", status: "Lead" },
] as const;

const SAMPLE_COUNSELLORS = [
  { id: "c1", name: "Anita Sharma", region: "North India", leads: 142, converted: 61, rating: 4.8 },
  { id: "c2", name: "Ravi Kumar", region: "South India", leads: 128, converted: 54, rating: 4.6 },
  { id: "c3", name: "Meera Pillai", region: "West India", leads: 156, converted: 70, rating: 4.9 },
  { id: "c4", name: "Karan Mehta", region: "East India", leads: 98, converted: 40, rating: 4.4 },
] as const;

const SAMPLE_QUESTIONS = [
  { id: "q1", test: "JEE Main Physics", text: "The SI unit of force is:", type: "MCQ", difficulty: "Easy", topic: "Mechanics" },
  { id: "q2", test: "NEET Biology", text: "DNA replication occurs in which phase?", type: "MCQ", difficulty: "Medium", topic: "Genetics" },
  { id: "q3", test: "CAT Reasoning", text: "Which number follows: 2, 6, 12, 20, ?", type: "MCQ", difficulty: "Hard", topic: "Analogy" },
  { id: "q4", test: "MHT-CET Chemistry", text: "The pH of a 0.001 M HCl solution is:", type: "MCQ", difficulty: "Easy", topic: "Physical Chemistry" },
] as const;

const AUDIT_LOGS = [
  { id: "a1", action: "College updated", actor: "admin@padhaa", time: "2 min ago" },
  { id: "a2", action: "Blog published — NEET eligibility", actor: "editor@padhaa", time: "1 hr ago" },
  { id: "a3", action: "Scholarship deadline changed", actor: "admin@padhaa", time: "3 hrs ago" },
  { id: "a4", action: "User lead converted", actor: "counsellor.anita", time: "5 hrs ago" },
  { id: "a5", action: "Banner CTA updated", actor: "support@padhaa", time: "1 day ago" },
  { id: "a6", action: "Exam result synced", actor: "system", time: "1 day ago" },
];

const STAT_ICONS = { up: TrendingUp, down: TrendingDown };

type CourseMetaLevel = "UG" | "PG" | "Doctoral" | "Diploma";
const LEVELS: readonly CourseMetaLevel[] = ["UG", "PG", "Doctoral", "Diploma"];

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
          <h1 className="mt-2 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">Padhaanewala Admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{profile?.name || "Super Admin"}</span> · full platform control
          </p>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
          View site <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
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
                const badge = item.key === "leads" ? leads.length : item.key === "students" ? SAMPLE_STUDENTS.length : undefined;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30" : "text-slate-600 hover:bg-purple-50",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" /> {item.label}
                    </span>
                    {badge !== undefined && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", active ? "bg-white/20 text-white" : "bg-purple-50 text-purple-600")}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
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

/* ---------------------------------- Shared building blocks ---------------------------------- */

function StatCard({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  const Icon = up ? STAT_ICONS.up : STAT_ICONS.down;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-extrabold text-gray-900">{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", up ? "text-green-600" : "text-red-500")}>
          <Icon className="h-3.5 w-3.5" /> {delta}
        </p>
      )}
    </div>
  );
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-bold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SectionHeading({ title, description, count, action }: { title: string; description?: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-extrabold text-gray-900">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{count.toLocaleString("en-IN")}</span>
          )}
        </div>
        {description && <p className="mt-0.5 max-w-xl text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  const { showToast } = useApp();
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => showToast({ title: `New ${label}`, description: "Create flow is a demo action in this build.", variant: "info" })}
    >
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}

function IconAction({ title, onClick, className, children }: { title: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
        className,
      )}
    >
      {children}
    </button>
  );
}

function RowActions({ item, noun }: { item: string; noun: string }) {
  const { showToast } = useApp();
  const act = (label: string) =>
    showToast({ title: `${label} ${noun}`, description: `“${item}” — demo action in this build.`, variant: "info" });
  return (
    <div className="flex items-center justify-end gap-1">
      <IconAction title={`View ${noun}`} onClick={() => act("View")}>
        <Eye className="h-4 w-4" />
      </IconAction>
      <IconAction title={`Edit ${noun}`} onClick={() => act("Edit")}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      <IconAction title={`Delete ${noun}`} onClick={() => act("Delete")} className="hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </div>
  );
}

function FilterChips<T extends string>({ options, value, onChange, counts }: {
  options: readonly T[];
  value: T | "all";
  onChange: (v: T | "all") => void;
  counts?: Partial<Record<T | "all", number>>;
}) {
  const render = (label: T | "all") => {
    const active = value === label;
    const labelText = label === "all" ? "All" : label.charAt(0).toUpperCase() + label.slice(1);
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(label)}
        aria-pressed={active}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
          active ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
      >
        {labelText}
        {counts && counts[label] !== undefined ? ` · ${counts[label]}` : ""}
      </button>
    );
  };
  return <div className="flex flex-wrap gap-2">{render("all")}{options.map(render)}</div>;
}

function ProgressBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-xs font-semibold text-slate-500">{value}{suffix ?? "%"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-700 to-indigo-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function BadgeForStatus(status: string) {
  if (status === "Active" || status === "Approved" || status === "converted" || status === "Contacted") return "green";
  if (status === "Pending" || status === "new" || status === "contacted") return status === "contacted" ? "blue" : "yellow";
  if (status === "Lead") return "yellow";
  return "gray";
}

/* ---------------------------------- Dashboard ---------------------------------- */

function DashboardSection({ go }: { go: (s: SectionKey) => void }) {
  const { enquiries, testHistory } = useApp();
  const stats = useCatalogStats({
    colleges: COLLEGES.length,
    courses: COURSES.length,
    exams: EXAMS.length,
    scholarships: SCHOLARSHIPS.length,
    mockTests: MOCK_TESTS.length,
    blogs: BLOG_POSTS.length,
  });
  const mockTestsTaken = stats.ok ? stats.mockTests + testHistory.length : testHistory.length + 42;

  const [upcoming, setUpcoming] = useState<{ name: string; deadline: string; daysLeft: number }[]>([]);

  useEffect(() => {
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUpcoming(
      SCHOLARSHIPS.map((s) => ({ name: s.name, deadline: s.deadline, daysLeft: Math.ceil((new Date(s.deadline).getTime() - now) / 86400000) }))
        .filter((d) => d.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 4),
    );
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total colleges" value={String(stats.colleges)} delta="+2 this month" up />
        <StatCard label="Registered students" value="12,480" delta="+360 this week" up />
        <StatCard label="Admission leads" value={String(enquiries.length)} delta="+18 this week" up />
        <StatCard label="Mock tests taken" value={String(mockTestsTaken)} delta="+12 this week" up />
      </div>

      <Panel title="Quick actions" description="Jump straight into frequently used workflows">
        <div className="flex flex-wrap gap-2.5">
          <Button type="button" size="sm" variant="secondary" onClick={() => go("colleges")}>
            <Building2 className="h-4 w-4" /> Manage colleges
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => go("leads")}>
            <Users2 className="h-4 w-4" /> Open leads
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => go("notifications")}>
            <Send className="h-4 w-4" /> Compose notification
          </Button>
          <ButtonLink size="sm" href="/" variant="secondary">
            <ArrowUpRight className="h-4 w-4" /> View live site
          </ButtonLink>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Recent leads" description="Latest admission enquiries">
          {enquiries.length ? (
            <div className="space-y-3">
              {enquiries.slice(0, 5).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.course} · {e.state || "—"} · {e.mobile}</p>
                  </div>
                  <Badge variant={BadgeForStatus(e.status)}>{e.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No student enquiries yet. They will appear here when students use the admission form.</p>
          )}
        </Panel>

        <Panel title="Upcoming scholarship deadlines" description="Next to expire">
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                      <p className="text-xs text-slate-400">Closes {d.deadline}</p>
                    </div>
                  </div>
                  <Badge variant={d.daysLeft <= 7 ? "red" : "yellow"}>{d.daysLeft} days left</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No upcoming deadlines in the scholarship calendar.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Top colleges by views" description="Ranked by profile interest">
          <div className="space-y-3">
            {[...COLLEGES]
              .sort((a, b) => b.reviewCount - a.reviewCount)
              .slice(0, 5)
              .map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold",
                    i === 0 ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600",
                  )}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.shortName}</p>
                    <p className="text-xs text-slate-400">{c.city}, {c.state}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{formatCount(c.reviewCount)} views</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="System status" description="Platform health at a glance">
          <div className="space-y-3">
            {[
              { label: "REST API", detail: stats.ok ? "healthy" : "using local fallback data", ok: stats.ok },
              { label: "PostgreSQL", detail: "connectivity verified", ok: true },
              { label: "Redis cache", detail: "degraded — running in memory", ok: false },
              { label: "Rate limiting", detail: "enabled · 5 req/min per auth route" as string, ok: true },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", s.ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                    {s.ok ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.detail}</p>
                  </div>
                </div>
                <Badge variant={s.ok ? "green" : "yellow"}>{s.ok ? "Healthy" : "Degraded"}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------- Analytics ---------------------------------- */

function AnalyticsSection() {
  const series = [42, 48, 44, 58, 66, 72, 68, 82, 91, 104, 118, 132];
  const max = Math.max(...series);
  const states = [
    { name: "Maharashtra", views: "33.2K", pct: 18 },
    { name: "Uttar Pradesh", views: "28.7K", pct: 16 },
    { name: "Karnataka", views: "21.4K", pct: 12 },
    { name: "Tamil Nadu", views: "18.9K", pct: 11 },
    { name: "Rajasthan", views: "15.3K", pct: 9 },
  ];
  const funnel = [
    { label: "Page visitors", value: "184.2K" },
    { label: "Enquiries", value: "11.4K" },
    { label: "Qualified leads", value: "6.1K" },
    { label: "Admissions", value: "3.2K" },
  ];
  const devices = [
    { label: "Mobile", icon: Smartphone, pct: 68 },
    { label: "Desktop", icon: Monitor, pct: 27 },
    { label: "Tablet", icon: Smartphone, pct: 5 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Page views" value="184.2K" delta="+12.4%" up />
        <StatCard label="Unique visitors" value="41.8K" delta="+8.1%" up />
        <StatCard label="Enquiry conversion" value="6.2%" delta="-0.4%" />
        <StatCard label="Avg. session" value="4m 32s" delta="+14s" up />
      </div>

      <Panel title="Monthly traffic (last 12 months)" description="Unique visits in thousands">
        <div className="flex items-end gap-2">
          {series.map((v, i) => (
            <div key={i} className="flex-1">
              <div className="flex h-44 items-end rounded-lg bg-slate-50 p-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-purple-700 to-indigo-500 hover:from-purple-800 focus-visible:outline-2 focus-visible:outline-purple-500"
                  style={{ height: `${(v / max) * 100}%` }}
                  title={`${v / 1000}K views`}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-400">{i + 1}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Traffic by state" description="Top 5 regions">
          <div className="space-y-4">
            {states.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{s.name}</span>
                    <span className="text-xs font-semibold text-slate-500">{s.views}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-purple-600" style={{ width: `${s.pct * 3.5}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-5">
          <Panel title="Conversion funnel" description="Visitor → admission">
            <div className="space-y-2">
              {funnel.map((f, i) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-medium text-gray-700">{f.label}</span>
                  <div className="flex h-8 flex-1 items-center overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className={cn("h-full rounded-lg transition-all", i === 0 ? "bg-purple-600/30" : i === 1 ? "bg-purple-600/50" : i === 2 ? "bg-purple-600/70" : "bg-purple-600")}
                      style={{ width: `${[100, 62, 33, 17][i]}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-bold text-gray-900">{f.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Devices" description="Share of sessions">
            <div className="space-y-4">
              {devices.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600">
                    <d.icon className="h-4 w-4" />
                  </span>
                  <ProgressBar label={d.label} value={d.pct} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Catalog sections ---------------------------------- */

function CollegesSection() {
  const [sector, setSector] = useState<"Government" | "Private" | "all">("all");
  const rows = sector === "all" ? COLLEGES : COLLEGES.filter((c) => c.sector === sector);
  return (
    <div>
      <SectionHeading title="Colleges" description="Manage institution profiles, ratings and placement data" count={rows.length} action={<AddButton label="Add college" />} />
      <div className="mb-4">
        <FilterChips
          options={["Government", "Private"] as const}
          value={sector}
          onChange={setSector}
          counts={{ Government: COLLEGES.filter((c) => c.sector === "Government").length, Private: COLLEGES.filter((c) => c.sector === "Private").length } as Partial<Record<"Government" | "Private" | "all", number>>}
        />
      </div>
      <DataTable
          columns={[
            { key: "shortName", header: "College", render: (c) => <span className="font-semibold text-gray-900">{c.shortName}</span> },
            { key: "city", header: "Location", render: (c) => `${c.city}, ${c.state}` },
            { key: "sector", header: "Type", render: (c) => <Badge variant={c.sector === "Government" ? "blue" : "orange"}>{c.sector}</Badge> },
            { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
            { key: "placementRate", header: "Placement", render: (c) => `${c.placement.placementRate}%` },
            { key: "reviewCount", header: "Reviews", render: (c) => formatCount(c.reviewCount) },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.shortName} noun="college" /> },
          ]}
          rows={rows}
          searchKeys={["name", "shortName", "city", "state"]}
          searchPlaceholder="Search colleges..."
        />
    </div>
  );
}

function CoursesSection() {
  const [level, setLevel] = useState<CourseMetaLevel | "all">("all");
  const rows = level === "all" ? COURSES.map((c) => ({ ...c, id: c.slug })) : COURSES.filter((c) => c.level === level).map((c) => ({ ...c, id: c.slug }));
  const counts = useMemo(() => {
    const by: Partial<Record<CourseMetaLevel, number>> = {};
    for (const c of COURSES) by[c.level] = (by[c.level] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Courses" description="Manage the degree & diploma catalog" count={COURSES.length} action={<AddButton label="Add course" />} />
      <div className="mb-4">
        <FilterChips options={LEVELS} value={level} onChange={setLevel} counts={{ ...counts } as Partial<Record<CourseMetaLevel | "all", number>>} />
      </div>
      <DataTable
          columns={[
            { key: "name", header: "Course", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
            { key: "level", header: "Level", render: (c) => <Badge variant="purple">{c.level}</Badge> },
            { key: "duration", header: "Duration" },
            { key: "avgFeeYear", header: "Avg. Fees", render: (c) => formatINR(c.avgFeeYear) },
            { key: "hot", header: "Status", render: (c) => (c.hot ? <Badge variant="green">Hot</Badge> : <Badge variant="gray">Standard</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="course" /> },
          ]}
          rows={rows}
          searchKeys={["name"]}
          searchPlaceholder="Search courses..."
        />
    </div>
  );
}

function ScholarshipsSection() {
  const [filter, setFilter] = useState<"Yes" | "No" | "all">("all");
  const all = SCHOLARSHIPS.map((s) => ({ ...s, id: s.name }));
  const rows = filter === "all" ? all : all.filter((s) => (s.renewable === (filter === "Yes")));
  return (
    <div>
      <SectionHeading title="Scholarships" description="Administer schemes, amounts and deadlines" count={SCHOLARSHIPS.length} action={<AddButton label="Add scholarship" />} />
      <div className="mb-4">
        <FilterChips
          options={["Yes", "No"] as const}
          value={filter}
          onChange={setFilter}
          counts={{ Yes: SCHOLARSHIPS.filter((s) => s.renewable).length, No: SCHOLARSHIPS.filter((s) => !s.renewable).length } as Partial<Record<"Yes" | "No" | "all", number>>}
        />
      </div>
      <DataTable
          columns={[
            { key: "name", header: "Scholarship", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
            { key: "provider", header: "Provider" },
            { key: "amount", header: "Amount", render: (s) => <span className="font-semibold text-green-600">{s.amount}</span> },
            { key: "deadline", header: "Deadline" },
            { key: "renewable", header: "Renewable", render: (s) => (s.renewable ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (s) => <RowActions item={s.name} noun="scholarship" /> },
          ]}
          rows={rows}
          searchKeys={["name", "provider"]}
          searchPlaceholder="Search scholarships..."
        />
    </div>
  );
}

const EXAM_TYPES = Array.from(new Set(EXAMS.map((e) => e.type))).sort() as string[];

function ExamsSection() {
  const [type, setType] = useState<string | "all">("all");
  const all = EXAMS.map((e) => ({ ...e, id: e.slug }));
  const rows = type === "all" ? all : all.filter((e) => e.type === type);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const e of EXAMS) by[e.type] = (by[e.type] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Examinations" description="Manage entrance exams, stages and dates" count={EXAMS.length} action={<AddButton label="Add exam" />} />
      <div className="mb-4">
        <FilterChips options={EXAM_TYPES as readonly string[]} value={type} onChange={setType} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "shortName", header: "Exam", render: (e) => <Link href={`/exams/${e.slug}`} className="font-semibold text-purple-700 hover:underline">{e.shortName}</Link> },
            { key: "type", header: "Type" },
            { key: "level", header: "Level" },
            { key: "stage", header: "Stage", render: (e) => <Badge variant={e.stage === "Registration Open" ? "green" : e.stage === "Results Declared" ? "gray" : "yellow"}>{e.stage}</Badge> },
            { key: "duration", header: "Duration" },
            { key: "actions", header: "", className: "text-right", render: (e) => <RowActions item={e.shortName} noun="exam" /> },
          ]}
          rows={rows}
          searchKeys={["name", "shortName"]}
          searchPlaceholder="Search exams..."
        />
    </div>
  );
}

function MockTestsSection() {
  const [difficulty, setDifficulty] = useState<string | "all">("all");
  const all = MOCK_TESTS.map((t) => ({ ...t, id: t.slug }));
  const rows = difficulty === "all" ? all : all.filter((t) => t.difficulty === difficulty);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const t of MOCK_TESTS) by[t.difficulty] = (by[t.difficulty] ?? 0) + 1;
    return by;
  }, []);
  return (
    <div>
      <SectionHeading title="Mock test library" description="Publish and manage practice tests" count={MOCK_TESTS.length} action={<AddButton label="Add test" />} />
      <div className="mb-4">
        <FilterChips options={Object.keys(counts) as readonly string[]} value={difficulty} onChange={setDifficulty} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "title", header: "Test", render: (t) => <span className="font-semibold text-gray-900">{t.title}</span> },
            { key: "exam", header: "Exam", render: (t) => <Badge variant="purple">{t.exam}</Badge> },
            { key: "difficulty", header: "Difficulty", render: (t) => <Badge variant={t.difficulty === "Easy" ? "green" : t.difficulty === "Medium" ? "yellow" : "red"}>{t.difficulty}</Badge> },
            { key: "questionCount", header: "Questions" },
            { key: "attempts", header: "Attempts", render: (t) => formatCount(t.attempts) },
            { key: "actions", header: "", className: "text-right", render: (t) => <RowActions item={t.title} noun="test" /> },
          ]}
          rows={rows}
          searchKeys={["title", "exam"]}
          searchPlaceholder="Search tests..."
        />
    </div>
  );
}

function QuestionsSection() {
  const [difficulty, setDifficulty] = useState<string | "all">("all");
  const all = SAMPLE_QUESTIONS as unknown as { id: string; test: string; text: string; type: string; difficulty: string; topic: string }[];
  const rows = difficulty === "all" ? all : all.filter((q) => q.difficulty === difficulty);
  return (
    <div>
      <SectionHeading title="Question bank" description="Curate questions across all mock tests" count={all.length} action={<AddButton label="Add question" />} />
      <div className="mb-4">
        <FilterChips options={["Easy", "Medium", "Hard"] as const} value={difficulty} onChange={setDifficulty} />
      </div>
      <DataTable
          columns={[
            { key: "test", header: "Test" },
            { key: "text", header: "Question" },
            { key: "type", header: "Type" },
            { key: "difficulty", header: "Difficulty", render: (q) => <Badge variant={q.difficulty === "Easy" ? "green" : q.difficulty === "Medium" ? "yellow" : "red"}>{q.difficulty}</Badge> },
            { key: "topic", header: "Topic" },
            { key: "actions", header: "", className: "text-right", render: (q) => <RowActions item={q.text.replace(/[?.]/g, "")} noun="question" /> },
          ]}
          rows={rows}
          searchKeys={["text", "test", "topic"]}
          searchPlaceholder="Search questions..."
        />
    </div>
  );
}

/* ---------------------------------- People sections ---------------------------------- */

type StudentRow = { id: string; name: string; mobile: string; state: string; course: string; status: string };

function StudentsSection() {
  const [status, setStatus] = useState<string | "all">("all");
  const [rows, setRows] = useState<StudentRow[]>(SAMPLE_STUDENTS.map((s) => ({ ...s })));
  const toggle = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: r.status === "Active" ? "Inactive" : r.status === "Lead" ? "Active" : "Active" } : r)));
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [rows]);
  const filtered = status === "all" ? rows : rows.filter((r) => r.status === status);
  return (
    <div>
      <SectionHeading title="Registered students" description="All student accounts across the platform" count={rows.length} action={<AddButton label="Invite student" />} />
      <div className="mb-4">
        <FilterChips options={["Active", "Inactive", "Lead"] as const} value={status} onChange={setStatus} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "name", header: "Student", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
            { key: "mobile", header: "Mobile" },
            { key: "state", header: "State" },
            { key: "course", header: "Course" },
            { key: "status", header: "Status", render: (s) => <Badge variant={BadgeForStatus(s.status)}>{s.status}</Badge> },
            { key: "actions", header: "", className: "text-right", render: (s) => (
              <div className="flex items-center justify-end gap-1">
                <IconAction
                  title={s.status === "Active" ? "Deactivate account" : "Activate account"}
                  onClick={() => toggle(s.id)}
                  className="hover:bg-purple-50 hover:text-purple-700"
                >
                  {s.status === "Active" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </IconAction>
                <RowActions item={s.name} noun="student" />
              </div>
            ) },
          ]}
          rows={filtered}
          searchKeys={["name", "mobile", "course"]}
          searchPlaceholder="Search students..."
        />
    </div>
  );
}

function ReviewsSection() {
  const { reviews } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const all = useMemo(() => {
    const base = reviews.map((r, i) => ({ id: `u${i}`, author: r.author, program: r.program, rating: r.rating }));
    const seeded = COLLEGES.flatMap((c) => c.reviews.map((r) => ({ id: r.id, author: r.author, program: r.program, rating: r.rating })));
    return [...base, ...seeded].slice(0, 20).map((r) => ({ ...r, status: approvedIds.has(r.id) ? "Approved" : r.id.startsWith("u") ? "Pending" : "Approved" }));
  }, [reviews, approvedIds]);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of all) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [all]);
  const filtered = status === "all" ? all : all.filter((r) => r.status === status);
  return (
    <div>
      <SectionHeading title="Reviews" description="Moderate student reviews before publishing" count={all.length} action={<AddButton label="Request review" />} />
      <div className="mb-4">
        <FilterChips options={["Approved", "Pending"] as const} value={status} onChange={setStatus} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      <DataTable
          columns={[
            { key: "author", header: "Author", render: (r) => <span className="font-semibold text-gray-900">{r.author}</span> },
            { key: "program", header: "Program" },
            { key: "rating", header: "Rating", render: (r) => <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> <span className="font-semibold">{r.rating}</span></div> },
            { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Approved" ? "green" : "yellow"}>{r.status}</Badge> },
            { key: "actions", header: "", className: "text-right", render: (r) => (
              r.status === "Pending" ? (
                <Button type="button" size="xs" variant="secondary" onClick={() => setApprovedIds((prev) => new Set(prev).add(r.id))}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              ) : (
                <RowActions item={r.author} noun="review" />
              )
            ) },
          ]}
          rows={filtered}
          searchKeys={["author", "program"]}
          searchPlaceholder="Search reviews..."
        />
    </div>
  );
}

function BlogsSection() {
  const all = BLOG_POSTS.map((p) => ({ ...p, id: p.slug }));
  return (
    <div>
      <SectionHeading title="Published articles" description="Write, schedule and feature content" count={BLOG_POSTS.length} action={<AddButton label="New article" />} />
      <DataTable
          columns={[
            { key: "title", header: "Article", render: (p) => <span className="font-semibold text-gray-900">{p.title}</span> },
            { key: "category", header: "Category", render: (p) => <Badge variant="purple">{p.category}</Badge> },
            { key: "author", header: "Author" },
            { key: "readTime", header: "Read time" },
            { key: "featured", header: "Featured", render: (p) => (p.featured ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
            { key: "actions", header: "", className: "text-right", render: (p) => <RowActions item={p.title} noun="article" /> },
          ]}
          rows={all}
          searchKeys={["title", "author", "category"]}
          searchPlaceholder="Search articles..."
        />
    </div>
  );
}

function FaqsSection() {
  const faqs = COLLEGES.flatMap((c) => c.faqs.map((f) => ({ id: `${c.id}-${f.q.slice(0, 8)}`, college: c.shortName, q: f.q }))).slice(0, 10);
  return (
    <div>
      <SectionHeading title="FAQ management" description="Curate college-specific answers" count={faqs.length} action={<AddButton label="Add FAQ" />} />
      <DataTable
          columns={[
            { key: "college", header: "College" },
            { key: "q", header: "Question" },
            { key: "actions", header: "", className: "text-right", render: (f) => <RowActions item={f.q} noun="FAQ" /> },
          ]}
          rows={faqs as { id: string; college: string; q: string }[]}
          searchKeys={["q", "college"]}
          searchPlaceholder="Search FAQs..."
        />
    </div>
  );
}

const BANNERS_DEMO = ["Admission Open CTA", "Scholarship Alert", "College Predictor Promo"];

function BannersSection() {
  const [active, setActive] = useState<Set<string>>(new Set(BANNERS_DEMO));
  const { showToast } = useApp();
  const toggle = (b: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
    showToast({ title: `${active.has(b) ? "Deactivated" : "Activated"} ${b}`, description: "Banner visibility updated.", variant: "success" });
  };
  return (
    <div>
      <SectionHeading title="Homepage banners" description="Control which promotional banners are live" action={<AddButton label="Add banner" />} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {BANNERS_DEMO.map((b, i) => (
          <div key={b} className="rounded-2xl border border-slate-200 p-4">
            <div className={cn(
              "grid h-28 place-items-center rounded-xl text-white",
              i === 0 ? "bg-gradient-to-br from-purple-700 to-indigo-600" : i === 1 ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-blue-700 to-cyan-600",
            )}>
              <span className="text-sm font-bold">{b}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant={active.has(b) ? "green" : "gray"}>{active.has(b) ? "Active" : "Paused"}</Badge>
              <div className="flex gap-1.5">
                <Button type="button" size="xs" variant={active.has(b) ? "danger" : "secondary"} onClick={() => toggle(b)}>
                  {active.has(b) ? "Pause" : "Activate"}
                </Button>
                <IconAction title="Edit banner" onClick={() => showToast({ title: "Edit banner", description: "Demo action in this build.", variant: "info" })}>
                  <Pencil className="h-4 w-4" />
                </IconAction>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { notifications } = useApp();
  const rows = notifications.length
    ? notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, status: n.read ? "Read" : "Unread" }))
    : [{ id: "demo-1", title: "Welcome to Padhaanewala Admin", message: "Configure push notifications from here.", status: "Unread" }];
  return (
    <div>
      <SectionHeading title="Push notifications" description="Broadcast alerts to students" count={notifications.length} action={<AddButton label="Compose" />} />
      <DataTable
          columns={[
            { key: "title", header: "Title", render: (r) => <span className="font-semibold text-gray-900">{r.title}</span> },
            { key: "message", header: "Message" },
            { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Unread" ? "yellow" : "gray"}>{r.status}</Badge> },
            { key: "actions", header: "", className: "text-right", render: (r) => <RowActions item={r.title} noun="notification" /> },
          ]}
          rows={rows as { id: string; title: string; message: string; status: string }[]}
          searchKeys={["title", "message"]}
          searchPlaceholder="Search notifications..."
        />
    </div>
  );
}

function LeadsSection() {
  const { enquiries, showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [advance, setAdvance] = useState<Record<string, string>>({});
  const all = useMemo(
    () =>
      enquiries.map((e) => ({
        id: e.id,
        name: e.name,
        mobile: e.mobile,
        course: e.course,
        state: e.state || "—",
        status: advance[e.id] ?? e.status,
      })),
    [enquiries, advance],
  );
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const l of all) by[l.status] = (by[l.status] ?? 0) + 1;
    return by;
  }, [all]);
  const filtered = status === "all" ? all : all.filter((l) => l.status === status);
  const next = (s: string) => (s === "new" ? "contacted" : s === "contacted" ? "converted" : "converted");
  const advanceLead = (id: string, name: string) => {
    const from = advance[id] ?? enquiries.find((e) => e.id === id)?.status ?? "new";
    const to = next(from);
    setAdvance((prev) => ({ ...prev, [id]: to }));
    showToast({ title: `Lead ${from} → ${to}`, description: `${name} moved to ${to}.`, variant: "success" });
  };
  return (
    <div>
      <SectionHeading title="Admission leads" description="Track and convert incoming enquiries" count={all.length} action={<AddButton label="Import leads" />} />
      <div className="mb-4">
        <FilterChips options={["new", "contacted", "converted"] as const} value={status} onChange={setStatus} counts={{ ...counts } as Partial<Record<string, number>>} />
      </div>
      {all.length ? (
        <DataTable
            columns={[
              { key: "name", header: "Name", render: (e) => <span className="font-semibold text-gray-900">{e.name}</span> },
              { key: "mobile", header: "Mobile" },
              { key: "course", header: "Course" },
              { key: "state", header: "State" },
              { key: "status", header: "Status", render: (e) => <Badge variant={BadgeForStatus(e.status)}>{e.status}</Badge> },
              { key: "actions", header: "", className: "text-right", render: (e) => (
                <div className="flex items-center justify-end gap-1">
                  {e.status !== "converted" && (
                    <Button type="button" size="xs" variant="secondary" onClick={() => advanceLead(e.id, e.name)}>
                      <UserCheck className="h-3.5 w-3.5" /> {e.status === "new" ? "Contact" : "Convert"}
                    </Button>
                  )}
                  <IconAction title="View lead" onClick={() => showToast({ title: "View lead", description: `Full profile for ${e.name}.`, variant: "info" })}>
                    <Eye className="h-4 w-4" />
                  </IconAction>
                </div>
              ) },
            ]}
            rows={filtered}
            searchKeys={["name", "mobile", "course", "state"]}
            searchPlaceholder="Search leads..."
          />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">
            No leads yet. Enquiries from the &quot;Get Admission Help&quot; forms will appear here instantly.
          </p>
        </div>
      )}
    </div>
  );
}

function CounsellorsSection() {
  return (
    <div>
      <SectionHeading title="Counsellors" description="Track team performance and conversions" count={SAMPLE_COUNSELLORS.length} action={<AddButton label="Add counsellor" />} />
      <DataTable
          columns={[
            { key: "name", header: "Counsellor", render: (c) => (
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-50 text-xs font-bold text-purple-700">{initialsOf(c.name)}</span>
                <span className="font-semibold text-gray-900">{c.name}</span>
              </span>
            ) },
            { key: "region", header: "Region" },
            { key: "leads", header: "Leads" },
            { key: "converted", header: "Converted", render: (c) => <span className="font-semibold text-green-600">{c.converted}</span> },
            { key: "conversionRate", header: "Rate", render: (c) => `${Math.round((c.converted / c.leads) * 100)}%` },
            { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
            { key: "actions", header: "", className: "text-right", render: (c) => <RowActions item={c.name} noun="counsellor" /> },
          ]}
          rows={SAMPLE_COUNSELLORS as unknown as { id: string; name: string; region: string; leads: number; converted: number; rating: number }[]}
          searchKeys={["name", "region"]}
          searchPlaceholder="Search counsellors..."
        />
    </div>
  );
}

/* ---------------------------------- Content & ops sections ---------------------------------- */

function MediaSection() {
  const { showToast } = useApp();
  return (
    <div>
      <SectionHeading title="Media library" description="College logos, banners and campus imagery" action={<AddButton label="Upload" />} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {COLLEGES.slice(0, 8).map((c) => (
          <div key={c.id} className="group overflow-hidden rounded-xl border border-slate-100">
            <div className="grid h-24 place-items-center bg-gradient-to-br from-purple-700 to-indigo-600 text-white">
              <span className="text-sm font-bold">{c.initials}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-600">{c.shortName}</p>
              <IconAction
                title="Remove media"
                onClick={() => showToast({ title: "Remove media", description: `${c.shortName} asset removed from the library.`, variant: "info" })}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconAction>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeoSection() {
  const checks = [
    { label: "Title tags", score: 96 },
    { label: "Meta descriptions", score: 88 },
    { label: "Heading hierarchy", score: 100 },
    { label: "Image alt text", score: 74 },
    { label: "Structured data", score: 92 },
    { label: "Canonical URLs", score: 85 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Crawl errors" value="0" />
        <StatCard label="Indexed pages" value="142" delta="+6" up />
        <StatCard label="Backlinks" value="1.2K" delta="+4.2%" up />
        <StatCard label="Avg. Core Web Vitals" value="0.9s" delta="Pass" up />
      </div>
      <Panel title="On-page SEO score" description="Automated checks across the site">
        <div className="space-y-4">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              {c.score >= 90 ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <span className="text-base leading-none text-amber-500">⚠</span>
              )}
              <div className="min-w-0 flex-1">
                <ProgressBar label={c.label} value={c.score} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Sitemap & robots" description="Live crawl endpoints">
        <div className="space-y-3 text-sm">
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="font-medium text-gray-700">robots.txt</span> <Badge variant="green">Live</Badge>
          </p>
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="font-medium text-gray-700">sitemap.xml</span> <Badge variant="green">Live ({16 + 14} URLs)</Badge>
          </p>
        </div>
      </Panel>
    </div>
  );
}

function SettingsSection() {
  const { showToast } = useApp();
  const fields = [
    { label: "Site name", defaultValue: "padhaanewala" },
    { label: "Support email", defaultValue: "support@padhaanewala.com" },
    { label: "Contact phone", defaultValue: "+91 98765 43210" },
    { label: "Counselling hours", defaultValue: "Mon–Sat, 9 AM – 8 PM" },
  ];
  return (
    <div className="space-y-5">
      <SectionHeading title="Site settings" description="Platform-wide configuration" action={<Button type="button" size="sm" onClick={() => showToast({ title: "Settings saved", description: "Configuration updated.", variant: "success" })}><CheckCircle2 className="h-4 w-4" /> Save changes</Button>} />
      <Panel title="Brand & contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <Label>{f.label}</Label>
              <Input defaultValue={f.defaultValue} aria-label={f.label} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Preferences">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Default timezone</Label>
            <Select defaultValue="Asia/Kolkata" aria-label="Default timezone">
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
            </Select>
          </div>
          <div>
            <Label>Number formatting</Label>
            <Select defaultValue="Indian (₹, lakh)" aria-label="Number formatting">
              <option value="Indian (₹, lakh)">Indian (₹, lakh)</option>
              <option value="International ($, K)">International ($, K)</option>
            </Select>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AuditSection() {
  const [actor, setActor] = useState<string | "all">("all");
  const actors = Array.from(new Set(AUDIT_LOGS.map((l) => l.actor))).sort();
  const rows = actor === "all" ? AUDIT_LOGS : AUDIT_LOGS.filter((l) => l.actor === actor);
  const { showToast } = useApp();
  return (
    <div>
      <SectionHeading
        title="Audit logs"
        description="Every admin action, tracked"
        count={AUDIT_LOGS.length}
        action={<Button type="button" size="sm" variant="secondary" onClick={() => showToast({ title: "Export initiated", description: "Audit log export will download shortly.", variant: "info" })}><Download className="h-4 w-4" /> Export</Button>}
      />
      <div className="mb-4">
        <FilterChips options={actors as readonly string[]} value={actor} onChange={setActor} counts={{ ...AUDIT_LOGS.reduce<Record<string, number>>((acc, l) => { acc[l.actor] = (acc[l.actor] ?? 0) + 1; return acc; }, {}) } as Partial<Record<string, number>>} />
      </div>
      <div className="space-y-3">
          {rows.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{l.action}</p>
                <p className="text-xs text-slate-400">by {l.actor}</p>
              </div>
              <span className="text-xs text-slate-400">{l.time}</span>
            </div>
          ))}
        </div>
    </div>
  );
}