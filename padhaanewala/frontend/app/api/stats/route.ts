import { NextResponse } from "next/server";

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const API = BACKEND.endsWith("/api/v1") ? BACKEND : `${BACKEND}/api/v1`;

type SourceResult = { count: number; error: string | null };

/**
 * Count rows at one catalogue endpoint.
 *
 * Failures are returned, not swallowed. The previous version collapsed every
 * error path into `0`, so a backend outage was indistinguishable from an empty
 * catalogue and the route still answered `ok: true` — which is how the admin
 * panel ended up reporting a healthy API while every number sat at zero.
 */
async function listLength(endpoint: string): Promise<SourceResult> {
  try {
    const res = await fetch(`${API}${endpoint}?limit=10000`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { count: 0, error: `HTTP ${res.status}` };

    const data = await res.json();
    if (!Array.isArray(data)) return { count: 0, error: "unexpected response shape" };

    return { count: data.length, error: null };
  } catch (err) {
    return {
      count: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

export async function GET() {
  const [colleges, courses, exams, scholarships, blogs, mockTests] =
    await Promise.all([
      listLength("/colleges"),
      listLength("/courses"),
      listLength("/exams"),
      listLength("/scholarships"),
      listLength("/blogs"),
      listLength("/mock-tests"),
    ]);

  const sources = { colleges, courses, exams, scholarships, blogs, mockTests };
  const failed = Object.entries(sources)
    .filter(([, v]) => v.error !== null)
    .map(([k]) => k);

  // The route itself succeeded in *reporting*, so the status stays 200 even when a
  // source is down: the counts that did resolve are still real and worth showing.
  // `ok` and `failed` carry the truth for callers, and a 503 here would make
  // `fetchCatalogStats` discard the healthy counts along with the broken ones.
  return NextResponse.json({
    ok: failed.length === 0,
    colleges: colleges.count,
    courses: courses.count,
    exams: exams.count,
    scholarships: scholarships.count,
    blogs: blogs.count,
    mockTests: mockTests.count,
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
