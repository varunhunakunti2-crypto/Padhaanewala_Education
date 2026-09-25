import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { resolveSlugs } from "@/lib/content";

export const revalidate = 3600;

/**
 * Sitemap is generated from live catalogue slugs (API first, bundled fallback)
 * so newly published colleges/exams/posts appear without a code change.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const [collegeSlugs, courseSlugs, examSlugs, blogSlugs, mockTestSlugs] = await Promise.all([
    resolveSlugs("colleges"),
    resolveSlugs("courses"),
    resolveSlugs("exams"),
    resolveSlugs("blogs"),
    resolveSlugs("mock-tests").catch(() => [] as string[]),
  ]);

  const page = (
    path: string,
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never",
    priority: number,
  ) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });

  return [
    page("/", "weekly", 1),
    page("/colleges", "weekly", 0.9),
    ...collegeSlugs.map((slug) => page(`/colleges/${slug}`, "monthly", 0.8)),
    page("/courses", "weekly", 0.7),
    ...courseSlugs.map((slug) => page(`/courses/${slug}`, "monthly", 0.7)),
    page("/college-predictor", "monthly", 0.8),
    page("/compare", "monthly", 0.6),
    page("/scholarships", "monthly", 0.7),
    page("/exams", "weekly", 0.7),
    ...examSlugs.map((slug) => page(`/exams/${slug}`, "weekly", 0.7)),
    page("/mock-tests", "weekly", 0.6),
    ...mockTestSlugs.map((slug) => page(`/mock-tests/${slug}`, "weekly", 0.5)),
    page("/reviews", "monthly", 0.5),
    page("/blog", "weekly", 0.6),
    ...blogSlugs.map((slug) => page(`/blog/${slug}`, "monthly", 0.6)),
    page("/ask-ai", "monthly", 0.6),
    page("/admission", "monthly", 0.6),
    page("/resources", "monthly", 0.5),
    page("/contact", "yearly", 0.3),
    page("/about", "yearly", 0.3),
    page("/login", "yearly", 0.3),
    // /dashboard and /admin are intentionally absent — both are noindex.
  ];
}
