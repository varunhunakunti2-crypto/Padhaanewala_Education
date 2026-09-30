import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ROBOTS_DISALLOW } from "@/lib/nav";

/**
 * `disallow` is not `noindex` — it asks a crawler not to fetch the page, which
 * is the wrong tool for de-listing a route you still want to serve. Each
 * de-listed route carries `BETA_NOINDEX` in its own `metadata` export for that.
 * Both lists are needed: a disallowed URL can still appear in search results as
 * a bare link, and a `noindex` URL that is disallowed cannot be fetched to read
 * the `noindex` at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Beta-hidden routes (not advertised, not supported yet) and private
        // surfaces (RequireAuth/RequireAdmin-gated, plus the API).
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
