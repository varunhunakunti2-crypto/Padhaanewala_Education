import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollegeBySlug, COLLEGES } from "@/lib/data/colleges";
import { formatINR } from "@/lib/utils";
import CollegeDetailContent from "@/components/college/CollegeDetailContent";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return COLLEGES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const college = getCollegeBySlug(slug);
  if (!college) return { title: "College not found" };
  const minFee = Math.min(...college.courses.map((c) => c.feePerYear));
  return {
    title: college.name,
    description: `${college.shortName} in ${college.city}, ${college.state}. Rated ${college.rating}/5. Approx fee ${formatINR(minFee)} per year. ${college.placement.placementRate}% placement rate. Compare on CampusPulse.`,
    openGraph: {
      title: `${college.name} — CampusPulse`,
      description: `Explore ${college.shortName}: courses, fees, placements, reviews and more on CampusPulse.`,
      type: "article",
      siteName: "CampusPulse",
      images: [],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const college = getCollegeBySlug(slug);
  if (!college) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: college.name,
    description: college.overview,
    url: `https://campuspulse.in/colleges/${college.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: college.city,
      addressRegion: college.state,
      postalCode: college.pincode,
      addressCountry: "IN",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(college.rating),
      reviewCount: String(college.reviewCount),
    },
    foundingDate: String(college.founded),
    provider: {
      "@type": "EducationalOrganization",
      name: college.name,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CollegeDetailContent college={college} />
    </>
  );
}