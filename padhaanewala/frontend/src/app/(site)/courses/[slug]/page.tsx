import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, AwardIcon, BuildingsIcon, ClockIcon, StarIcon } from "@/components/icons";
import { courses } from "@/data/courses";
import { colleges, courseLabel } from "@/data/colleges";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return courses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);
  if (!course) return { title: "Course Not Found" };
  return {
    title: `${course.short} (${course.name}) — Admissions & Colleges`,
    description: course.tagline,
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);
  if (!course) notFound();

  const offeringColleges = colleges.filter((col) => col.courses.includes(course.slug));
  const relatedCourses = courses
    .filter((c) => c.slug !== course.slug && c.category === course.category)
    .slice(0, 3);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/courses" className="hover:text-neutral-900">
              Courses
            </Link>
            <span className="mx-2 text-neutral-300">/</span>
            <span className="text-neutral-900">{course.short}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
              {course.degree}
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              {course.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              {course.duration}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {course.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-neutral-500 sm:text-base">{course.tagline}</p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href="/college-predictor"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Check my eligibility
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
              <BuildingsIcon className="h-4 w-4" />
              Offered by {offeringColleges.length > 0 ? offeringColleges.length : course.colleges}{" "}
              {offeringColleges.length === 1 ? "college" : "colleges"}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">About this course</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              {course.short} ({course.name}) is a {course.duration} undergraduate/professional
              degree in the {course.category} field. Candidates can apply through competitive
              entrance exams and state counselling processes. Admission criteria, fee structures
              and seat availability vary by institution, and verified data for every offering
              college is available on Padhaanewala.
            </p>

            <h2 className="mt-10 text-xl font-bold tracking-tight text-neutral-950">
              Career opportunities
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {course.careers.map((career) => (
                <div
                  key={career}
                  className="flex items-center gap-3 rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3"
                >
                  <AwardIcon className="h-5 w-5 shrink-0 text-neutral-700" />
                  <span className="text-sm font-medium text-neutral-900">{career}</span>
                </div>
              ))}
            </div>

            {relatedCourses.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-bold tracking-tight text-neutral-950">
                  Similar {course.category.toLowerCase()} courses
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {relatedCourses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.slug}`}
                      className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <p className="text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                        {c.short}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">{c.duration}</p>
                      <p className="mt-3 line-clamp-2 text-xs text-neutral-600">{c.tagline}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <h3 className="text-sm font-bold text-neutral-950">At a glance</h3>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Degree</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{course.degree}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Duration</dt>
                  <dd className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {course.duration}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Category</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{course.category}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Colleges offering</dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {course.colleges}+ across India
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {offeringColleges.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">
              Colleges offering {course.short}
            </h2>
            <Link
              href="/colleges"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-950 hover:text-neutral-600"
            >
              View all colleges
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offeringColleges.map((college) => (
              <Link
                key={college.id}
                href={`/college/${college.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                  {college.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{college.location}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700">
                    <StarIcon className="h-4 w-4 text-amber-400" />
                    {college.rating}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {college.placement}
                  </span>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  Fees: <span className="font-semibold text-neutral-900">{college.fees}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {offeringColleges.length === 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-12 text-center">
            <p className="text-base font-semibold text-neutral-900">
              Colleges offering {course.short}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Verified college data is being added. Use the college predictor to start shortlisting.
            </p>
            <Link
              href="/college-predictor"
              className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              {courseLabel(course.slug)} college predictor
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}