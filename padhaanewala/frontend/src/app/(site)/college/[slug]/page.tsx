import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import { colleges, courseLabel, stateName } from "@/data/colleges";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return colleges.map((college) => ({ slug: college.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const college = colleges.find((c) => c.slug === slug);
  if (!college) return { title: "College Not Found" };
  return {
    title: `${college.name} — Fees, Placements & Admissions`,
    description: `${college.name} in ${college.location}. Fees ${college.fees}, ${college.placement}. Check admissions, courses and verified reviews.`,
  };
}

export default async function CollegeDetailPage({ params }: Props) {
  const { slug } = await params;
  const college = colleges.find((c) => c.slug === slug);
  if (!college) notFound();

  const similarColleges = colleges
    .filter(
      (c) => c.slug !== college.slug && (c.stateCode === college.stateCode || c.type === college.type)
    )
    .slice(0, 3);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/colleges" className="hover:text-neutral-900">
              Colleges
            </Link>{" "}
            / <Link href={`/colleges?state=${college.stateCode}`} className="hover:text-neutral-900">
              {stateName(college.stateCode)}
            </Link>{" "}
            / <span className="text-neutral-900">{college.name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
              {college.type}
            </span>
            {college.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheckIcon className="h-3.5 w-3.5" />
                Verified data
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <StarIcon className="h-3.5 w-3.5 text-amber-400" />
              {college.rating} rating
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {college.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">{college.location}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {college.placement}
            </span>
            <span className="text-sm text-neutral-500">
              Annual fees:{" "}
              <span className="font-semibold text-neutral-900">{college.fees}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {college.courses.length > 0 && (
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">
              Courses offered
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {college.courses.map((courseSlug) => (
                <Link
                  key={courseSlug}
                  href={`/courses/${courseSlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
                >
                  {courseLabel(courseSlug)}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">Quick facts</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-5">
              <dt className="text-xs text-neutral-500">Annual fees</dt>
              <dd className="mt-1 text-base font-bold text-neutral-950">{college.fees}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-5">
              <dt className="text-xs text-neutral-500">Placements</dt>
              <dd className="mt-1 text-base font-bold text-neutral-950">{college.placement}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-5">
              <dt className="text-xs text-neutral-500">Hostel</dt>
              <dd className="mt-1 text-base font-bold text-neutral-950">
                {college.hasHostel ? "Available" : "Not available"}
              </dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-5">
              <dt className="text-xs text-neutral-500">State</dt>
              <dd className="mt-1 text-base font-bold text-neutral-950">
                {stateName(college.stateCode)}
              </dd>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-neutral-700" />
              <h3 className="text-sm font-bold text-neutral-950">Admission assistance</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Get end-to-end help with applications, fee structure clarification and counselling
              for {college.name}. Entry requirements vary by course — check the course pages or
              talk to our counsellors for free.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Free counselling
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-neutral-700" />
              <h3 className="text-sm font-bold text-neutral-950">Admission calendar</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Admission windows for every course at {college.name} are published on the course and
              exam pages. Follow the relevant entrance exam page for application and counselling
              dates.
            </p>
            <Link
              href="/exams"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-950 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              View exams
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {similarColleges.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">Similar colleges</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similarColleges.map((c) => (
              <Link
                key={c.id}
                href={`/college/${c.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                    {c.name}
                  </p>
                  {c.verified && <BadgeCheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />}
                </div>
                <p className="mt-1 text-xs text-neutral-500">{c.location}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700">
                    <StarIcon className="h-4 w-4 text-amber-400" />
                    {c.rating}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {c.placement}
                  </span>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  Fees: <span className="font-semibold text-neutral-900">{c.fees}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}