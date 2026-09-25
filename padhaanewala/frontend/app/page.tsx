import { HeroSection } from "@/components/home/hero/HeroSection";
import { QuickActions } from "@/components/home/QuickActions";
import { PopularCourses } from "@/components/home/PopularCourses";
import { FeaturedColleges } from "@/components/home/FeaturedColleges";
import { PopularCollegeSearches } from "@/components/home/PopularCollegeSearches";
import {
  HomeScholarships,
  UpcomingExams,
  HomeMockTests,
  HomeArticles,
  FinalCta,
} from "@/components/home/HomeSections";
import { WhyChooseSection } from "@/components/home/WhyChooseSection";
import { StudentTestimonials } from "@/components/home/StudentTestimonials";
import {
  resolveBlogPosts,
  resolveColleges,
  resolveExams,
  resolveMockTests,
  resolveScholarships,
} from "@/lib/content";

export const revalidate = 300;

export default async function HomePage() {
  // All six requests are independent, so they are issued concurrently and each
  // one independently falls back to bundled data if the backend is unavailable.
  const [colleges, exams, scholarships, mockTests, posts] = await Promise.all([
    resolveColleges(),
    resolveExams(),
    resolveScholarships(),
    resolveMockTests(),
    resolveBlogPosts(),
  ]);

  return (
    <>
      <HeroSection />
      <QuickActions />
      <PopularCourses />
      <FeaturedColleges colleges={colleges.data} />
      <PopularCollegeSearches />
      <HomeScholarships scholarships={scholarships.data} />
      <UpcomingExams exams={exams.data} />
      <HomeMockTests tests={mockTests.data} />
      <WhyChooseSection />
      <StudentTestimonials />
      <HomeArticles posts={posts.data} />
      <FinalCta />
    </>
  );
}
