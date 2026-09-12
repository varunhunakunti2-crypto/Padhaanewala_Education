import Link from "next/link";
import { SparklesIcon, BadgeCheckIcon } from "@/components/icons";
import HeroSearch from "@/components/HeroSearch";
import BrowseCollegesButton from "@/components/BrowseCollegesButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import QuickActions from "@/components/QuickActions";
import { Reveal } from "@/components/motion";
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

const trustItems = [
  "1,000+ verified colleges",
  "100+ scholarships",
  "Free admission counselling",
];

export default function Home() {
  return (
    <div className="bg-white text-neutral-900 dark:bg-[#0a0a0a] dark:text-neutral-100">
<section
        className="relative bg-white bg-cover bg-center"
        style={{
          backgroundImage: "url(/dreamlike-surrealistic-landscape.jpg)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-[#0a0a0a]/90 dark:via-[#0a0a0a]/75 dark:to-[#0a0a0a]/50" />
        <div className="relative mx-auto w-full max-w-[1536px] px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-800 backdrop-blur-sm">
              <SparklesIcon className="h-3.5 w-3.5" />
              India&apos;s verified education discovery platform
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
              Find the Right College for Your Future
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-4 max-w-xl text-base text-neutral-600 sm:text-lg">
              Compare colleges, predict admissions from your rank, apply for
              scholarships and prepare with mock tests — all in one place.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-10 flex justify-center">
              <HeroSearch />
            </div>
          </Reveal>
          <Reveal delay={0.32}>
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
          </Reveal>
          <Reveal delay={0.4}>
            <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-neutral-600">
              {trustItems.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <BadgeCheckIcon className="h-4 w-4 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <Reveal>
        <QuickActions />
      </Reveal>
      <Reveal>
        <PopularCourses />
      </Reveal>
      <Reveal>
        <FeaturedColleges />
      </Reveal>
      <Reveal>
        <Scholarships />
      </Reveal>
      <Reveal>
        <UpcomingExams />
      </Reveal>
      <Reveal>
        <MockTests />
      </Reveal>
      <Reveal>
        <WhyPadhaanewala />
      </Reveal>
      <Reveal>
        <StudentReviews />
      </Reveal>
      <Reveal>
        <LatestArticles />
      </Reveal>
      <Reveal>
        <AdmissionCta />
      </Reveal>

      <WhatsAppButton />
    </div>
  );
}