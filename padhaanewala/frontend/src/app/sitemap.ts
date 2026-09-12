import type { MetadataRoute } from "next";
import { colleges } from "@/data/colleges";
import { courses } from "@/data/courses";
import { exams } from "@/data/exams";
import { scholarships } from "@/data/scholarships";
import { mockTests } from "@/data/mockTests";
import { articles } from "@/data/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://padhaanewala.in";

const staticRoutes = [
  "",
  "/colleges",
  "/courses",
  "/exams",
  "/scholarships",
  "/mock-tests",
  "/blog",
  "/college-predictor",
  "/compare",
  "/pricing",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-conditions",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));

  const detail = (
    base: string,
    items: { slug: string }[],
    priority: number
  ): MetadataRoute.Sitemap =>
    items.map((item) => ({
      url: `${SITE_URL}${base}/${item.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority,
    }));

  return [
    ...staticEntries,
    ...detail("/college", colleges, 0.7),
    ...detail("/courses", courses, 0.7),
    ...detail("/exams", exams, 0.6),
    ...detail("/scholarships", scholarships, 0.5),
    ...detail("/mock-tests", mockTests, 0.5),
    ...detail("/blog", articles, 0.6),
  ];
}