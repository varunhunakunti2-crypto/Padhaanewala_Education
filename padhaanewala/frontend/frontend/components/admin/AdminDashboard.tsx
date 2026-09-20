"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { cn, formatCount, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
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

const STAT_ICONS = { up: TrendingUp, down: TrendingDown };

export function AdminDashboard() {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const { enquiries } = useApp();

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Badge variant="purple">Admin Console</Badge>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">Padhaanewala Admin</h1>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
          View site <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-60 lg:shrink-0">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white lg:sticky lg:top-24">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
              ADMIN NAVIGATION
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
                      active ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-purple-50",
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
          {section === "dashboard" && <DashboardSection />}
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

function StatCard({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  const Icon = up ? STAT_ICONS.up : STAT_ICONS.down;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
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

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DashboardSection() {
  const { enquiries, testHistory } = useApp();
  const stats = useCatalogStats({
    colleges: COLLEGES.length,
    courses: COURSES.length,
    exams: EXAMS.length,
    scholarships: SCHOLARSHIPS.length,
    mockTests: MOCK_TESTS.length,
    blogs: BLOG_POSTS.length,
  });
  const mockTestsTaken = stats.ok
    ? stats.mockTests + testHistory.length
    : testHistory.length + 42;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total colleges" value={String(stats.colleges)} delta="+2 this month" up />
        <StatCard label="Registered students" value="12,480" delta="+360 this week" up />
        <StatCard label="Admission leads" value={String(enquiries.length)} delta="+18 this week" up />
        <StatCard label="Mock tests taken" value={String(mockTestsTaken)} delta="+12 this week" up />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Recent leads">
          {enquiries.length ? (
            <div className="space-y-3">
              {enquiries.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.course} · {e.state || "—"} · {e.mobile}</p>
                  </div>
                  <Badge variant="green">{e.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No student enquiries yet. They will appear here when students use the admission form.</p>
          )}
        </Panel>
        <Panel title="Top colleges by views">
          <div className="space-y-3">
            {[...COLLEGES]
              .sort((a, b) => b.reviewCount - a.reviewCount)
              .slice(0, 5)
              .map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-xs font-bold text-purple-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.shortName}</p>
                    <p className="text-xs text-slate-400">{c.city}, {c.state}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{formatCount(c.reviewCount)} views</span>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AnalyticsSection() {
  const series = [42, 48, 44, 58, 66, 72, 68, 82, 91, 104, 118, 132];
  const max = Math.max(...series);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Page views" value="184.2K" delta="+12.4%" up />
        <StatCard label="Unique visitors" value="41.8K" delta="+8.1%" up />
        <StatCard label="Enquiry conversion" value="6.2%" delta="-0.4%" />
        <StatCard label="Avg. session" value="4m 32s" delta="+14s" up />
      </div>
      <Panel title="Monthly traffic (last 12 months)">
        <div className="flex items-end gap-2">
          {series.map((v, i) => (
            <div key={i} className="flex-1">
              <div className="flex h-44 items-end rounded-lg bg-slate-50 p-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-purple-700 to-indigo-500"
                  style={{ height: `${(v / max) * 100}%` }}
                  title={`${v / 1000}K views`}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-400">{i + 1}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CollegesSection() {
  return (
    <Panel title="All colleges">
      <DataTable
        columns={[
          { key: "shortName", header: "College", render: (c) => <span className="font-semibold text-gray-900">{c.shortName}</span> },
          { key: "city", header: "Location", render: (c) => `${c.city}, ${c.state}` },
          { key: "sector", header: "Type", render: (c) => <Badge variant={c.sector === "Government" ? "blue" : "orange"}>{c.sector}</Badge> },
          { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
          { key: "placementRate", header: "Placement", render: (c) => `${c.placement.placementRate}%` },
          { key: "reviewCount", header: "Reviews", render: (c) => formatCount(c.reviewCount) },
        ]}
        rows={COLLEGES}
        searchKeys={["name", "shortName", "city", "state"]}
        searchPlaceholder="Search colleges..."
      />
    </Panel>
  );
}

function CoursesSection() {
  return (
    <Panel title="Course catalog">
      <DataTable
        columns={[
          { key: "name", header: "Course", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
          { key: "level", header: "Level", render: (c) => <Badge variant="purple">{c.level}</Badge> },
          { key: "duration", header: "Duration" },
          { key: "avgFeeYear", header: "Avg. Fees", render: (c) => formatINR(c.avgFeeYear) },
          { key: "hot", header: "Status", render: (c) => (c.hot ? <Badge variant="green">Hot</Badge> : <Badge variant="gray">Standard</Badge>) },
        ]}
        rows={COURSES.map((c) => ({ ...c, id: c.slug }))}
        searchKeys={["name"]}
        searchPlaceholder="Search courses..."
      />
    </Panel>
  );
}

function ScholarshipsSection() {
  return (
    <Panel title="Scholarship schemes">
      <DataTable
        columns={[
          { key: "name", header: "Scholarship", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
          { key: "provider", header: "Provider" },
          { key: "amount", header: "Amount", render: (s) => <span className="font-semibold text-green-600">{s.amount}</span> },
          { key: "deadline", header: "Deadline" },
          { key: "renewable", header: "Renewable", render: (s) => (s.renewable ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
        ]}
        rows={SCHOLARSHIPS}
        searchKeys={["name", "provider"]}
        searchPlaceholder="Search scholarships..."
      />
    </Panel>
  );
}

function ExamsSection() {
  return (
    <Panel title="Examinations">
      <DataTable
        columns={[
          { key: "shortName", header: "Exam", render: (e) => <Link href={`/exams/${e.slug}`} className="font-semibold text-purple-700 hover:underline">{e.shortName}</Link> },
          { key: "type", header: "Type" },
          { key: "level", header: "Level" },
          { key: "stage", header: "Stage", render: (e) => <Badge variant={e.stage === "Registration Open" ? "green" : e.stage === "Results Declared" ? "gray" : "yellow"}>{e.stage}</Badge> },
          { key: "duration", header: "Duration" },
        ]}
        rows={EXAMS}
        searchKeys={["name", "shortName"]}
        searchPlaceholder="Search exams..."
      />
    </Panel>
  );
}

function MockTestsSection() {
  return (
    <Panel title="Mock test library">
      <DataTable
        columns={[
          { key: "title", header: "Test", render: (t) => <span className="font-semibold text-gray-900">{t.title}</span> },
          { key: "exam", header: "Exam", render: (t) => <Badge variant="purple">{t.exam}</Badge> },
          { key: "difficulty", header: "Difficulty", render: (t) => <Badge variant={t.difficulty === "Easy" ? "green" : t.difficulty === "Medium" ? "yellow" : "red"}>{t.difficulty}</Badge> },
          { key: "questionCount", header: "Questions" },
          { key: "attempts", header: "Attempts", render: (t) => formatCount(t.attempts) },
        ]}
        rows={MOCK_TESTS}
        searchKeys={["title", "exam"]}
        searchPlaceholder="Search tests..."
      />
    </Panel>
  );
}

function QuestionsSection() {
  return (
    <Panel title="Question bank">
      <DataTable
        columns={[
          { key: "test", header: "Test" },
          { key: "text", header: "Question" },
          { key: "type", header: "Type" },
          { key: "difficulty", header: "Difficulty", render: (q) => <Badge variant={q.difficulty === "Easy" ? "green" : q.difficulty === "Medium" ? "yellow" : "red"}>{q.difficulty}</Badge> },
          { key: "topic", header: "Topic" },
        ]}
        rows={SAMPLE_QUESTIONS as unknown as { id: string; test: string; text: string; type: string; difficulty: string; topic: string }[]}
        searchKeys={["text", "test", "topic"]}
        searchPlaceholder="Search questions..."
      />
    </Panel>
  );
}

function StudentsSection() {
  return (
    <Panel title="Registered students">
      <DataTable
        columns={[
          { key: "name", header: "Student", render: (s) => <span className="font-semibold text-gray-900">{s.name}</span> },
          { key: "mobile", header: "Mobile" },
          { key: "state", header: "State" },
          { key: "course", header: "Course" },
          { key: "status", header: "Status", render: (s) => <Badge variant={s.status === "Active" ? "green" : s.status === "Lead" ? "yellow" : "gray"}>{s.status}</Badge> },
        ]}
        rows={SAMPLE_STUDENTS as unknown as { id: string; name: string; mobile: string; state: string; course: string; status: string }[]}
        searchKeys={["name", "mobile", "course"]}
        searchPlaceholder="Search students..."
      />
    </Panel>
  );
}

function ReviewsSection() {
  const { reviews } = useApp();
  const all = [
    ...reviews.map((r, i) => ({ id: `u${i}`, author: r.author, program: r.program, rating: r.rating, status: "Pending" })),
    ...COLLEGES.flatMap((c) =>
      c.reviews.map((r) => ({ id: r.id, author: r.author, program: r.program, rating: r.rating, status: "Approved" })),
    ),
  ].slice(0, 20);
  return (
    <Panel title="Collected reviews">
      <DataTable
        columns={[
          { key: "author", header: "Author", render: (r) => <span className="font-semibold text-gray-900">{r.author}</span> },
          { key: "program", header: "Program" },
          { key: "rating", header: "Rating", render: (r) => `${r.rating} ★` },
          { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Approved" ? "green" : "yellow"}>{r.status}</Badge> },
        ]}
        rows={all as { id: string; author: string; program: string; rating: number; status: string }[]}
        searchKeys={["author", "program"]}
        searchPlaceholder="Search reviews..."
      />
    </Panel>
  );
}

function BlogsSection() {
  return (
    <Panel title="Published articles">
      <DataTable
        columns={[
          { key: "title", header: "Article", render: (p) => <span className="font-semibold text-gray-900">{p.title}</span> },
          { key: "category", header: "Category", render: (p) => <Badge variant="purple">{p.category}</Badge> },
          { key: "author", header: "Author" },
          { key: "readTime", header: "Read time" },
          { key: "featured", header: "Featured", render: (p) => (p.featured ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge>) },
        ]}
        rows={BLOG_POSTS}
        searchKeys={["title", "author", "category"]}
        searchPlaceholder="Search articles..."
      />
    </Panel>
  );
}

function FaqsSection() {
  const faqs = COLLEGES.flatMap((c) => c.faqs.map((f) => ({ id: `${c.id}-${f.q.slice(0, 8)}`, college: c.shortName, q: f.q }))).slice(0, 10);
  return (
    <Panel title="FAQ management">
      <DataTable
        columns={[
          { key: "college", header: "College" },
          { key: "q", header: "Question" },
        ]}
        rows={faqs as { id: string; college: string; q: string }[]}
        searchKeys={["q", "college"]}
        searchPlaceholder="Search FAQs..."
      />
    </Panel>
  );
}

function BannersSection() {
  return (
    <Panel title="Homepage banners">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Admission Open CTA", "Scholarship Alert", "College Predictor Promo"].map((b, i) => (
          <div key={b} className="rounded-2xl border border-slate-200 p-4">
            <div className={cn(
              "grid h-28 place-items-center rounded-xl text-white",
              i === 0 ? "bg-gradient-to-br from-purple-700 to-indigo-600" : i === 1 ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-blue-700 to-cyan-600",
            )}>
              <span className="text-sm font-bold">{b}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="green">Active</Badge>
              <button type="button" className="text-xs font-semibold text-purple-700">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NotificationsSection() {
  const { notifications } = useApp();
  const rows = notifications.length
    ? notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, status: n.read ? "Read" : "Unread" }))
    : [{ id: "demo-1", title: "Welcome to Padhaanewala Admin", message: "Configure push notifications from here.", status: "Unread" }];
  return (
    <Panel title="Push notifications">
      <DataTable
        columns={[
          { key: "title", header: "Title", render: (r) => <span className="font-semibold text-gray-900">{r.title}</span> },
          { key: "message", header: "Message" },
          { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Unread" ? "yellow" : "gray"}>{r.status}</Badge> },
        ]}
        rows={rows as { id: string; title: string; message: string; status: string }[]}
        searchKeys={["title", "message"]}
        searchPlaceholder="Search notifications..."
      />
    </Panel>
  );
}

function LeadsSection() {
  const { enquiries } = useApp();
  return (
    <Panel title="Admission leads" action={<Badge variant="purple">{enquiries.length} total</Badge>}>
      {enquiries.length ? (
        <DataTable
          columns={[
            { key: "name", header: "Name", render: (e) => <span className="font-semibold text-gray-900">{e.name}</span> },
            { key: "mobile", header: "Mobile" },
            { key: "course", header: "Course" },
            { key: "state", header: "State" },
            { key: "status", header: "Status", render: (e) => <Badge variant={e.status === "new" ? "yellow" : e.status === "contacted" ? "blue" : "green"}>{e.status}</Badge> },
          ]}
          rows={enquiries}
          searchKeys={["name", "mobile", "course", "state"]}
          searchPlaceholder="Search leads..."
          emptyState="No leads yet. Enquiries from the Get Admission Help forms will appear here."
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">
            No leads yet. Enquiries from the &quot;Get Admission Help&quot; forms will appear here instantly.
          </p>
        </div>
      )}
    </Panel>
  );
}

function CounsellorsSection() {
  return (
    <Panel title="Counsellors">
      <DataTable
        columns={[
          { key: "name", header: "Counsellor", render: (c) => <span className="font-semibold text-gray-900">{c.name}</span> },
          { key: "region", header: "Region" },
          { key: "leads", header: "Leads" },
          { key: "converted", header: "Converted", render: (c) => <span className="font-semibold text-green-600">{c.converted}</span> },
          { key: "rating", header: "Rating", render: (c) => `${c.rating} ★` },
        ]}
        rows={SAMPLE_COUNSELLORS as unknown as { id: string; name: string; region: string; leads: number; converted: number; rating: number }[]}
        searchKeys={["name", "region"]}
        searchPlaceholder="Search counsellors..."
      />
    </Panel>
  );
}

function MediaSection() {
  return (
    <Panel title="Media library">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {COLLEGES.slice(0, 8).map((c) => (
          <div key={c.id} className="overflow-hidden rounded-xl border border-slate-100">
            <div className="grid h-24 place-items-center bg-gradient-to-br from-purple-700 to-indigo-600 text-white">
              <span className="text-sm font-bold">{c.initials}</span>
            </div>
            <p className="truncate px-3 py-2 text-xs font-medium text-slate-600">{c.shortName}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SeoSection() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Crawl errors" value="0" />
        <StatCard label="Indexed pages" value="142" delta="+6" up />
        <StatCard label="Backlinks" value="1.2K" delta="+4.2%" up />
        <StatCard label="Avg. Core Web Vitals" value="0.9s" delta="Pass" up />
      </div>
      <Panel title="Sitemap & robots">
        <div className="space-y-3 text-sm text-slate-600">
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span>robots.txt</span> <span className="text-green-600">Live</span>
          </p>
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span>sitemap.xml</span> <span className="text-green-600">Live ({16 + 14} URLs)</span>
          </p>
        </div>
      </Panel>
    </div>
  );
}

function SettingsSection() {
  return (
    <Panel title="Site settings">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {["Site name", "Support email", "Contact phone", "Counselling hours"].map((s) => (
          <div key={s} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-400">{s}</p>
            <p className="mt-1 font-semibold text-gray-900">{s === "Site name" ? "padhaanewala" : s === "Support email" ? "support@padhaanewala.com" : s === "Contact phone" ? "+91 98765 43210" : "Mon–Sat, 9 AM – 8 PM"}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditSection() {
  const logs = [
    { id: "a1", action: "College updated", actor: "admin@padhaa", time: "2 min ago" },
    { id: "a2", action: "Blog published — NEET eligibility", actor: "editor@padhaa", time: "1 hr ago" },
    { id: "a3", action: "Scholarship deadline changed", actor: "admin@padhaa", time: "3 hrs ago" },
    { id: "a4", action: "User lead converted", actor: "counsellor.anita", time: "5 hrs ago" },
    { id: "a5", action: "Banner CTA updated", actor: "support@padhaa", time: "1 day ago" },
    { id: "a6", action: "Exam result synced", actor: "system", time: "1 day ago" },
  ];
  return (
    <Panel title="Audit logs">
      <div className="space-y-3">
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{l.action}</p>
              <p className="text-xs text-slate-400">by {l.actor}</p>
            </div>
            <span className="text-xs text-slate-400">{l.time}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}