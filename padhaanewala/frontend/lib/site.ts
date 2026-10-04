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
  /**
   * Single contact identity. Every user-visible phone number and email address on
   * the site is read from here.
   *
   * It was not, and the site carried four different contact points: this file
   * and `/contact` said `+91 98765 43210`, `/about` said `+91 90000 00000`,
   * `/contact` and `/admission` published `support@` and `counsellor@` addresses
   * on the `.com` domain while the site is `.in`, and the footer linked to the
   * bare `https://instagram.com` home pages. A grievance notice served on one
   * number and a footer pointing at someone else's Instagram are both
   * consumer-protection problems, not cosmetic ones.
   *
   * `phoneRaw`/`whatsapp` are the same digits without formatting, for `tel:` and
   * `wa.me` links.
   */
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
    x: "https://x.com/padhaanewala",
  },
} as const;

/** `${SITE.address...}` in one line, for legal and contact copy. */
export const SITE_ADDRESS_LINE = `${SITE.legalName}, ${SITE.address.locality}, ${SITE.address.region} ${SITE.address.postalCode}, India`;

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${SITE.domain}`).replace(/\/+$/, "");

export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Brand assets, declared once. `icon.svg` is a file-convention icon, so this
 * path is both what the browser is linked to and what the Organization
 * structured-data node cites as its logo — two places that must not drift.
 */
export const SITE_LOGO_PATH = "/logo.png";

/**
 * The browser-chrome colour on Android and the status bar on iOS. Brand purple,
 * matching `--brand-purple` in `app/globals.css`.
 *
 * Held here rather than inline in `app/layout.tsx` because it is read by the
 * `viewport` export, which is a separate module from `metadata` (the
 * `themeColor` metadata field was deprecated in Next 14).
 */
export const SITE_THEME_COLOR = "#7c3aed";

