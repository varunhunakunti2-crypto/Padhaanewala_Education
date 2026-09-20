import type { MetadataRoute } from "next";
import { COLLEGES } from "@/lib/data/colleges";
import { COURSES } from "@/lib/data/courses";
import { EXAMS } from "@/lib/data/exams";
import { BLOG_POSTS } from "@/lib/data/blog";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://campuspulse.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const collegePages = COLLEGES.map((c) => ({
    url: `${BASE}/colleges/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const coursePages = COURSES.map((c) => ({
    url: `${BASE}/courses/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const examPages = EXAMS.map((e) => ({
    url: `${BASE}/exams/${e.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const blogPages = BLOG_POSTS.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/colleges`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...collegePages,
    { url: `${BASE}/courses`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...coursePages,
    { url: `${BASE}/college-predictor`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/scholarships`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/exams`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...examPages,
    { url: `${BASE}/mock-tests`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/reviews`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...blogPages,
    { url: `${BASE}/ask-ai`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/admission`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/dashboard`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}