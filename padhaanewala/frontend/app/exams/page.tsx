import type { Metadata } from "next";
import { ExamsExplorer } from "@/components/exams/ExamComponents";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveExams } from "@/lib/content";
import { breadcrumbLd, itemListLd, ldGraph, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Entrance Exams",
    description:
      "Browse all major entrance examinations in India — JEE Main, JEE Advanced, NEET UG, CUET, BITSAT, GATE, CAT, CLAT and more. Check eligibility, dates, pattern and fees.",
    path: "/exams",
  });
}

export default async function ExamsPage() {
  const { data: exams } = await resolveExams();

  const jsonLd = ldGraph([
    itemListLd(
      exams.map((exam) => ({ name: exam.shortName || exam.name, path: `/exams/${exam.slug}` })),
      "Entrance Exams in India",
    ),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Exams", path: "/exams" },
    ]),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <JsonLd data={jsonLd} />
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Entrance Exams
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-slate-300">
          Track registration windows, exam dates and results for all major national and state-level
          entrance examinations in India.
        </p>
      </div>
      <ExamsExplorer list={exams} />
      <AdmissionHelpBanner />
    </section>
  );
}
