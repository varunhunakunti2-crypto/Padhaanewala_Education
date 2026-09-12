import CollegeCard from "@/components/colleges/CollegeCard";
import CollegeFilters from "@/components/colleges/CollegeFilters";
import Pagination from "@/components/colleges/Pagination";
import { colleges, courseLabel } from "@/data/colleges";

export const metadata = {
  title: "Colleges in India",
  description:
    "Search and filter 1,000+ verified Indian colleges by course, state, ownership and more.",
};

const PAGE_SIZE = 6;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const state = first(sp.state);
  const course = first(sp.course);
  const featured = first(sp.featured) === "1";
  const sort = first(sp.sort) || "featured";
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  let results = colleges.filter((college) => {
    if (state && college.stateCode !== state) return false;
    if (course && !college.courses.includes(course)) return false;
    if (featured && !college.featured) return false;
    if (q) {
      const haystack = [
        college.name,
        college.city,
        college.location,
        college.type,
        ...college.courses.map((c) => courseLabel(c)),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "rating") {
    results = [...results].sort((a, b) => b.rating - a.rating);
  } else if (sort === "name") {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results = [...results].sort(
      (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.rating - a.rating,
    );
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  const cleanParams = new URLSearchParams();
  if (q) cleanParams.set("q", q);
  if (state) cleanParams.set("state", state);
  if (course) cleanParams.set("course", course);
  if (featured) cleanParams.set("featured", "1");
  if (sort) cleanParams.set("sort", sort);
  const basePath = `?${cleanParams.toString()}`;

  const activeFilters = [
    q ? `“${q}”` : "",
    state ? "a state filter" : "",
    course ? `course: ${courseLabel(course)}` : "",
    featured ? "featured only" : "",
  ].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Colleges in India
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Search, filter and compare verified colleges by course, state,
            ownership and more.
          </p>
          <div className="mt-7">
            <CollegeFilters
              current={{ q, state, course, featured: featured ? "1" : "", sort }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0
              ? "No colleges found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} colleges`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">
              Filters: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((college) => (
              <CollegeCard key={college.id} college={college} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No colleges found
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try adjusting your filters or clearing the search.
            </p>
            <a
              href="/colleges"
              className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Reset all filters
            </a>
          </div>
        )}

        <div className="mt-10">
          <Pagination page={current} totalPages={totalPages} basePath={basePath} />
        </div>
      </section>
    </div>
  );
}