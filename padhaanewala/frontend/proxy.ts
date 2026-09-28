import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers. Phase 5.2.
 *
 * ## Why `proxy.ts` and not `middleware.ts`
 *
 * `middleware.ts` is deprecated in Next 16 and renamed to `proxy.ts`
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * middleware.md`). Same runtime, same `matcher`, different name.
 *
 * ## Why these headers live here rather than in `next.config.ts` `headers()`
 *
 * `headers()` in `next.config.ts` is evaluated once at *build* time and cannot
 * vary per request. `proxy.ts` is evaluated per request, which is what the
 * `Permissions-Policy` split below needs. Everything here is a response header;
 * no request header is forwarded to the page, so nothing here opts a route into
 * dynamic rendering and the ISR windows in `app/page.tsx` and the `[slug]`
 * routes are untouched.
 *
 * ## The nonce trap, and why this policy is not a strict one
 *
 * The textbook Next.js CSP is `script-src 'self' 'nonce-…' 'strict-dynamic'`.
 * It cannot be used here. A nonce is only knowable per request, and a
 * statically prerendered page has no request to read it from — Next.js's own
 * guide states the consequence: *"Static optimization and Incremental Static
 * Regeneration (ISR) are disabled"*, and separately that *"Partial Prerendering
 * (PPR) is incompatible with nonce-based CSP"*. This site prerenders ~26
 * slugs and revalidates at 300s/600s. A nonce would trade a real
 * misconfiguration risk for a total loss of the caching architecture.
 *
 * `'strict-dynamic'` is **not** used as a substitute, and this is worth being
 * explicit about because it looks like a free upgrade. Under CSP Level 3,
 * `'strict-dynamic'` causes `'self'`, host sources *and* `'unsafe-inline'` to be
 * ignored for script loads; only a script carrying a matching nonce or hash
 * may load, and a script loaded by a trusted script. With no nonce or hash
 * anywhere in `script-src` — which is exactly the no-nonce case — it authorises
 * **nothing**, and every script on the site is refused, including Next's own
 * bundles. The tracker proposed `script-src 'self' 'strict-dynamic'` as the
 * nonce-free answer; that combination is a self-inflicted outage, not a policy.
 *
 * So `script-src` keeps `'unsafe-inline'`, and the real work is to make it
 * mean as little as possible:
 *
 *   - Phase 5.1 removed the only first-party inline script (the theme
 *     bootstrap) to `public/theme-init.js`. The inline scripts that remain are
 *     Next's own `<script>self.__next_f.push(…)</script>` flight-payload
 *     bootstrap, which no amount of refactoring removes.
 *   - The two `<script type="application/ld+json">` JSON-LD blocks are data
 *     blocks, not executed scripts, so `script-src` does not apply to them.
 *   - `'unsafe-eval'` is development-only. React uses `eval` to reconstruct
 *     server error stacks in the browser; nothing in a production build does.
 *
 * `style-src` keeps `'unsafe-inline'` too, and that one is not negotiable:
 * Tailwind v4 `@utility` and `globals.css` inject style rules at runtime, and
 * `motion` writes inline `style` attributes. Styles are the lower-risk half of
 * the policy — a CSS injection cannot execute script under this policy because
 * `script-src` still stands. Recorded rather than hidden.
 *
 * To move to a strict policy later, the options are (a) accept dynamic
 * rendering, or (b) enable `experimental.sri` and audit the emitted hashes.
 * Option (b) was trialled during Phase 5 and is not in use; see the tracker.
 */

/** Extra image origins, comma-separated. Server-side only — never `NEXT_PUBLIC_`. */
const extraImageHosts = (process.env.CSP_IMAGE_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

/**
 * `/mock-tests` runs a proctored exam: `ProctoredMockTest` calls
 * `getUserMedia({ video: true, audio: true })` and `getDisplayMedia({ video: true })`.
 * A blanket `camera=(), microphone=()` would leave the page inert, so those two
 * features are granted to that route and denied everywhere else. `Permissions-Policy`
 * is a response header, so this can be per-path — which is why the policy is
 * built here rather than in `next.config.ts`.
 */
const PROCTORING_PREFIX = "/mock-tests";

const DENIED_FEATURES = [
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "bluetooth",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "payment",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "usb",
  "xr-spatial-tracking",
] as const;

const csp = (isDev: boolean): string =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // `data:` for inline SVG/canvas, `blob:` for object URLs. next/image
    // proxies every remote image through /_next/image, so the only third-party
    // origin that can appear is one an admin typed into the media library —
    // list it in CSP_IMAGE_HOSTS rather than allowing https: wholesale.
    ["img-src 'self' data: blob:", ...extraImageHosts].join(" "),
    "font-src 'self' data:",
    // Everything the browser fetches is same-origin: /api/v1/* and /api/ai are
    // both served by this app (see the rewrite in next.config.ts). The OpenAI
    // call is made server-side in app/api/ai/route.ts and is not subject to CSP.
    "connect-src 'self'",
    "media-src 'self' blob:",
    // blob: is here for the object-URL worker path three.js and the WebGL
    // loader can take; nothing in the repo constructs a worker today, and the
    // cost of allowing it is bounded by script-src above.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // Only in production. In development the site is served over plain HTTP on
    // localhost, and this directive would rewrite the navigation itself to
    // https://localhost:3000, which nothing is listening on.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

const permissionsPolicy = (pathname: string): string => {
  const allowed = pathname === PROCTORING_PREFIX || pathname.startsWith(`${PROCTORING_PREFIX}/`);
  return allowed
    ? `camera=(self), microphone=(self), display-capture=(self), ${DENIED_FEATURES.filter(
        (f) => f !== "camera" && f !== "microphone" && f !== "display-capture",
      )
        .map((f) => `${f}=()`)
        .join(", ")}`
    : DENIED_FEATURES.map((f) => `${f}=()`).join(", ");
};

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();

  response.headers.set("Content-Security-Policy", csp(isDev));
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Redundant with `frame-ancestors` in the CSP, kept for the browsers that
  // still read only this one.
  response.headers.set("X-Frame-Options", "DENY");
  // Do not leak the full path, including slugs and any query string, to
  // instagram.com when a visitor clicks out of a college page.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", permissionsPolicy(pathname));

  // Ignored by a browser unless the response arrived over TLS, so it costs
  // nothing in development — but it is not sent in development either, so that
  // nobody mistakes a dev header for evidence that TLS is configured.
  //
  // `preload` is deliberately absent. Adding it is irreversible for the domain
  // for as long as `max-age` lasts, and it is only safe once every subdomain is
  // known to be on TLS. Add it at hstspreload.org once that is true.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

export const config = {
  /**
   * Everything except immutable build output and the image optimiser. Those
   * are subresources: the policy only governs documents, workers and the
   * media they load, and running the proxy on every hashed chunk would add a
   * per-asset cost for no security benefit. `/api/*` is deliberately *not*
   * excluded so the JSON responses carry the headers too.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
