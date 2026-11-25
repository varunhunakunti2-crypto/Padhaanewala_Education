import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { ScholarshipDetail } from "@/components/scholarships/ScholarshipDetail";
import { ButtonLink } from "@/components/ui/Button";
import { resolveScholarship } from "@/lib/content";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: scholarship } = await resolveScholarship(slug);
  if (!scholarship) {
    return pageMetadata({
      title: "Scholarship not found",
      description: "This scholarship is not in the padhaanewala catalogue.",
      path: `/scholarships/${encodeURIComponent(slug)}`,
      noindex: true,
    });
  }
  return pageMetadata({
    title: `${scholarship.name} — Scholarship Details`,
    description: `${scholarship.provider}: ${scholarship.eligibility}`,
    path: `/scholarships/${encodeURIComponent(scholarship.id)}`,
    type: "article",
  });
}

export default async function ScholarshipDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { data: scholarship } = await resolveScholarship(slug);
  if (!scholarship) notFound();

  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Scholarships", path: "/scholarships" },
      { name: scholarship.name, path: `/scholarships/${encodeURIComponent(scholarship.id)}` },
    ]),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <JsonLd data={jsonLd} />

      <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-purple-700">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/scholarships" className="hover:text-purple-700">Scholarships</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-medium text-purple-700">{scholarship.name}</span>
      </nav>

      <div className="rounded-3xl border border-orange-100 bg-white p-6 sm:p-8">
        <ScholarshipDetail sch={scholarship} titleAs="h1" />
      </div>

      <div className="mt-6">
        <ButtonLink href="/scholarships" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" /> Back to all scholarships
        </ButtonLink>
      </div>
    </div>
  );
}
