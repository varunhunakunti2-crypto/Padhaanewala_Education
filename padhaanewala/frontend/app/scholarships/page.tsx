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
   * Every item points at `/scholarships` rather than a detail route, because
   * there is no `/scholarships/[slug]` route: `Scholarship` carries no slug and
   * each entry opens in a modal on this page. An `ItemList` whose items are all
   * on the page it describes is a documented pattern, whereas inventing
   * per-item URLs would send a crawler to 404s.
   */
  const jsonLd = ldGraph([
    itemListLd(
      scholarships.map((scholarship) => ({ name: scholarship.name, path: "/scholarships" })),
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
