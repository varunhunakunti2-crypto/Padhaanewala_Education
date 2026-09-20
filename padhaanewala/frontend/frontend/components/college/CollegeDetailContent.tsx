import {
  MapPin,
  Star,
  GraduationCap,
  Users,
  CalendarDays,
  Award,
  TrendingUp,
  Briefcase,
  Building2,
  BedDouble,
  Wifi,
  Dumbbell,
  BookOpen,
  FlaskConical,
  Coffee,
  Bus,
  HeartPulse,
  Mic2,
  FileCheck2,
  CheckCircle2,
  BadgeCheck,
  Scale,
  Wallet,
  Clock,
  IndianRupee,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { College } from "@/lib/types";
import { formatINR, formatINRFull, formatCount, BANNER_GRADIENTS, matchScore } from "@/lib/utils";
import { getSimilarColleges } from "@/lib/data/colleges";
import { CampusArt, CollegeLogo } from "@/components/college/CampusArt";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import {
  CollegeActions,
  StickyMobileActions,
  FaqAccordion,
  SimilarColleges,
  ViewTracker,
  HelpfulButton,
} from "./CollegeDetailClient";

const FACILITY_META: { key: keyof College["facilities"]; label: string; icon: typeof Wifi }[] = [
  { key: "hostel", label: "Hostel", icon: BedDouble },
  { key: "library", label: "Library", icon: BookOpen },
  { key: "labs", label: "Laboratories", icon: FlaskConical },
  { key: "wifi", label: "Wi-Fi Campus", icon: Wifi },
  { key: "sports", label: "Sports", icon: Trophy },
  { key: "gym", label: "Gymnasium", icon: Dumbbell },
  { key: "cafeteria", label: "Cafeteria", icon: Coffee },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "medical", label: "Medical Care", icon: HeartPulse },
  { key: "auditorium", label: "Auditorium", icon: Mic2 },
];

