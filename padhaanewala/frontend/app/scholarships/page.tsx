import type { Metadata } from "next";
import ScholarshipsExplorer from "@/components/scholarships/ScholarshipsExplorer";

export const metadata: Metadata = {
  title: "Scholarships",
  description:
    "Discover merit-based and need-based scholarships for Indian students — national schemes, private foundations and college-specific support.",
};

export default function Page() {
  return <ScholarshipsExplorer />;
}