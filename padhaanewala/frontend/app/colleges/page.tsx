import type { Metadata } from "next";
import CollegesExplorer from "@/components/college/CollegesExplorer";
import { AdmissionHelpBanner } from "@/components/admission/AdmissionHelpBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveColleges } from "@/lib/content";
import { breadcrumbLd, itemListLd, ldGraph, pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveColleges();
  return pageMetadata({
    title: "Explore Colleges",
    description: `Browse and compare ${data.length.toLocaleString("en-IN")} colleges in India. Filter by course, fees, entrance exam, location, placements and more.`,
    path: "/colleges",
  });
}

export default async function Page() {
  const { data: colleges } = await resolveColleges();

  /**
   * `ItemList` is what turns a filterable catalogue into a ranked answer for a
   * "top colleges" query. It is built from the same array the explorer renders,
   * so the list a crawler reads is the list a visitor sees — including the empty
   * case, where the page says "no colleges are published yet" and the graph says
   * `numberOfItems: 0` rather than inventing entries.
   */
  const jsonLd = ldGraph([
    itemListLd(
      colleges.map((college) => ({ name: college.name, path: `/colleges/${college.slug}` })),
      "Colleges in India",
    ),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Colleges", path: "/colleges" },
    ]),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollegesExplorer colleges={colleges} />
      <AdmissionHelpBanner />
      {colleges.length === 0 ? (
        <p className="mx-auto max-w-7xl px-4 pb-6 text-xs text-gray-500 sm:px-6 lg:px-8">
          No colleges are published yet.
        </p>
      ) : null}
      <span className="sr-only">{SITE.name}</span>
    </>
  );
}
