import type { NextConfig } from "next";

const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  // 127.0.0.1 and not `localhost`: the dev API is uvicorn bound to the IPv4
  // loopback, while `localhost` resolves to ::1 first and is answered by
  // whatever else is publishing :8000 (a Docker wildcard bind claims it). The
  // proxy then forwards every /api/v1 call to that other service and gets its
  // 404 back, which reads as "the API is broken" rather than "wrong port".
  "http://127.0.0.1:8000"
).replace(/\/api\/v1$/, "");

/**
 * Launch blockers that must be resolved before a production bundle exists.
 *
 * Each is a *statutory* publication duty rather than a configuration nicety, and
 * each produces a legal page whose content is a written representation to the
 * public. Shipping a placeholder is not a lesser version of shipping the real
 * thing — for a named grievance officer it is the specific failure the
 * requirement exists to prevent.
 *
 * `APP_ENV=production` is the gate rather than `NODE_ENV`, because
 * `NODE_ENV=production` is also true of every local `next build`. Gating on it
 * would make the repository unbuildable for development. The backend's
 * `app/config.py` already refuses to boot a production deployment on unset
 * secrets for the same reason; this is the frontend half of that rule.
 */
const REQUIRED_IN_PRODUCTION: ReadonlyArray<{
  readonly name: string;
  readonly value: string | undefined;
  readonly why: string;
}> = [
  {
    name: "NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME",
    value: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME,
    why:
      "IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021 r.3(2)(g) and the Consumer Protection Act 2019 both require a *named* grievance officer to be published. /legal/grievance renders this value, and an undesignated officer means a notice may be treated as not served.",
  },
];

if (process.env.APP_ENV === "production") {
  const missing = REQUIRED_IN_PRODUCTION.filter(
    (req) => !req.value || req.value.trim() === ""
  );
  if (missing.length > 0) {
    const detail = missing
      .map((req) => `  - ${req.name}\n      ${req.why}`)
      .join("\n");
    throw new Error(
      `Refusing to build: ${missing.length} required production variable(s) are unset or empty.\n${detail}\n` +
        `This is the same class of guard as app/config.py in the backend, which refuses to boot\n` +
        `with APP_ENV=production when a secret is a placeholder. Set the value in the deployment\n` +
        `environment — do not work around it, and do not substitute a plausible-looking name.`,
    );
  }
}

const nextConfig: NextConfig = {
  /**
   * Phase 2.1. Required by `frontend/Dockerfile`, whose runtime stage copies
   * `.next/standalone` — without it there is no such directory and the build
   * fails at `COPY`.
   *
   * `standalone` makes Next trace the real import graph and emit a
   * self-contained `server.js` plus a minimal `node_modules`. The alternative,
   * `next start`, requires the whole source tree and all 373 packages (~500 MB,
   * including ESLint and the TypeScript compiler, neither of which can execute
   * at runtime).
   *
   * Two consequences to know before changing it:
   *
   *  - `next start` stops working. The standalone output is served by
   *    `node server.js`. `npm start` still calls `next start`, which remains
   *    correct for a non-container deploy and is not what the image runs.
   *  - `public/` and `.next/static/` are deliberately *not* in `standalone`.
   *    Omitting them yields a site that serves HTML with every stylesheet and
   *    script 404ing, so the Dockerfile copies both explicitly.
   */
  output: "standalone",

  // Phase 5.2. Every response carries the header stack from proxy.ts; this one
  // has no value and advertises the framework what built the page. Caddy also
  // strips it via `-Server`, but the app should not emit it when run directly.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    /**
     * Next 16 restricts `images.qualities` to `[75]` and coerces any other value
     * to the nearest entry, so `quality={72}` on the hero would be silently
     * served at 75. Only these two are requested; anything else would let
     * callers drive re-encoding at arbitrary qualities.
     */
    qualities: [72, 75],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl.replace(/\/+$/, "")}/api/v1/:path*`,
      },
    ];
  },
  /**
   * People paste and link to legal documents by their conventional top-level
   * paths, and print shops, ad agencies and app-store listings all assume
   * them. Without these the canonical `/legal/*` routes 404 every time
   * somebody guesses the "obvious" URL. `permanent` is safe because
   * `/legal/*` is the canonical location and nothing else is served there.
   */
  async redirects() {
    return [
      { source: "/privacy-policy", destination: "/legal/privacy", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      // S.5(4) of the DPDP Act, 2023 requires the notice to be "easily
      // accessible" and to be given "at the earliest occasion" — a notice only
      // reachable by first finding /legal/privacy and then spotting a sibling
      // link does not meet that.
      { source: "/dpdp-notice", destination: "/legal/dpdp-notice", permanent: true },
      { source: "/dpdp", destination: "/legal/dpdp-notice", permanent: true },
      { source: "/notice", destination: "/legal/dpdp-notice", permanent: true },
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/terms-of-service", destination: "/legal/terms", permanent: true },
      {
        source: "/terms-and-conditions",
        destination: "/legal/terms",
        permanent: true,
      },
      { source: "/cookie-policy", destination: "/legal/cookie-policy", permanent: true },
      { source: "/cookies", destination: "/legal/cookie-policy", permanent: true },
      { source: "/refund-policy", destination: "/legal/refund", permanent: true },
      { source: "/refunds", destination: "/legal/refund", permanent: true },
      { source: "/disclaimer", destination: "/legal/disclaimer", permanent: true },
      { source: "/grievance", destination: "/legal/grievance", permanent: true },
      {
        source: "/grievance-redressal",
        destination: "/legal/grievance",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
