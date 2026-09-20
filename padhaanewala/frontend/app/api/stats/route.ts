import { NextResponse } from "next/server";

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const API = BACKEND.endsWith("/api/v1") ? BACKEND : `${BACKEND}/api/v1`;

async function listLength(endpoint: string): Promise<number> {
  try {
    const res = await fetch(`${API}${endpoint}?limit=10000`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
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

  return NextResponse.json({
    ok: true,
    colleges,
    courses,
    exams,
    scholarships,
    blogs,
    mockTests,
  });
}