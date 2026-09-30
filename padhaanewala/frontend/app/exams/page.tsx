import type { Metadata } from "next";
import { ExamsExplorer } from "@/components/exams/ExamComponents";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { resolveExams } from "@/lib/content";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Exams",
    description:
      "Browse all major entrance examinations in India — JEE Main, JEE Advanced, NEET UG, CUET, BITSAT, GATE, CAT, CLAT and more. Check eligibility, dates, pattern and fees.",
    openGraph: {
      title: `Entrance Exams Calendar — ${SITE.name}`,
      description:
        "Complete exam listings with registration dates, exam pattern, eligibility and official websites.",
    },
  };
}

export default async function ExamsPage() {
  const { data: exams } = await resolveExams();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
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
