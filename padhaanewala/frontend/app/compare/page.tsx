import type { Metadata } from "next";
import CompareExplorer from "@/components/compare/CompareExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveColleges } from "@/lib/content";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Compare Colleges",
  description:
    "Compare up to 4 colleges side by side on fees, placements, ratings, hostels, accreditation and entrance exams.",
  path: "/compare",
});

export default async function Page() {
  const { data: colleges } = await resolveColleges();

  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <CompareExplorer colleges={colleges} />
      <AdmissionHelpBanner />
    </>
  );
}
