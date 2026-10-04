import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { resolveSlugs } from "@/lib/content";
import { LEGAL_NAV } from "@/lib/legal";
import { SITEMAP_PAGES, SITEMAP_SLUG_SECTIONS, isBetaHidden, isNoindex, type ChangeFrequency } from "@/lib/nav";

export const revalidate = 3600;

/**
 * Sitemap is generated from the page manifest plus live catalogue slugs (API
 * first, bundled fallback), so newly published colleges/exams/posts appear
 * without a code change, and de-listing a route is a one-line change in
 * `lib/nav.ts` rather than an edit here.
 *
 * Every source is filtered through both `isBetaHidden` and `isNoindex`. The
 * filters are applied at read time rather than trusted to the manifest being kept
 * in sync, because a route left in the sitemap while carrying `noindex` is a
 * direct contradiction — the sitemap says "index this" and the page says "do
 * not" — and `/login` shipped exactly that way.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const excluded = (path: string) => isBetaHidden(path) || isNoindex(path);

  const slugsBySection = new Map<string, string[]>();
  await Promise.all(
    SITEMAP_SLUG_SECTIONS.map(async ({ section }) => {
      slugsBySection.set(section, await resolveSlugs(section));
    }),
  );

  const page = (path: string, changeFrequency: ChangeFrequency, priority: number) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  const staticPages = SITEMAP_PAGES.filter((p) => !excluded(p.path)).map((p) =>
    page(p.path, p.changeFrequency, p.priority),
  );

  const detailPages = SITEMAP_SLUG_SECTIONS.flatMap(({ section, pathPrefix, changeFrequency, priority }) =>
    (slugsBySection.get(section) ?? [])
      .map((slug) => `${pathPrefix}/${slug}`)
      .filter((path) => !excluded(path))
      .map((path) => page(path, changeFrequency, priority)),
  );

  return [
    ...staticPages,
    ...detailPages,
    // Legal documents are driven by the same registry as /legal/[slug], so a
    // new document appears here without a second edit.
    ...LEGAL_NAV.filter((entry) => !excluded(entry.href)).map((entry) =>
      page(entry.href, "yearly", 0.2),
    ),
    // /dashboard and /admin are intentionally absent — both are noindex, and
    // both are in ROBOTS_DISALLOW.
  ];
}
