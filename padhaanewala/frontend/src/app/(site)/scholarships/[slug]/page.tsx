import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, AwardIcon } from "@/components/icons";
import { scholarships, type Scholarship } from "@/data/scholarships";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return scholarships.map((s) => ({ slug: s.slug }));
}

const ownershipStyles: Record<string, string> = {
  government: "bg-emerald-50 text-emerald-700",
  private: "bg-violet-50 text-violet-700",
};

const ownershipLabel: Record<string, string> = {
  government: "Government",
  private: "Private",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const scholarship = scholarships.find((s) => s.slug === slug);
  if (!scholarship) return { title: "Scholarship Not Found" };
  return {
    title: `${scholarship.name} — ${scholarship.amount}`,
    description: `${scholarship.name} by ${scholarship.provider}. ${scholarship.amount}. Apply by ${scholarship.deadline}.`,
  };
}

export default async function ScholarshipDetailPage({ params }: Props) {
  const { slug } = await params;
  const scholarship = scholarships.find((s) => s.slug === slug);
  if (!scholarship) notFound();

  const relatedScholarships = scholarships
    .filter(
      (s) => s.slug !== scholarship.slug && (s.category === scholarship.category || s.ownership === scholarship.ownership)
    )
    .slice(0, 3);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/scholarships" className="hover:text-neutral-900">
              Scholarships
            </Link>{" "}
            / <span className="text-neutral-900">{scholarship.name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ownershipStyles[scholarship.ownership]}`}
            >
              {ownershipLabel[scholarship.ownership]}
            </span>
            <span className="inline-flex rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              {scholarship.category}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {scholarship.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">
            Offered by {scholarship.provider}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700">
              <AwardIcon className="h-4 w-4" />
              {scholarship.amount}
            </span>
            <span className="text-sm text-neutral-500">
              Apply by <span className="font-semibold text-neutral-900">{scholarship.deadline}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">Eligibility</h2>
            <div className="mt-4 rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <p className="text-sm leading-7 text-neutral-700">{scholarship.eligibility}</p>
            </div>

            <h2 className="mt-10 text-xl font-bold tracking-tight text-neutral-950">
              How to apply
            </h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              Applications for {scholarship.name} are accepted until{" "}
              {scholarship.deadline}. Keep your Class 12 marksheet, income certificate
              {scholarship.ownership === "government" ? " and Aadhaar" : ""} ready before
              applying. Follow the official portal of {scholarship.provider} to submit the
              application before the deadline to avoid rejection.
            </p>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              Padhaanewala tracks verified scholarship deadlines for{" "}
              {scholarship.category.toLowerCase()} students — subscribe on the scholarships page to
              get deadline reminders in time.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="https://scholarships.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Apply online
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/scholarships"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-950 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
              >
                All scholarships
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <h3 className="text-sm font-bold text-neutral-950">Scholarship details</h3>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Provider</dt>
                  <dd className="text-right text-sm font-semibold text-neutral-900">
                    {scholarship.provider}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Amount</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{scholarship.amount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Category</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{scholarship.category}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Deadline</dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {scholarship.deadline}
                  </dd>
                </div>
                {scholarship.stateCode && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-neutral-500">State</dt>
                    <dd className="text-sm font-semibold text-neutral-900">
                      {scholarship.stateCode}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {relatedScholarships.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">
            Related scholarships
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedScholarships.map((s: Scholarship) => (
              <Link
                key={s.id}
                href={`/scholarships/${s.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${ownershipStyles[s.ownership]}`}
                >
                  {ownershipLabel[s.ownership]}
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                  {s.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{s.provider}</p>
                <p className="mt-3 text-xs text-neutral-500">
                  {s.amount} · Apply by{" "}
                  <span className="font-semibold text-neutral-800">{s.deadline}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}