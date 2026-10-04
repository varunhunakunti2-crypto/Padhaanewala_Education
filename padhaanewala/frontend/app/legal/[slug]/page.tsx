import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { JsonLd } from "@/components/seo/JsonLd";
import { LEGAL_SLUGS, getLegalDoc } from "@/lib/legal";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";

/**
 * One route for all six documents, driven by `lib/legal.ts`.
 *
 * `dynamicParams = false` makes the slug set closed: an unknown slug 404s
 * instead of being rendered on demand and then failing inside the component.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) {
    return pageMetadata({
      title: "Document not found",
      description: "This legal document is not published on padhaanewala.",
      path: `/legal/${slug}`,
      noindex: true,
    });
  }

  return pageMetadata({
    title: doc.title,
    description: doc.description,
    path: `/legal/${doc.slug}`,
    type: "article",
  });
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  /**
   * Two crumbs, not three. There is no `/legal` route — only
   * `app/legal/[slug]/page.tsx` — so a trail through `/legal` would assert a
   * page that returns 404, which is the one thing a `BreadcrumbList` must never
   * do. `breadcrumbLd()` would also drop the node for a single-item trail.
   */
  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: doc.title, path: `/legal/${doc.slug}` },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalDocument doc={doc} />
    </>
  );
}
