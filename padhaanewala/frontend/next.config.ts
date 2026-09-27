import type { NextConfig } from "next";

const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/api\/v1$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
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
   * them. Without these the six canonical `/legal/*` routes 404 every time
   * somebody guesses the "obvious" URL. `permanent` is safe because
   * `/legal/*` is the canonical location and nothing else is served there.
   */
  async redirects() {
    return [
      { source: "/privacy-policy", destination: "/legal/privacy", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
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
