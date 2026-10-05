import { NextResponse } from "next/server";

/**
 * `GET /users/me/roles` answers `{ "roles": ["admin", …] }` — bare names, not
 * objects — but `AdminRole` shapes elsewhere in the app carry `name`, so both
 * are accepted.
 */
type MeResponse = { roles?: Array<{ name?: string } | string> };

/**
 * Catalogue revalidation endpoint.
 *
 * Admin writes go straight to the FastAPI backend from the browser
 * (`lib/api.ts` calls `/colleges`, `/courses`, … on `/api/v1`). The public
 * pages read the same rows through `lib/api-server.ts`, which caches them with
 * `next: { revalidate }`. Nothing in that path is told a write happened, so a
 * college created in `/admin` stayed invisible on `/colleges` until the ISR
 * window expired — and behind a module-level `pagedCache` that is never cleared,
 * often for the lifetime of the server process.
 *
 * The admin panel calls this after a successful mutation so the public catalogue
 * reflects it immediately.
 *
 * ## Why this requires an admin token
 *
 * `revalidateTag` forces every page using the tag to re-fetch. An open endpoint
 * would be a free amplification vector: any anonymous visitor could loop calls
 * here and keep the whole catalogue permanently cold, which is both a cheap DoS
 * and a way to make the site miss its own content. The bearer token is checked
 * against the backend's own `/users/me`, so the authorisation decision stays in
 * one place — this route never decides who is an admin, it only asks.
 *
 * `POST` body: `{ resources: ["colleges"] }`. Each entry maps to a tag in
 * `lib/api-server.ts` (`CACHE_TAGS`). Unknown names are rejected rather than
 * silently ignored, so a typo in the admin panel surfaces as an error instead of
 * a successful-looking call that revalidated nothing.
 */

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
)
  .replace(/\/api\/v1\/?$/, "")
  .replace(/\/+$/, "");

/**
 * Resource name → cache tag. Kept in step with `CACHE_TAGS` in
 * `lib/api-server.ts`; `tests/cache-tag-contract.test.ts` fails the build if the
 * two ever disagree, which is the only way this pair can drift silently.
 */
const RESOURCE_TAGS: Readonly<Record<string, string>> = {
  colleges: "catalog:colleges",
  courses: "catalog:courses",
  exams: "catalog:exams",
  scholarships: "catalog:scholarships",
  mocktests: "catalog:mock-tests",
  universities: "catalog:universities",
  locations: "catalog:locations",
  blogs: "content:blogs",
  banners: "content:banners",
};

/**
 * Roles allowed to trigger a revalidation.
 *
 * Mirrors `ADMIN_ROLES` on the backend's write routes. The token check below
 * asks the backend who the caller is; this list is only the allowlist applied to
 * that answer.
 */
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

/** Role names from the `/users/me/roles` payload, ignoring anything unnamed. */
function roleNames(payload: MeResponse | null): string[] {
  if (!payload?.roles) return [];
  return payload.roles
    .map((r) => (typeof r === "string" ? r : (r.name ?? "")))
    .filter(Boolean);
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ revalidated: [], error: "Missing bearer token." }, { status: 401 });
  }

  // Authorisation is delegated to the backend so there is exactly one place that
  // decides what an account may do.
  //
  // `/users/me/roles` rather than `/users/me`: the latter answers with the
  // profile only (`{id, email, mobile, …}`, no roles), so reading roles from it
  // yields `undefined` and every caller — including a real admin — gets a 403.
  let me: MeResponse | null = null;
  try {
    const res = await fetch(`${BACKEND}/api/v1/users/me/roles`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) me = (await res.json()) as MeResponse;
  } catch {
    // Unreachable backend: report it rather than pretending the token is bad.
    return NextResponse.json(
      { revalidated: [], error: "Could not reach the auth service." },
      { status: 503 },
    );
  }

  if (!me) {
    return NextResponse.json({ revalidated: [], error: "Invalid or expired token." }, { status: 401 });
  }

  const roles = roleNames(me);
  if (!roles.some((r) => ADMIN_ROLES.has(r))) {
    return NextResponse.json(
      { revalidated: [], error: "Admin role required." },
      { status: 403 },
    );
  }

  let requested: string[];
  try {
    const body = (await request.json()) as { resources?: unknown };
    requested = Array.isArray(body.resources)
      ? body.resources.filter((r): r is string => typeof r === "string")
      : [];
  } catch {
    return NextResponse.json({ revalidated: [], error: "Body must be JSON." }, { status: 400 });
  }

  if (requested.length === 0) {
    return NextResponse.json(
      { revalidated: [], error: "`resources` must be a non-empty array." },
      { status: 400 },
    );
  }

  // `{ expire: 0 }` rather than the recommended `"max"`: this is a route
  // handler, not a Server Action, so `updateTag` is unavailable, and stale-while-
  // revalidate would still show the admin the pre-write page they just changed.
  // An admin who creates a college and clicks through expects to find it there.
  const { revalidateTag } = await import("next/cache");
  const done: string[] = [];
  const unknown: string[] = [];
  for (const name of requested) {
    const tag = RESOURCE_TAGS[name.toLowerCase()];
    if (!tag) {
      unknown.push(name);
      continue;
    }
    revalidateTag(tag, { expire: 0 });
    done.push(name);
  }

  if (unknown.length > 0) {
    return NextResponse.json(
      { revalidated: done, error: `Unknown resource(s): ${unknown.join(", ")}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ revalidated: done });
}