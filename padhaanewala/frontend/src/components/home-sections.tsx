import Link from "next/link";
import {
  ArrowRightIcon,
  StarIcon,
  BadgeCheckIcon,
  AwardIcon,
  SparklesIcon,
  ClipboardIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { StaggerGroup, StaggerItem } from "@/components/motion";
import {
  popularCourses,
  featuredColleges,
  scholarships,
  upcomingExams,
  mockTests,
  reviews,
  articles,
  type College,
  type Review,
} from "@/data/home";

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
  dark = false,
}: {
  title: string;
  subtitle: string;
  href?: string;
  linkLabel?: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl ${dark ? "text-white" : "text-neutral-950"}`}>
          {title}
        </h2>
        <p className={`mt-2 text-sm sm:text-base ${dark ? "text-neutral-300" : "text-neutral-500"}`}>{subtitle}</p>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className={`hidden items-center gap-1.5 text-sm font-semibold sm:inline-flex ${dark ? "text-white hover:text-neutral-300" : "text-neutral-950 hover:text-neutral-600"}`}
        >
          {linkLabel}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function courseTint(index: number) {
  const tints = [
    "bg-fuchsia-50 border-fuchsia-100",
    "bg-teal-50 border-teal-100",
    "bg-violet-50 border-violet-100",
    "bg-amber-50 border-amber-100",
    "bg-sky-50 border-sky-100",
    "bg-rose-50 border-rose-100",
    "bg-lime-50 border-lime-100",
    "bg-indigo-50 border-indigo-100",
    "bg-orange-50 border-orange-100",
    "bg-cyan-50 border-cyan-100",
  ];
  return tints[index % tints.length];
}

export function PopularCourses() {
  return (
    <section className="mx-auto w-full max-w-[1536px] px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader
        title="Popular courses"
        subtitle="Explore the courses Indian students search the most"
        href="/courses"
        linkLabel="All courses"
      />
      <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {popularCourses.map((course, index) => (
          <StaggerItem key={course.id} className="h-full">
            <Link
              href={`/courses/${course.slug}`}
              className={`block h-full rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${courseTint(index)}`}
            >
              <span className="block text-base font-bold text-neutral-950">
                {course.name}
              </span>
              <span className="mt-1 block text-xs text-neutral-500">{course.tag}</span>
              <span className="mt-3 block text-xs font-medium text-neutral-600">
                {course.colleges} colleges
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

function CollegeCard({ college }: { college: College }) {
  return (
    <Link
      href={`/college/${college.slug}`}
      className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-6 text-neutral-950">
          {college.name}
        </h3>
        {college.verified && (
          <BadgeCheckIcon className="h-5 w-5 shrink-0 text-emerald-600" />
        )}
      </div>
      <p className="mt-1.5 text-sm text-neutral-500">
        {college.type} · {college.location}
      </p>
      <div className="mt-4 flex items-center gap-1 text-sm text-neutral-700">
        <StarIcon className="h-4 w-4 text-amber-400" />
        <span className="font-semibold">{college.rating}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4">
        <div>
          <dt className="text-xs text-neutral-500">Annual Fees</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
            {college.fees}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Placement</dt>
          <dd className="mt-0.5 text-sm font-semibold text-emerald-700">
            {college.placement}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function FeaturedColleges() {
  return (
    <section className="bg-neutral-50 py-14">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Featured colleges"
          subtitle="Verified colleges with fee, placement and NIRF data"
          href="/colleges"
          linkLabel="All colleges"
        />
        <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredColleges.map((college) => (
            <StaggerItem key={college.id} className="h-full">
              <CollegeCard college={college} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function Scholarships() {
  return (
    <section className="mx-auto w-full max-w-[1536px] px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader
        title="Scholarships"
        subtitle="Apply before deadlines and reduce your education cost"
        href="/scholarships"
        linkLabel="All scholarships"
      />
      <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scholarships.map((s) => (
          <StaggerItem key={s.id} className="h-full">
            <Link
              href={`/scholarships/${s.slug}`}
              className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <AwardIcon className="h-7 w-7 text-amber-500" />
              <h3 className="mt-4 text-base font-semibold leading-6 text-neutral-950">
                {s.name}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">{s.provider}</p>
              <div className="mt-4 flex items-end justify-between gap-2 border-t border-black/5 pt-4">
                <div>
                  <p className="text-xs text-neutral-500">Scholarship amount</p>
                  <p className="text-sm font-bold text-emerald-700">{s.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Deadline</p>
                  <p className="text-sm font-medium text-neutral-800">{s.deadline}</p>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

export function UpcomingExams() {
  return (
    <section className="bg-neutral-50 py-14">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Upcoming examinations"
          subtitle="Dates, notifications and counselling schedules"
          href="/exams"
          linkLabel="All exams"
        />
        <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {upcomingExams.map((exam) => (
            <StaggerItem key={exam.id} className="h-full">
              <Link
                href={`/exams/${exam.slug}`}
                className="block h-full rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {exam.status}
                </span>
                <h3 className="mt-4 text-base font-semibold text-neutral-950">
                  {exam.name}
                </h3>
                <p className="mt-2 text-sm text-neutral-500">Exam date: {exam.date}</p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function MockTests() {
  return (
    <section className="mx-auto w-full max-w-[1536px] px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader
        title="Mock tests"
        subtitle="Take standard and proctored tests on laptop or desktop"
        href="/mock-tests"
        linkLabel="All tests"
      />
      <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mockTests.map((test) => (
          <StaggerItem key={test.id} className="h-full">
            <Link
              href={`/mock-tests/${test.slug}`}
              className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <ClipboardIcon className="h-6 w-6 text-indigo-600" />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    test.mode === "Proctored"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-sky-50 text-sky-700"
                  }`}
                >
                  {test.mode}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-neutral-950">
                {test.name}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                {test.questions} questions · {test.duration} min
              </p>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
      <p className="mt-4 text-xs text-neutral-500">
        Mock tests require a laptop or desktop computer with a modern browser.
      </p>
    </section>
  );
}

