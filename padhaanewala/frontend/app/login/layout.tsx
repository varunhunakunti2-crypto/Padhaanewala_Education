import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";

/**
 * `/login` is a `"use client"` page — it holds three modes (password, signup,
 * OTP) in local state and reads `searchParams` — and a client component cannot
 * export `metadata` or `generateMetadata`. The declaration therefore lives in a
 * sibling layout, which is a server component and merges the same way a
 * `page.tsx` declaration would.
 *
 * This is the fix for the sitemap defect recorded in `lib/nav.ts`: `/login` was
 * listed in `SITEMAP_PAGES` and carried no `noindex` at all, so an
 * authentication page was being advertised for indexing. `noindex: true` keeps
 * it out of the index while leaving it `follow: true` — `Disallow` would stop a
 * crawler reading the very tag that removes the page, and the sign-in link the
 * rest of the site publishes has to stay followable.
 *
 * A real title and description are still declared: this page is user-visible in
 * a browser tab and in a share preview whether or not it is indexed.
 */
export const metadata: Metadata = pageMetadata({
  title: "Sign in or create an account",
  description:
    "Sign in to Padhaanewala or create a free account to save colleges, courses and scholarships across your devices.",
  path: "/login",
  noindex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
