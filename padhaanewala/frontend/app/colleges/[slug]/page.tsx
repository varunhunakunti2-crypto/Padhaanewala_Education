import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatINR } from "@/lib/utils";
import { resolveCollege, resolveColleges, resolveSlugs } from "@/lib/content";
import { getSimilarColleges } from "@/lib/data/colleges";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  breadcrumbLd,
  collegeLd,
  faqPageLd,
  ldGraph,
  ogImage,
  pageMetadata,
} from "@/lib/seo";
import CollegeDetailContent from "@/components/college/CollegeDetailContent";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Only a seed set is prerendered. The catalogue is 341 colleges today with a
 * 1000+ target, and each of these pages fans out to `getCollegeBundle` (9
 * requests) plus the full college list for the "similar colleges" section.
 * Prerendering all of them made the build exceed the 60s per-page budget and
 * exit non-zero. Anything not listed here is still generated on first request
 * and cached (`dynamicParams` defaults to true), and `app/sitemap.ts` calls
 * `resolveSlugs` without a limit so every college stays discoverable.
 */
const PRERENDER_SEED = 25;

export async function generateStaticParams() {
  const slugs = await resolveSlugs("colleges", PRERENDER_SEED);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: college } = await resolveCollege(slug);
  if (!college) {
    return pageMetadata({
      title: "College not found",
      description: "This college is not in the padhaanewala catalogue.",
      path: `/colleges/${slug}`,
      noindex: true,
    });
  }

  const fees = college.courses.map((c) => c.feePerYear).filter((f) => f > 0);
  const minFee = fees.length ? Math.min(...fees) : 0;

  const description = [
    `${college.shortName} in ${college.city}, ${college.state}.`,
    college.rating > 0
      ? `Rated ${college.rating}/5 from ${college.reviewCount} reviews.`
      : "",
    minFee > 0 ? `Approx fee ${formatINR(minFee)} per year.` : "",
    college.placement.placementRate > 0
      ? `${college.placement.placementRate}% placement rate.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return pageMetadata({
    title: college.name,
    description,
    path: `/colleges/${college.slug}`,
    // `article` rather than `website`: a college page is a standalone document
    // about one entity, and the `article:*` tags it enables are what the card
    // preview uses for a publish date.
    type: "article",
    image: ogImage(`${college.name} — courses, fees and placements`),
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const [{ data: college }, { data: dataset }] = await Promise.all([
    resolveCollege(slug),
    resolveColleges(),
  ]);
  if (!college) notFound();

  // Similar colleges must come from the same dataset as the college itself,
  // otherwise an API-backed page ends up recommending bundled records.
  const similar = getSimilarColleges(college, 3, dataset).filter(
    (c) => c.slug !== college.slug,
  );

  const jsonLd = ldGraph([
    collegeLd(college),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Colleges", path: "/colleges" },
      { name: college.name, path: `/colleges/${college.slug}` },
    ]),
    faqPageLd(college.faqs ?? []),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollegeDetailContent college={college} similar={similar} />
    </>
  );
}
