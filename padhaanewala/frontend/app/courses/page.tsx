import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Courses",
  description:
    "Browse degrees and specializations — B.Tech, MBA, BBA, B.Sc, B.Arch, Law, Pharmacy and more — offered by colleges across India.",
};

import CoursesExplorer from "@/components/courses/CoursesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";

export default function Page() {
  return (
    <>
      <CoursesExplorer />
      <AdmissionHelpBanner />
    </>
  );
}