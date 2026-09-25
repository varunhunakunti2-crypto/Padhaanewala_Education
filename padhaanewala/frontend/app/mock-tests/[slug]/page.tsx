import { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveMockTest, resolveSlugs } from "@/lib/content";
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
  if (!test) return { title: "Mock test not found" };
  return {
    title: `${test.title} — Mock Test`,
    description: `${test.title}: ${test.questionCount} questions in ${test.durationMins} minutes, with a full-screen timed interface and instant scoring.`,
    robots: { index: false, follow: true },
  };
}

export default async function ProctoredMockTestPage({ params }: PageProps) {
  const { slug } = await params;
  const { data: test } = await resolveMockTest(slug);
  if (!test) notFound();

  return <ProctoredMockTest test={test} />;
}