function AnchorNav({ college }: { college: College }) {
  const anchors = [
    { id: "overview", label: "Overview" },
    { id: "courses", label: "Courses & Fees" },
    { id: "admission", label: "Admission" },
    { id: "placements", label: "Placements" },
    { id: "facilities", label: "Campus & Facilities" },
    { id: "scholarships", label: "Scholarships" },
    { id: "reviews", label: "Reviews" },
    { id: "faq", label: "FAQs" },
  ];
  void college;
  return (
    <nav
      aria-label="College sections"
      className="no-scrollbar sticky top-[68px] z-30 -mx-4 mt-6 overflow-x-auto border-y border-purple-100/70 bg-white/90 px-4 backdrop-blur lg:top-[78px]"
    >
      <ul className="flex gap-1 whitespace-nowrap py-2.5">
        {anchors.map((a) => (
          <li key={a.id}>
            <a
              href={`#${a.id}`}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-purple-50 hover:text-purple-700"
            >
              {a.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function QuickFacts({ college }: { college: College }) {
  const minFee = Math.min(...college.courses.map((c) => c.feePerYear));
  return (
    <dl className="space-y-4">
      {[
        { label: "Established", value: String(college.founded), icon: CalendarDays },
        { label: "Type", value: college.type, icon: Building2 },
        { label: "Students", value: formatCount(college.studentCount), icon: Users },
        { label: "Faculty", value: formatCount(college.facultyCount), icon: GraduationCap },
        { label: "Approx. fees", value: `${formatINR(minFee)}/yr onwards`, icon: IndianRupee },
        { label: "Avg. package", value: `${formatINR(college.placement.averagePackage)}`, icon: TrendingUp },
        { label: "Placement rate", value: `${college.placement.placementRate}% (${college.placement.year})`, icon: Briefcase },
      ].map((f) => (
        <div key={f.label} className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600">
            <f.icon className="h-4 w-4" />
          </span>
          <div>
            <dt className="text-xs font-medium text-gray-400">{f.label}</dt>
            <dd className="text-sm font-semibold text-gray-900 tabular-nums">{f.value}</dd>
          </div>
        </div>
      ))}
      <li className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <dt className="text-xs font-medium text-gray-400">Address</dt>
          <dd className="text-sm font-semibold text-gray-900">
            {college.city}, {college.state} — {college.pincode}
          </dd>
        </div>
      </li>
    </dl>
  );
}

function HeroInfo({ college }: { college: College }) {
  return (
    <section className="relative isolate">
      <CampusArt
        gradientId={college.gradientId}
        initials={college.initials}
        className="h-44 w-full sm:h-60 lg:h-72"
        ariaLabel={`${college.shortName} campus`}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-12 rounded-t-2xl bg-white px-5 pb-5 pt-4 ring-1 ring-purple-100/60 sm:rounded-2xl sm:px-7 md:-mt-16">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <CollegeLogo
                initials={college.initials}
                gradientId={college.gradientId}
                size="lg"
                className="-mt-8 ring-4 ring-white md:-mt-12 md:h-20 md:w-20 md:text-xl"
              />
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  {college.name}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{college.tagline}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <MapPin className="h-4 w-4 text-purple-500" />
                    {college.city}, {college.state}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{college.sector}</span>
                  <span className="text-gray-300">•</span>
                  <span>{college.type}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="match-badge rounded-full px-2.5 py-0.5 font-accent text-[11px] font-bold">
                    {matchScore(college.id)}% Match for you
                  </span>
                  <Rating value={college.rating} showValue />
                  <span className="text-xs text-gray-400">
                    {formatCount(college.reviewCount)} reviews
                  </span>
                  {college.rankings.slice(0, 2).map((r) => (
                    <Badge key={r.agency} variant="amber">
                      <Award className="h-3 w-3" /> {r.agency} #{r.rank}
                    </Badge>
                  ))}
                  {college.accreditation.slice(0, 2).map((a) => (
                    <Badge key={a} variant="green">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden flex-col gap-2 lg:flex">
              <CollegeActions collegeId={college.id} shortName={college.shortName} className="w-52" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoursesFees({ college }: { college: College }) {
  return (
    <section id="courses" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<GraduationCap className="h-5 w-5" />}
        title="Courses & Programs"
        subtitle="Popular programs, seats and annual fees"
      />
      <div className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-purple-100/60 card-shadow">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-purple-50/50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3.5">Program</th>
                <th className="px-5 py-3.5">Degree</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Seats</th>
                <th className="px-5 py-3.5 text-right">Annual Fee</th>
              </tr>
            </thead>
            <tbody>
              {college.courses.map((course) => (
                <tr key={course.name} className="border-b border-gray-50 last:border-0 hover:bg-purple-50/30">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{course.name}</p>
                    {course.tag && <Badge variant="yellow" className="mt-1">{course.tag}</Badge>}
                  </td>
                  <td className="px-5 py-4 text-gray-600">{course.degree}</td>
                  <td className="px-5 py-4 text-gray-600">{course.duration}</td>
                  <td className="px-5 py-4 text-gray-600 tabular-nums">{course.seats}</td>
                  <td className="px-5 py-4 text-right font-semibold text-purple-700 tabular-nums">
                    {formatINR(course.feePerYear)}/yr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-xs text-gray-500">
          * Fees are indicative for the current academic year. Hostel and mess charges are extra.
        </p>
      </div>
    </section>
  );
}

function Admissions({ college }: { college: College }) {
  return (
    <section id="admission" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<FileCheck2 className="h-5 w-5" />}
        title="Admission Process & Eligibility"
        subtitle="How to apply, what you need, and expected cutoffs"
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            <Clock className="h-4 w-4 text-blue-500" /> Process
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{college.admission.process}</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            Application deadline:{" "}
            <span className="font-bold">
              {new Date(college.admission.applicationDeadline + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Application fee: {formatINRFull(college.admission.applicationFee)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Eligibility
          </h3>
          <ul className="mt-3 space-y-3">
            {college.admission.eligibility.map((e) => (
              <li key={e.program} className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{e.program}:</span> {e.criteria}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
          <FileCheck2 className="h-4 w-4 text-orange-500" /> Entrance exams accepted
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {college.admission.entranceExams.map((exam) => (
            <Badge key={exam} variant="orange" className="text-sm px-3.5 py-1">
              {exam}
            </Badge>
          ))}
        </div>
        {college.admission.cutoffs.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
              <Scale className="h-4 w-4 text-blue-500" /> Recent cutoffs
            </h3>
            <div className="mt-3 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="py-2.5 pr-4">Program</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5">Cutoff</th>
                  </tr>
                </thead>
                <tbody>
                  {college.admission.cutoffs.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 font-semibold text-gray-700">{c.program}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{c.category}</td>
                      <td className="py-2.5 font-bold text-purple-700 tabular-nums">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Placements({ college }: { college: College }) {
  const p = college.placement;
  const stats = [
    { label: "Placement rate", value: `${p.placementRate}%`, icon: Briefcase, tone: "text-purple-700 bg-purple-50" },
    { label: "Highest package", value: formatINR(p.highestPackage), icon: TrendingUp, tone: "text-amber-700 bg-amber-50" },
    { label: "Average package", value: formatINR(p.averagePackage), icon: Wallet, tone: "text-blue-700 bg-blue-50" },
    { label: "Companies visited", value: formatCount(p.companiesVisited), icon: Building2, tone: "text-orange-700 bg-orange-50" },
  ];
  return (
    <section id="placements" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<TrendingUp className="h-5 w-5" />}
        title="Placements"
        subtitle={`Placement statistics for the ${p.year} batch`}
      />
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${s.tone}`}>
              <s.icon className="h-4.5 w-4.5" />
            </span>
            <p className="font-display mt-3 text-2xl font-extrabold text-gray-900 tabular-nums">{s.value}</p>
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Top recruiters</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.topRecruiters.map((r) => (
            <Badge key={r} variant="purple" className="px-3 py-1 text-sm">
              {r}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}

function Facilities({ college }: { college: College }) {
  return (
    <section id="facilities" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<Building2 className="h-5 w-5" />}
        title="Campus & Facilities"
        subtitle="Infrastructure available on campus"
      />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FACILITY_META.map((f) => {
          const available = college.facilities[f.key];
          return (
            <div
              key={f.key}
              className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${
                available
                  ? "bg-white ring-emerald-200/70 card-shadow"
                  : "bg-gray-50 ring-gray-100 opacity-60"
              }`}
            >
              <f.icon className={`h-5 w-5 ${available ? "text-emerald-500" : "text-gray-400"}`} />
              <div>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className={`text-xs ${available ? "text-emerald-600" : "text-gray-400"}`}>
                  {available ? "Available" : "Not available"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 p-6 ring-1 ring-purple-100/60">
        <p className="text-sm text-gray-600">
          <span className="font-display font-bold text-purple-800">{college.studentCount.toLocaleString("en-IN")} students</span>{" "}
          enrolled across programs, supported by{" "}
          <span className="font-display font-bold text-blue-800">{college.facultyCount.toLocaleString("en-IN")} faculty members</span>{" "}
          and a {college.founded ? `${new Date().getFullYear() - college.founded}-year` : ""}-old legacy of academic excellence.
        </p>
      </div>
    </section>
  );
}

function Scholarships({ college }: { college: College }) {
  return (
    <section id="scholarships" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<Award className="h-5 w-5" />}
        title="Scholarships"
        subtitle="Financial support available for meritorious students"
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {college.scholarships.map((s) => (
          <div key={s} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-orange-200/60 card-shadow">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500">
              <Award className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-semibold text-gray-800">{s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reviews({ college }: { college: College }) {
  const avg = college.reviews.reduce((acc, r) => acc + r.rating, 0) / Math.max(college.reviews.length, 1);
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: college.reviews.filter((r) => Math.round(r.rating) === star).length / Math.max(college.reviews.length, 1),
  }));
  return (
    <section id="reviews" className="scroll-mt-28 py-8">
      <SectionTitle
        icon={<Star className="h-5 w-5" />}
        title="Student Reviews"
        subtitle={`Based on ${formatCount(college.reviewCount)} verified reviews`}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow lg:sticky lg:top-36">
          <div className="flex items-end gap-3">
            <span className="font-display text-5xl font-extrabold text-amber-600 tabular-nums">
              {avg.toFixed(1)}
            </span>
            <div className="pb-1">
              <Rating value={avg} />
              <p className="mt-1 text-xs text-gray-400">{formatCount(college.reviewCount)} reviews overall</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {breakdown.map((b) => (
              <div key={b.star} className="flex items-center gap-2">
                <span className="w-3 text-xs font-semibold text-gray-600 tabular-nums">{b.star}</span>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.max(b.pct * 100, 4)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-gray-400">{Math.round(b.pct * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {college.reviews.map((r) => (
            <article key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-purple-100/60 card-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${BANNER_GRADIENTS[college.gradientId]}`}
                  >
                    {r.initials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {r.author}
                      {r.verified && <BadgeCheck className="ml-1.5 inline h-3.5 w-3.5 text-blue-500" />}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.role} · {r.program}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Rating value={r.rating} />
                  <p className="mt-1 text-[11px] text-gray-400">{r.date}</p>
                </div>
              </div>
              <h3 className="mt-3 text-sm font-bold text-gray-800">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{r.body}</p>
              <HelpfulButton count={r.helpful} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Overview({ college }: { college: College }) {
  return (
    <section id="overview" className="scroll-mt-28 py-8">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-purple-950 lg:text-3xl">
        Overview
      </h2>
      <p className="mt-4 text-[15px] leading-7 text-gray-600">{college.overview}</p>
      <p className="mt-3 text-[15px] leading-7 text-gray-600">
        Established in {college.founded}, {college.shortName} is a {college.sector.toLowerCase()} {college.type.toLowerCase()}{" "}
        located in {college.city}, {college.state}. The institute is well regarded for {college.tagline.toLowerCase()}.
      </p>
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight text-purple-950 lg:text-3xl">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600">{icon}</span>
        {title}
      </h2>
      <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function Breadcrumb({ college }: { college: College }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <li><Link href="/" className="hover:text-purple-700">Home</Link></li>
        <li>/</li>
        <li><Link href="/colleges" className="hover:text-purple-700">Colleges</Link></li>
        <li>/</li>
        <li><Link href={`/colleges?state=${encodeURIComponent(college.state)}`} className="hover:text-purple-700">{college.state}</Link></li>
        <li>/</li>
        <li aria-current="page" className="font-medium text-gray-700">{college.shortName}</li>
      </ol>
    </nav>
  );
}

function FacultyNote({ college }: { college: College }) {
  return (
    <section id="faculty" className="scroll-mt-28 py-4">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 to-blue-700 p-6 text-white card-shadow-lg">
        <h2 className="font-display text-xl font-bold">Faculty & Academics</h2>
        <p className="mt-2 text-sm leading-relaxed text-purple-100">
          {college.shortName} employs over <span className="font-bold text-white">{formatCount(college.facultyCount)}</span>{" "}
          faculty members across departments, many with doctoral degrees from leading institutions. Small mentoring groups,
          semester-long projects and active research labs are core to the academic culture.
        </p>
      </div>
    </section>
  );
}

export default function CollegeDetailContent({ college }: { college: College }) {
  const similar = getSimilarColleges(college);
  return (
    <div className="pb-8">
      <ViewTracker collegeId={college.id} />
      <Breadcrumb college={college} />
      <HeroInfo college={college} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnchorNav college={college} />
        <div className="flex gap-10">
          <div className="min-w-0 flex-1">
            <Overview college={college} />
            <FacultyNote college={college} />
            <CoursesFees college={college} />
            <Admissions college={college} />
            <Placements college={college} />
            <Facilities college={college} />
            <Scholarships college={college} />
            <Reviews college={college} />
            <FaqAccordion faqs={college.faqs} />
            <SimilarColleges colleges={similar} />
          </div>

          <aside className="hidden w-[19rem] shrink-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl bg-white p-6 ring-1 ring-purple-100/60 card-shadow">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">Quick facts</h3>
                <QuickFacts college={college} />
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 text-white shadow-lg shadow-orange-500/25">
                <p className="font-display text-lg font-extrabold">Get admission assistance</p>
                <p className="mt-1 text-sm text-orange-50">
                  Talk to counsellors about fees, loans and deadlines for {college.shortName}.
                </p>
                <a
                  href="#"
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-white font-bold text-orange-600 transition hover:bg-orange-50"
                >
                  Book a free call
                </a>
              </div>
              <CollegeActions collegeId={college.id} shortName={college.shortName} />
            </div>
          </aside>
        </div>
      </div>
      <StickyMobileActions collegeId={college.id} shortName={college.shortName} />
    </div>
  );
}