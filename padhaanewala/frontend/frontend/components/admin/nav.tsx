"use client";

/** Sidebar navigation definition for the admin console. */

import {
  Award,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  Headset,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  ScrollText,
  Images as MediaIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import type { SectionKey } from "@/components/admin/types";

export const NAV: {
  key: SectionKey;
  label: string;
  icon: typeof LayoutDashboard;
  /**
   * Hidden from the sidebar for everyone else. This is a courtesy, not the
   * security boundary: the backend route itself is `SUPER_ADMIN_ROLES`, so a
   * plain admin who bookmarks the section gets a 403 the panel renders.
   */
  superAdminOnly?: boolean;
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "colleges", label: "Colleges", icon: Building2 },
  { key: "collegesubmissions", label: "College Requests", icon: ClipboardCheck },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "scholarships", label: "Scholarships", icon: Award },
  { key: "exams", label: "Exams", icon: CalendarDays },
  { key: "mocktests", label: "Mock Tests", icon: FileQuestion },
  { key: "questions", label: "Questions", icon: ListChecks },
  { key: "students", label: "Students", icon: Users },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "blogs", label: "Blogs", icon: Newspaper },
  { key: "faqs", label: "FAQs", icon: HelpCircle },
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "leads", label: "Leads", icon: Users2 },
  { key: "counsellors", label: "Counsellors", icon: Headset },
  { key: "datarequests", label: "Data Requests", icon: ShieldCheck },
  { key: "media", label: "Media", icon: MediaIcon },
  { key: "seo", label: "SEO", icon: TrendingUp },
  // Placed next to Settings: it is configuration, but its own entry because a
  // credential rotation is the thing a super admin is usually looking for.
  { key: "aisettings", label: "AI Settings", icon: Sparkles, superAdminOnly: true },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
];
