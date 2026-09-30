import type { Metadata } from "next";
import CoursesExplorer from "@/components/courses/CoursesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { resolveColleges, resolveCourses } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveCourses();
  return {
    title: "Explore Courses",
    description: `Browse ${data.length} degrees and specializations — B.Tech, MBA, BBA, B.Sc, Law, Pharmacy and more — offered by colleges across India.`,
  };
}

export default async function Page() {
  const [{ data: courses }, { data: colleges }] = await Promise.all([
    resolveCourses(),
    resolveColleges(),
  ]);

  return (
    <>
      <CoursesExplorer courses={courses} colleges={colleges} />
      <AdmissionHelpBanner />
    </>
  );
}
