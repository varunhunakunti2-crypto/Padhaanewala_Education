import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { LEGAL_SLUGS, getLegalDoc } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

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
  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: absoluteUrl(`/legal/${doc.slug}`) },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url: absoluteUrl(`/legal/${doc.slug}`),
      type: "article",
    },
  };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return <LegalDocument doc={doc} />;
}
