import type { Metadata } from "next";
import ScholarshipsExplorer from "@/components/scholarships/ScholarshipsExplorer";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveScholarships } from "@/lib/content";
import { breadcrumbLd, itemListLd, ldGraph, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveScholarships();
  return pageMetadata({
    title: "Scholarships",
    description: `Discover ${data.length} merit-based and need-based scholarships for Indian students — national schemes, private foundations and college-specific support.`,
    path: "/scholarships",
  });
}

export default async function Page() {
  const { data: scholarships } = await resolveScholarships();

  /**
   * Scholarships are addressed by their catalogue id. The route param is named
   * `slug` to match the other detail pages, but it is the record's `id` that
   * `resolveScholarship` looks up.
   */
  const jsonLd = ldGraph([
    itemListLd(
      scholarships.map((scholarship) => ({
        name: scholarship.name,
        path: `/scholarships/${encodeURIComponent(scholarship.id)}`,
      })),
      "Scholarships for Indian Students",
    ),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Scholarships", path: "/scholarships" },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <ScholarshipsExplorer scholarships={scholarships} />
    </>
  );
}
