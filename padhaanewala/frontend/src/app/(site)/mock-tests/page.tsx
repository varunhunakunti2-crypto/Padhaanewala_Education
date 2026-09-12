import Link from "next/link";
import MockTestCard from "@/components/mocktests/MockTestCard";
import MockTestFilters from "@/components/mocktests/MockTestFilters";
import Pagination from "@/components/colleges/Pagination";
import { mockTests } from "@/data/mockTests";

export const metadata = {
  title: "Mock Tests",
  description:
    "Free standard and proctored mock tests for NEET UG, JEE Main, KCET and CUET — practice with realistic questions on a laptop or desktop.",
};

const PAGE_SIZE = 9;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MockTestsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const exam = first(sp.exam);
  const mode = first(sp.mode);
  const difficulty = first(sp.difficulty);
  const sort = first(sp.sort) || "name";
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  let results = mockTests.filter((test) => {
    if (exam && exam !== "All" && test.examName !== exam) return false;
    if (mode && test.mode !== mode) return false;
    if (difficulty && test.difficulty !== difficulty) return false;
    if (q) {
      const haystack = [test.name, test.examName, test.subject]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "duration") {
    results = [...results].sort((a, b) => a.duration - b.duration);
  } else if (sort === "questions") {
    results = [...results].sort((a, b) => a.questions - b.questions);
  } else {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  const cleanParams = new URLSearchParams();
  if (q) cleanParams.set("q", q);
  if (exam && exam !== "All") cleanParams.set("exam", exam);
  if (mode) cleanParams.set("mode", mode);
  if (difficulty) cleanParams.set("difficulty", difficulty);
  if (sort) cleanParams.set("sort", sort);
  const basePath = `?${cleanParams.toString()}`;

  const activeFilters = [
    q ? `“${q}”` : "",
    exam && exam !== "All" ? `exam: ${exam}` : "",
    mode ? `mode: ${mode}` : "",
    difficulty ? difficulty : "",
  ].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Mock Tests
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Practice with exam-realistic standard and proctored tests across
            NEET UG, JEE Main, KCET and CUET — available on laptop and
            desktop only.
          </p>
          <div className="mt-7">
            <MockTestFilters
              current={{ q, exam: exam || "All", mode, difficulty, sort }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0
              ? "No mock tests found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} tests`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">
              Filters: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((test) => (
              <MockTestCard key={test.id} test={test} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No mock tests found
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try a different search or reset the filters.
            </p>
            <Link
              href="/mock-tests"
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
            path="/mock-tests"
          />
        </div>
      </section>
    </div>
  );
}