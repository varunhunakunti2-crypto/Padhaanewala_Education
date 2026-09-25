import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatINR } from "@/lib/utils";
import { absoluteUrl, SITE } from "@/lib/site";
import { resolveCollege, resolveColleges, resolveSlugs } from "@/lib/content";
import { getSimilarColleges } from "@/lib/data/colleges";
import CollegeDetailContent from "@/components/college/CollegeDetailContent";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await resolveSlugs("colleges");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: college } = await resolveCollege(slug);
  if (!college) return { title: "College not found" };

  const fees = college.courses.map((c) => c.feePerYear).filter((f) => f > 0);
  const minFee = fees.length ? Math.min(...fees) : 0;

  const description = [
    `${college.shortName} in ${college.city}, ${college.state}.`,
    college.rating > 0 ? `Rated ${college.rating}/5 from ${college.reviewCount} reviews.` : "",
    minFee > 0 ? `Approx fee ${formatINR(minFee)} per year.` : "",
    college.placement.placementRate > 0
      ? `${college.placement.placementRate}% placement rate.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: college.name,
    description,
    alternates: { canonical: absoluteUrl(`/colleges/${college.slug}`) },
    openGraph: {
      title: `${college.name} — ${SITE.name}`,
      description: `Explore ${college.shortName}: courses, fees, placements, reviews and more on ${SITE.name}.`,
      type: "article",
      siteName: SITE.name,
      url: absoluteUrl(`/colleges/${college.slug}`),
    },
  };
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
  const similar = getSimilarColleges(college, 3, dataset).filter((c) => c.slug !== college.slug);

  const url = absoluteUrl(`/colleges/${college.slug}`);

  // Schema.org requires a numeric rating and at least one review, so the
  // aggregateRating block is only emitted when both actually exist.
  const hasRating = college.rating > 0 && college.reviewCount > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: college.name,
    description: college.overview || undefined,
    url,
    ...(college.founded > 0 ? { foundingDate: String(college.founded) } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: college.tagline || undefined,
      addressLocality: college.city || undefined,
      addressRegion: college.state || undefined,
      postalCode: college.pincode || undefined,
      addressCountry: SITE.address.country,
    },
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: String(college.rating),
            reviewCount: String(college.reviewCount),
          },
        }
      : {}),
    ...(college.courses.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Courses offered",
            itemListElement: college.courses.slice(0, 20).map((course) => ({
              "@type": "Course",
              name: course.name,
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CollegeDetailContent college={college} similar={similar} />
    </>
  );
}
