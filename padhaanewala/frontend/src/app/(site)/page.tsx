import Link from "next/link";
import { SparklesIcon } from "@/components/icons";
import HeroSearch from "@/components/HeroSearch";
import BrowseCollegesButton from "@/components/BrowseCollegesButton";
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
    <div className="bg-white text-neutral-900 dark:bg-[#0a0a0a] dark:text-neutral-100">
      <section
        className="relative bg-white bg-cover bg-center"
        style={{
          backgroundImage: "url(/dreamlike-surrealistic-landscape.jpg)",
        }}
      >
        <div className="mx-auto w-full max-w-[1536px] px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/40 px-3 py-1 text-xs font-medium text-neutral-800">
            <SparklesIcon className="h-3.5 w-3.5" />
            India&apos;s verified education discovery platform
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
            Find the Right College for Your Future
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-neutral-600 sm:text-lg">
            Compare colleges, predict admissions from your rank, apply for
            scholarships and prepare with mock tests — all in one place.
          </p>
          <div className="mt-10 flex justify-center">
            <HeroSearch />
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/college-predictor"
              className="foreground-accent inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-neutral-950 transition-transform hover:scale-105 sm:w-auto"
            >
              <SparklesIcon className="h-4 w-4" />
              Try the AI College Predictor
            </Link>
            <BrowseCollegesButton />
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