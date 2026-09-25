import type { Metadata } from "next";
import ScholarshipsExplorer from "@/components/scholarships/ScholarshipsExplorer";
import { resolveScholarships } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveScholarships();
  return {
    title: "Scholarships",
    description: `Discover ${data.length} merit-based and need-based scholarships for Indian students — national schemes, private foundations and college-specific support.`,
  };
}

export default async function Page() {
  const { data: scholarships } = await resolveScholarships();
  return <ScholarshipsExplorer scholarships={scholarships} />;
}
