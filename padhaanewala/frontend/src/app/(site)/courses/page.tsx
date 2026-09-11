import CourseCard from "@/components/courses/CourseCard";
import CourseFilters from "@/components/courses/CourseFilters";
import Pagination from "@/components/colleges/Pagination";
import { courses } from "@/data/courses";

export const metadata = {
  title: "Courses in India",
  description:
    "Browse 50+ undergraduate and postgraduate courses across medicine, engineering, management and more.",
};

const PAGE_SIZE = 9;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const category = first(sp.category);
  const sort = first(sp.sort);
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  let results = courses.filter((course) => {
    if (category && course.category !== category) return false;
    if (q) {
      const haystack = [course.name, course.short, course.degree, course.category, ...course.careers]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "colleges") {
    results = [...results].sort((a, b) => b.colleges - a.colleges);
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
  if (category) cleanParams.set("category", category);
  if (sort) cleanParams.set("sort", sort);

  const activeFilters = [q ? `“${q}”` : "", category || "", sort === "colleges" ? `sorted by: most colleges` : ""].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Courses in India
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Explore undergraduate and postgraduate courses across medicine,
            engineering, management, law and more.
          </p>
          <div className="mt-7">
            <CourseFilters current={{ q, category, sort }} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0
              ? "No courses found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} courses`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">Filters: {activeFilters.join(" · ")}</p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((course, index) => (
              <CourseCard key={course.id} course={course} index={start + index} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">No courses found</p>
            <p className="mt-2 text-sm text-neutral-500">
              Try adjusting your filters or clearing the search.
            </p>
            <a
              href="/courses"
              className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Reset all filters
            </a>
          </div>
        )}

        <div className="mt-10">
          <Pagination page={current} totalPages={totalPages} basePath={`?${cleanParams.toString()}`} path="/courses" />
        </div>
      </section>
    </div>
  );
}