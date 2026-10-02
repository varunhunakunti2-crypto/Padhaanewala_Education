import { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveMockTest, resolveSlugs } from "@/lib/content";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, ldGraph, mockTestLd, ogImage, pageMetadata } from "@/lib/seo";
import { ProctoredMockTest } from "@/components/mocktests/ProctoredMockTest";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await resolveSlugs("mock-tests");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: test } = await resolveMockTest(slug);
  if (!test) {
    return pageMetadata({
      title: "Mock test not found",
      description: "This mock test is not available on padhaanewala.",
      path: `/mock-tests/${slug}`,
      noindex: true,
    });
  }
  return pageMetadata({
    title: `${test.title} — Mock Test`,
    description: `${test.title}: ${test.questionCount} questions in ${test.durationMins} minutes, with a full-screen timed interface and instant scoring.`,
    path: `/mock-tests/${test.slug}`,
    type: "article",
    image: ogImage(`${test.title} — free timed practice paper`),
  });
}

export default async function ProctoredMockTestPage({ params }: PageProps) {
  const { slug } = await params;
  const { data: test } = await resolveMockTest(slug);
  if (!test) notFound();

  const jsonLd = ldGraph([
    mockTestLd(test),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Mock Tests", path: "/mock-tests" },
      { name: test.title, path: `/mock-tests/${test.slug}` },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProctoredMockTest test={test} />
    </>
  );
}
