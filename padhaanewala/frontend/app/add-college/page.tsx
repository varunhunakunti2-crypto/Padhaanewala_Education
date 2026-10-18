import type { Metadata } from "next";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { SuggestCollegePanel } from "@/components/college/SuggestCollegePanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";

/**
 * The college owner's "add your college" page.
 *
 * This is the entry point `ACCOUNT_NAV` points at — the one account-only link
 * in the dashboard sidebar. The heavy lifting is the same student submission
 * workflow behind `/suggest-college` (which now redirects here): a signed-in
 * owner files a `college-submission` row, a reviewer approves it, and only then
 * does the college reach the public catalogue. Students never write to
 * `colleges` directly; that endpoint is admin-gated on purpose.
 *
 * Behind `RequireAuth` because a submission is tied to the account that made it
 * — it is the only way to edit or withdraw one, and the backend scopes the read
 * to `submitted_by`. `noindex`: the page is a signed-in tool with no content a
 * crawler should rank.
 */
export const metadata: Metadata = pageMetadata({
  title: "Add Your College",
  description:
    "College owner or representative? Add your college to Padhaanewala. Every submission is reviewed by our team before it is published.",
  path: "/add-college",
  noindex: true,
});

export default function AddCollegePage() {
  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Colleges", path: "/colleges" },
      { name: "Add Your College", path: "/add-college" },
    ]),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <JsonLd data={jsonLd} />
      <div className="mb-8 max-w-2xl">
        <SectionHeading
          eyebrow="For college owners and representatives"
          title="Add Your College"
          description="Run a college that is missing from Padhaanewala? Add it here. Every submission is checked by a person before it is published, so nothing you send goes live on its own — and you can track its status from this page."
          align="left"
        />
      </div>
      <RequireAuth>
        <SuggestCollegePanel />
      </RequireAuth>
    </section>
  );
}
