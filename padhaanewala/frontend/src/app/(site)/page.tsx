import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "@/components/icons";
import HeroSearch from "@/components/HeroSearch";
import WhatsAppButton from "@/components/WhatsAppButton";
import QuickActions from "@/components/QuickActions";
import {
  PopularCourses,
  FeaturedColleges,
  Scholarships,
  UpcomingExams,
  MockTests,
  WhyPadhaanewala,
  StudentReviews,
  LatestArticles,
  AdmissionCta,
} from "@/components/home-sections";

export default function Home() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="bg-neutral-950">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white">
            <SparklesIcon className="h-3.5 w-3.5" />
            India&apos;s verified education discovery platform
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Find the Right College for Your Future
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-neutral-300 sm:text-lg">
            Compare colleges, predict admissions from your rank, apply for
            scholarships and prepare with mock tests — all in one place.
          </p>
          <div className="mt-10 flex justify-center">
            <HeroSearch />
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/college-predictor"
              className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-neutral-950 transition-transform hover:scale-105 sm:w-auto"
            >
              <SparklesIcon className="h-4 w-4" />
              Try the AI College Predictor
            </Link>
            <Link
              href="/colleges"
              className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full border border-white/25 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Browse Colleges
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <QuickActions />
      <PopularCourses />
      <FeaturedColleges />
      <Scholarships />
      <UpcomingExams />
      <MockTests />
      <WhyPadhaanewala />
      <StudentReviews />
      <LatestArticles />
      <AdmissionCta />

      <WhatsAppButton />
    </div>
  );
}