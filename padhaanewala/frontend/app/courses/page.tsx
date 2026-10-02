import type { Metadata } from "next";
import CoursesExplorer from "@/components/courses/CoursesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveColleges, resolveCourses } from "@/lib/content";
import { breadcrumbLd, itemListLd, ldGraph, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveCourses();
  return pageMetadata({
    title: "Explore Courses",
    description: `Browse ${data.length} degrees and specializations — B.Tech, MBA, BBA, B.Sc, Law, Pharmacy and more — offered by colleges across India.`,
    path: "/courses",
  });
}

export default async function Page() {
  const [{ data: courses }, { data: colleges }] = await Promise.all([
    resolveCourses(),
    resolveColleges(),
  ]);

  const jsonLd = ldGraph([
    itemListLd(
      courses.map((course) => ({ name: course.name, path: `/courses/${course.slug}` })),
      "Courses in India",
    ),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Courses", path: "/courses" },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <CoursesExplorer courses={courses} colleges={colleges} />
      <AdmissionHelpBanner />
    </>
  );
}
