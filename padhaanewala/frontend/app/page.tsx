import { HeroSection } from "@/components/home/hero/HeroSection";
import { QuickActions } from "@/components/home/QuickActions";
import { PopularCourses } from "@/components/home/PopularCourses";
import { FeaturedColleges } from "@/components/home/FeaturedColleges";
import { PopularCollegeSearches } from "@/components/home/PopularCollegeSearches";
import { HomeScholarships, UpcomingExams, HomeMockTests, HomeArticles, FinalCta } from "@/components/home/HomeSections";
import { WhyChooseSection } from "@/components/home/WhyChooseSection";
import { StudentTestimonials } from "@/components/home/StudentTestimonials";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <QuickActions />
      <PopularCourses />
      <FeaturedColleges />
      <PopularCollegeSearches />
      <HomeScholarships />
      <UpcomingExams />
      <HomeMockTests />
      <WhyChooseSection />
      <StudentTestimonials />
      <HomeArticles />
      <FinalCta />
    </>
  );
}