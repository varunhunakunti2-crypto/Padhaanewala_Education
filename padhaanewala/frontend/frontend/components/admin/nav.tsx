"use client";

/** Sidebar navigation definition for the admin console. */

import {
  Award,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
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
  Star,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import type { SectionKey } from "@/components/admin/types";

export const NAV: { key: SectionKey; label: string; icon: typeof LayoutDashboard }[] = [
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
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "leads", label: "Leads", icon: Users2 },
  { key: "counsellors", label: "Counsellors", icon: Headset },
  { key: "media", label: "Media", icon: MediaIcon },
  { key: "seo", label: "SEO", icon: TrendingUp },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
];
