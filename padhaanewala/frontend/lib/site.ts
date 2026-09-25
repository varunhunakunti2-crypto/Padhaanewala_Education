/**
 * Single source of truth for brand + URL strings.
 *
 * Previously these were hardcoded per file, which is how "CampusPulse" and
 * "campuspulse.in" survived a rebrand across the about page, JSON-LD blocks,
 * robots.txt and the sitemap. Anything user- or SEO-visible should import from
 * here instead of being retyped.
 */

export const SITE = {
  name: "padhaanewala",
  legalName: "Padhaanewala Edutech Services",
  domain: "padhaanewala.in",
  tagline: "Find the College That Fits Your Future",
  description:
    "India-wide college discovery, admissions guidance, exam updates and AI-assisted shortlisting for students across every state.",
  email: "hello@padhaanewala.in",
  phone: "+91 98765 43210",
  phoneRaw: "919876543210",
  whatsapp: "919876543210",
  address: {
    street: "Padhaanewala Edutech Services",
    locality: "Bengaluru",
    region: "Karnataka",
    postalCode: "560100",
    country: "IN",
  },
  foundedYear: 2024,
  social: {
    instagram: "https://instagram.com/padhaanewala",
    linkedin: "https://linkedin.com/company/padhaanewala",
    youtube: "https://youtube.com/@padhaanewala",
  },
} as const;

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${SITE.domain}`).replace(/\/+$/, "");

export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
