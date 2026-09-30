import type { Instrumentation } from "next";

/**
 * Server-side error capture. Phase 5.4.
 *
 * `app/error.tsx` is a React error boundary, so it only ever sees errors thrown
 * while *rendering client components*. It never sees:
 *
 *   - a Server Component that throws during render or during a data fetch
 *     (`getCollegeBundle`, the catalogue walk in `lib/api-server.ts`, …),
 *   - a route handler that throws (`/api/ai`, `/api/stats`, `/api/health`),
 *   - a Server Action.
 *
 * Those are the majority of the ways this app can fail — most of the pages are
 * Server Components that fetch the backend — and they produce nothing but a
 * generic 500 with no identifier. `onRequestError` is the only Next.js hook that
 * sees them, and it hands over `error.digest`, which is the same value a user
 * can be shown in `app/error.tsx`. That is what makes a browser-side report and a
 * server-side log line joinable.
 *
 * Output is the same single-line JSON shape `app/api/errors/route.ts` writes, so
 * one `event=` query covers both origins.
 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : null;

  const record = {
    event: "server_error",
    digest,
    message: error instanceof Error ? error.message : String(error),
    // Stacks can carry connection strings and row values. The backend is
    // configured not to log SQLAlchemy errors to disk for that reason (Phase
    // 1.10); the same rule applies here.
    stack: error instanceof Error && error.stack ? error.stack.slice(0, 8000) : null,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath ?? null,
    routeType: context.routeType,
    renderSource: context.renderSource ?? null,
    revalidateReason: context.revalidateReason ?? null,
    receivedAt: new Date().toISOString(),
  };

  console.error(JSON.stringify(record));
};
