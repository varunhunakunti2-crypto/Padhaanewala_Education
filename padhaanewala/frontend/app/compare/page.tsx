import type { Metadata } from "next";
import CompareExplorer from "@/components/compare/CompareExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { resolveColleges } from "@/lib/content";

export const metadata: Metadata = {
  title: "Compare Colleges",
  description:
    "Compare up to 4 colleges side by side on fees, placements, ratings, hostels, accreditation and entrance exams.",
};

export default async function Page() {
  const { data: colleges } = await resolveColleges();
  return (
    <>
      <CompareExplorer colleges={colleges} />
      <AdmissionHelpBanner />
    </>
  );
}
