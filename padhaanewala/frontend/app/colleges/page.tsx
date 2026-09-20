import type { Metadata } from "next";
import CollegesExplorer from "@/components/college/CollegesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";

export const metadata: Metadata = {
  title: "Explore Colleges",
  description:
    "Browse and compare over 1,400 colleges in India. Filter by course, fees, entrance exam, location, placements and more.",
};

export default function Page() {
  return (
    <>
      <CollegesExplorer />
      <AdmissionHelpBanner />
    </>
  );
}