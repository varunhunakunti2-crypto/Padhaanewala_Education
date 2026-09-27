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
  resolveCourses,
  resolveExams,
  resolveMockTests,
  resolveScholarships,
} from "@/lib/content";

export const revalidate = 300;

export default async function HomePage() {
  // These six requests are independent, so they are issued concurrently. Each
  // resolver returns only what the backend actually holds — an empty list when
  // the table is empty, and the sections below render their own empty states.
  const [colleges, courses, exams, scholarships, mockTests, posts] = await Promise.all([
    resolveColleges(),
    resolveCourses(),
    resolveExams(),
    resolveScholarships(),
    resolveMockTests(),
    resolveBlogPosts(),
  ]);

  return (
    <>
      <HeroSection
        collegeCount={colleges.data.length}
        courseCount={courses.data.length}
      />
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
