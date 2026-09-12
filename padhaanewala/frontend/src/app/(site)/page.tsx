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
      <section className="relative w-full min-h-[82vh] flex flex-col justify-center items-center overflow-hidden py-20 lg:py-28">
        {/* Background Image with 50% Opacity */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-50"
          style={{
            backgroundImage: "url(/dreamlike-surrealistic-landscape.jpg)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 text-center sm:px-6 lg:px-8 flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-sm">
            <SparklesIcon className="h-3.5 w-3.5 text-amber-300" />
            India&apos;s verified education discovery platform
          </span>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl drop-shadow-md">
            Find the Right College for Your Future
          </h1>
          <p className="mt-4 max-w-2xl text-base font-medium text-white/90 sm:text-xl drop-shadow">
            Compare colleges, predict admissions from your rank, apply for
            scholarships and prepare with mock tests — all in one place.
          </p>
          <div className="mt-10 flex w-full justify-center">
            <HeroSearch />
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/college-predictor"
              className="group relative inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-8 text-sm font-bold text-white shadow-lg shadow-[#A654F0]/30 transition-all duration-200 hover:scale-105 active:scale-95"
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