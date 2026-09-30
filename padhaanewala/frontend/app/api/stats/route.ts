import { NextResponse } from "next/server";

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const API = BACKEND.endsWith("/api/v1") ? BACKEND : `${BACKEND}/api/v1`;

type SourceResult = { count: number; error: string | null };

/**
 * Count rows in the catalogue.
 *
 * Failures are returned, not swallowed. The previous version collapsed every
 * error path into `0`, so a backend outage was indistinguishable from an empty
 * catalogue and the route still answered `ok: true` — which is how the admin
 * panel ended up reporting a healthy API while every number sat at zero.
 *
 * This used to call the six list endpoints with `?limit=10000` and report
 * `data.length`, which conflated a page size with a population size. The list
 * endpoints now cap `limit` (they were a full-table-dump vector at
 * `?limit=1000000`), so that approach would have reported HTTP 200 with every
 * count silently truncated at the page cap — a dashboard that looks real and is
 * wrong. `/api/v1/stats/catalog` returns true `COUNT(*)` values server-side,
 * matching each list endpoint's own visibility rule, and transfers no rows.
 */
async function fetchCatalogStats(): Promise<Record<string, number>> {
  const res = await fetch(`${API}/stats/catalog`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("unexpected response shape");
  }
  return data as Record<string, number>;
}

export async function GET() {
  const endpoints: Record<string, string> = {
    colleges: "colleges",
    courses: "courses",
    exams: "exams",
    scholarships: "scholarships",
    blogs: "blogs",
    mockTests: "mock_tests",
  };

  let stats: Record<string, number> | null = null;
  let error: string | null = null;
  try {
    stats = await fetchCatalogStats();
  } catch (err) {
    error = err instanceof Error ? err.message : "request failed";
  }

  const sources: Record<string, SourceResult> = {};
  for (const [key, field] of Object.entries(endpoints)) {
    const value = stats?.[field];
    sources[key] = {
      count: typeof value === "number" ? value : 0,
      error: typeof value === "number" ? null : (error ?? "missing count"),
    };
  }

  const failed = Object.entries(sources)
    .filter(([, v]) => v.error !== null)
    .map(([k]) => k);

  // The route itself succeeded in *reporting*, so the status stays 200 even when a
  // source is down: the counts that did resolve are still real and worth showing.
  // `ok` and `failed` carry the truth for callers, and a 503 here would make
  // `fetchCatalogStats` discard the healthy counts along with the broken ones.
  return NextResponse.json({
    ok: failed.length === 0,
    colleges: sources.colleges.count,
    courses: sources.courses.count,
    exams: sources.exams.count,
    scholarships: sources.scholarships.count,
    blogs: sources.blogs.count,
    mockTests: sources.mockTests.count,
    sourceStatus: Object.fromEntries(
      Object.entries(sources).map(([k, v]) => [k, v.error ? ("error" as const) : ("ok" as const)]),
    ),
    failed,
    errors: Object.fromEntries(
      Object.entries(sources)
        .filter(([, v]) => v.error !== null)
        .map(([k, v]) => [k, v.error]),
    ),
    checkedAt: new Date().toISOString(),
  });
}
