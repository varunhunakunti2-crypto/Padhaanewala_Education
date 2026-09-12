import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { difficultyOptions, mockTests, type MockTest } from "@/data/mockTests";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return mockTests.map((test) => ({ slug: test.slug }));
}

const difficultyStyles: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

const difficultyLabel = (value: string) =>
  difficultyOptions.find((o) => o.value === value)?.label ?? value;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const test = mockTests.find((t) => t.slug === slug);
  if (!test) return { title: "Mock Test Not Found" };
  return {
    title: `${test.name} — Free ${test.examName} Mock Test`,
    description: `${test.questions} questions, ${test.duration} minutes, ${test.totalMarks} marks. ${test.mode} mode practice for ${test.examName}.`,
  };
}

export default async function MockTestDetailPage({ params }: Props) {
  const { slug } = await params;
  const test = mockTests.find((t) => t.slug === slug);
  if (!test) notFound();

  const relatedTests = mockTests
    .filter((t) => t.slug !== test.slug && t.examName === test.examName)
    .slice(0, 3);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
            <Link href="/mock-tests" className="hover:text-neutral-900">
              Mock tests
            </Link>{" "}
            /{" "}
            <Link href="/mock-tests?exam=all" className="hover:text-neutral-900">
              {test.examName}
            </Link>{" "}
            / <span className="text-neutral-900">{test.name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${difficultyStyles[test.difficulty]}`}
            >
              {difficultyLabel(test.difficulty)}
            </span>
            <span className="inline-flex rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
              {test.mode} mode
            </span>
            <span className="inline-flex rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              {test.examName}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {test.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">{test.subject}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/mock-tests/${test.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Start test now
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
              <ClockIcon className="h-4 w-4" />
              {test.duration} minutes
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">About this test</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              This {test.questions} question {test.subject.toLowerCase()} mock test is designed for
              {test.examName} aspirants. You get {test.duration} minutes to attempt the paper worth{" "}
              {test.totalMarks} marks. Instant score, answers and performance analytics are released
              on submission.
            </p>

            <div className="mt-8 rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <h3 className="text-sm font-bold text-neutral-950">What to expect</h3>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950" />
                  {test.questions} questions with a {test.duration}-minute timer.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950" />
                  Maximum {test.totalMarks} marks, matching the real {test.examName} pattern.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950" />
                  {test.negativeMarking
                    ? `${test.negativePerWrong} mark deducted per wrong answer.`
                    : "No negative marking for wrong answers."}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950" />
                  {test.mode === "Proctored"
                    ? "Proctored mode with live monitoring — exactly like the real exam."
                    : "Standard mode — take it anywhere, any time."}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950" />
                  Up to {test.attemptsAllowed}{" "}
                  {test.attemptsAllowed === 1 ? "attempt" : "attempts"} allowed per user.
                </li>
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
              <h3 className="text-sm font-bold text-neutral-950">Test details</h3>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Exam</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{test.examName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Subject</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{test.subject}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Questions</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{test.questions}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Duration</dt>
                  <dd className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {test.duration} min
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Total marks</dt>
                  <dd className="text-sm font-semibold text-neutral-900">{test.totalMarks}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-neutral-500">Negative marking</dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {test.negativeMarking ? `−${test.negativePerWrong}` : "No"}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {relatedTests.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950">
            More {test.examName} tests
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedTests.map((t: MockTest) => (
              <Link
                key={t.id}
                href={`/mock-tests/${t.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${difficultyStyles[t.difficulty]}`}
                >
                  {difficultyLabel(t.difficulty)}
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-950 group-hover:text-neutral-700">
                  {t.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{t.subject}</p>
                <p className="mt-3 text-xs text-neutral-500">
                  {t.questions} questions · {t.duration} min · {t.totalMarks} marks
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}