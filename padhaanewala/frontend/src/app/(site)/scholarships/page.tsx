import Link from "next/link";
import ScholarshipCard from "@/components/scholarships/ScholarshipCard";
import ScholarshipFilters from "@/components/scholarships/ScholarshipFilters";
import Pagination from "@/components/colleges/Pagination";
import { scholarships } from "@/data/scholarships";
import type { Scholarship } from "@/data/scholarships";

export const metadata = {
  title: "Scholarships in India",
  description:
    "Browse government and private scholarships for Indian students — eligibility, amounts and deadlines.",
};

const PAGE_SIZE = 9;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function amountRank(scholarship: Scholarship): number {
  const lakhs = scholarship.amount.match(/([\d.]+)\s*L/);
  if (lakhs) return parseFloat(lakhs[1]) * 100000;
  const numeric = scholarship.amount.match(/([\d,]+)/);
  if (numeric) return parseInt(numeric[1].replace(/,/g, ""), 10);
  return 0;
}

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const category = first(sp.category);
  const ownership = first(sp.ownership);
  const sort = first(sp.sort) || "deadline";
  const page = Math.max(1, parseInt(first(sp.page), 10) || 1);

  let results = scholarships.filter((s) => {
    if (category && category !== "All" && s.category !== category) return false;
    if (ownership && s.ownership !== ownership) return false;
    if (q) {
      const haystack = [s.name, s.provider, s.eligibility, s.amount, s.category]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sort === "amount") {
    results = [...results].sort((a, b) => amountRank(b) - amountRank(a));
  } else if (sort === "name") {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results = [...results].sort((a, b) =>
      a.deadlineISO.localeCompare(b.deadlineISO),
    );
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);

  const cleanParams = new URLSearchParams();
  if (q) cleanParams.set("q", q);
  if (category && category !== "All") cleanParams.set("category", category);
  if (ownership) cleanParams.set("ownership", ownership);
  if (sort) cleanParams.set("sort", sort);
  const basePath = `?${cleanParams.toString()}`;

  const activeFilters = [
    q ? `“${q}”` : "",
    category && category !== "All" ? `category: ${category}` : "",
    ownership ? `provider: ${ownership}` : "",
  ].filter(Boolean);

  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Scholarships in India
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Government and private scholarships for students — apply before the
            deadline and reduce your education cost.
          </p>
          <div className="mt-7">
            <ScholarshipFilters
              current={{ q, category: category || "All", ownership, sort }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {total === 0
              ? "No scholarships found"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} scholarships`}
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-neutral-500">
              Filters: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((scholarship) => (
              <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-20 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No scholarships found
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try a different search or reset the filters.
            </p>
            <Link
              href="/scholarships"
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
            path="/scholarships"
          />
        </div>
      </section>
    </div>
  );
}