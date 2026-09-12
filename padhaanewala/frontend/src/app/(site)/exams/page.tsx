import Link from "next/link";
import ExamCard from "@/components/exams/ExamCard";
import ExamFilters from "@/components/exams/ExamFilters";
import Pagination from "@/components/colleges/Pagination";
import { examStatus, exams } from "@/data/exams";

export const metadata = {
  title: "Entrance Exams in India",
  description:
    "Track JEE, NEET, CUET, KCET and state entrance exams — dates, deadlines, results and application status.",
};

const PAGE_SIZE = 9;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const examType = first(sp.examType);
  const status = first(sp.status);
  const sort = first(sp.sort) || "date";
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  let results = exams.filter((exam) => {
    if (examType && exam.examType !== examType) return false;
    if (status && examStatus(exam) !== status) return false;
    if (q) {
      const haystack = [exam.name, exam.conductingAuthority, exam.mode]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "name") {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results = [...results].sort((a, b) =>
      a.examDateISO.localeCompare(b.examDateISO),
    );
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  const cleanParams = new URLSearchParams();
  if (q) cleanParams.set("q", q);
  if (examType) cleanParams.set("examType", examType);
  if (status) cleanParams.set("status", status);
  if (sort) cleanParams.set("sort", sort);
  const basePath = `?${cleanParams.toString()}`;

  const activeFilters = [
    q ? `“${q}”` : "",
    examType ? `type: ${examType}` : "",
    status ? `status: ${status}` : "",
  ].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Entrance Exams in India
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Important dates, application deadlines and result schedules for
            national and state-level entrance exams.
          </p>
          <div className="mt-7">
            <ExamFilters
              current={{ q, examType, status, sort }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0
              ? "No exams found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} exams`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">
              Filters: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No exams found
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try a different search or reset the filters.
            </p>
            <Link
              href="/exams"
              className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Reset all filters
            </Link>
          </div>
        )}

        <div className="mt-10">
          <Pagination
            page={current}
            totalPages={totalPages}
            basePath={basePath}
            path="/exams"
          />
        </div>
      </section>
    </div>
  );
}