export function WhyPadhaanewala() {
  const reasons = [
    {
      title: "Verified data",
      text: "Every college, course, fee and placement claim shows its source and verification date.",
    },
    {
      title: "AI college predictor",
      text: "Rank-based predictions from real historical cutoffs, not guesses.",
    },
    {
      title: "Free mock tests",
      text: "Exam-realistic tests with secure proctoring for practice under real conditions.",
    },
    {
      title: "Counsellor support",
      text: "Free admission assistance from expert counsellors on WhatsApp and phone.",
    },
  ];
  return (
    <section className="bg-neutral-950 py-14 text-white">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Why Padhaanewala"
          subtitle="Built for students, trusted by parents"
          dark={true}
        />
        <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <StaggerItem key={reason.title} className="h-full">
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                <span className="text-sm font-bold text-neutral-500">
                  0{reasons.indexOf(reason) + 1}
                </span>
                <h3 className="mt-3 text-base font-semibold">{reason.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {reason.text}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

const avatarBgClasses = [
  "bg-purple-100 text-purple-700",
  "bg-indigo-100 text-indigo-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          className={`h-4 w-4 ${
            i <= Math.round(rating)
              ? "text-amber-400 fill-amber-400"
              : "text-neutral-200 fill-neutral-200"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const initial = review.name ? review.name.trim().charAt(0).toUpperCase() : "S";
  const avatarStyle = avatarBgClasses[index % avatarBgClasses.length];

  return (
    <figure className="w-[310px] sm:w-[340px] shrink-0 flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white dark:bg-neutral-900/90 dark:border-white/10 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-neutral-300 dark:hover:border-white/20">
      <div>
        {/* Top Profile Row: Avatar + Name & Title */}
        <div className="flex items-center gap-3">
          {review.avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={review.avatar}
              alt={review.name}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-neutral-100 dark:ring-neutral-800"
            />
          ) : (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-base ${avatarStyle}`}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {review.name}
            </h4>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {review.role || `${review.course} · ${review.college}`}
            </p>
          </div>
        </div>

        {/* Horizontal Divider Line */}
        <hr className="my-3.5 border-t border-neutral-100 dark:border-white/10" />

        {/* Rating Row: Numeric Rating + Stars */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
            {review.rating.toFixed(1)}
          </span>
          <Stars rating={review.rating} />
        </div>

        {/* Review Body Text */}
        <blockquote className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300 line-clamp-3">
          {review.text}
        </blockquote>
      </div>
    </figure>
  );
}

export function StudentReviews() {
  const row1 = reviews.slice(0, Math.ceil(reviews.length / 2));
  const row2 = reviews.slice(Math.ceil(reviews.length / 2));

  // Duplicated sets for smooth 100% infinite marquee loop
  const row1Items = [...row1, ...row1];
  const row2Items = [...row2, ...row2];

  return (
    <section className="mx-auto w-full max-w-[1536px] px-4 py-14 sm:px-6 lg:px-8 overflow-hidden">
      <SectionHeader
        title="What students say"
        subtitle="Real experiences from the Padhaanewala community"
      />
      <div className="relative mt-8 flex flex-col gap-6 overflow-hidden py-2">
        {/* Left & Right Gradient Fade Masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-r from-white dark:from-[#0a0a0a] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-l from-white dark:from-[#0a0a0a] to-transparent" />

        {/* Upper Cards - Moving to the LEFT */}
        <div className="flex overflow-hidden">
          <div className="animate-marquee-left flex gap-5">
            {row1Items.map((review, idx) => (
              <ReviewCard key={`r1-${review.id}-${idx}`} review={review} index={idx} />
            ))}
          </div>
        </div>

        {/* Down Cards - Moving to the RIGHT */}
        <div className="flex overflow-hidden">
          <div className="animate-marquee-right flex gap-5">
            {row2Items.map((review, idx) => (
              <ReviewCard key={`r2-${review.id}-${idx}`} review={review} index={idx + row1.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LatestArticles() {
  return (
    <section className="bg-neutral-50 py-14">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Latest education articles"
          subtitle="Guides on admissions, counselling, exams and careers"
          href="/blog"
          linkLabel="All articles"
        />
        <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((article) => (
            <StaggerItem key={article.id} className="h-full">
              <Link
                href={`/blog/${article.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                  {article.category}
                </span>
                <h3 className="mt-3 text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-600">
                  {article.title}
                </h3>
                <span className="mt-auto pt-4 text-xs text-neutral-500">
                  {article.readTime}
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function AdmissionCta() {
  return (
    <section className="mx-auto w-full max-w-[1536px] px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-fuchsia-600 to-violet-700 px-6 py-10 text-white sm:px-10 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Confused about admissions?
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            Our counsellors will help you choose the right college and course
            based on your rank, budget and preferences — free of cost.
            <SparklesIcon className="ml-1 inline h-4 w-4" />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <a
            href="https://wa.me/919000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 text-sm font-bold text-white transition-all hover:bg-white/20"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Chat on WhatsApp
          </a>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-neutral-950 transition-transform hover:scale-105"
          >
            Get Admission Help
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}