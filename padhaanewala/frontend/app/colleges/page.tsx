import type { Metadata } from "next";
import CollegesExplorer from "@/components/college/CollegesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { resolveColleges } from "@/lib/content";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveColleges();
  return {
    title: "Explore Colleges",
    description: `Browse and compare ${data.length.toLocaleString("en-IN")} colleges in India. Filter by course, fees, entrance exam, location, placements and more.`,
  };
}

export default async function Page() {
  const { data: colleges, source } = await resolveColleges();

  return (
    <>
      <CollegesExplorer colleges={colleges} />
      <AdmissionHelpBanner />
      {source === "bundled" ? (
        <p className="mx-auto max-w-7xl px-4 pb-6 text-xs text-gray-500 sm:px-6 lg:px-8">
          Showing cached listings. Live catalogue data is temporarily unavailable.
        </p>
      ) : null}
      <span className="sr-only">{SITE.name}</span>
    </>
  );
}
