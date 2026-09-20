import { Metadata } from "next";
import { notFound } from "next/navigation";
import { MOCK_TESTS, getMockTest } from "@/lib/data/mockTests";
import { ProctoredMockTest } from "@/components/mocktests/ProctoredMockTest";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return MOCK_TESTS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const test = getMockTest(slug);
  if (!test) return { title: "Mock test not found" };
  return {
    title: `${test.title} — Proctored Mock Test`,
    description: `${test.title}: ${test.questionCount} questions, ${test.durationMins} minutes. A monitored, full-screen exam experience.`,
  };
}

export default async function ProctoredMockTestPage({ params }: PageProps) {
  const { slug } = await params;
  const test = getMockTest(slug);
  if (!test) notFound();

  return <ProctoredMockTest test={test} />;
}