import { NextResponse } from "next/server";

/**
 * The backend health endpoint lives at the service root, not under `/api/v1`, so
 * any configured API prefix has to be stripped before building the URL.
 */
const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
)
  .replace(/\/api\/v1\/?$/, "")
  .replace(/\/+$/, "");

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    const data = await res.json();

    // The backend answers 503 when a dependency is down, and that verdict is the
    // point of the endpoint — forward it instead of masking it as a success.
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Unreachable is a distinct state from "reachable but unhealthy": here nothing
    // about the database could be measured at all.
    return NextResponse.json(
      {
        status: "unreachable",
        checks: {},
        error: "The backend did not respond to the health request.",
        checkedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
