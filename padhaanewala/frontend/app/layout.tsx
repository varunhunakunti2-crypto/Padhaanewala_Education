import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { Providers } from "@/components/layout/Providers";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";
import { AskAiFab } from "@/components/layout/AskAiFab";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  DEFAULT_OG_IMAGE,
  SITE_KEYWORDS,
  ldGraph,
  organizationLd,
  webSiteLd,
} from "@/lib/seo";
import { SITE, SITE_THEME_COLOR, SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The root `metadata` is a fallback, not the primary source.
 *
 * Every route calls `pageMetadata()` in `lib/seo.ts`, which returns a *complete*
 * object — title, description, canonical, robots, `openGraph` and `twitter` —
 * because the Metadata API merges shallowly and a descendant's `openGraph`
 * replaces the ancestor's entirely. This block exists so a route that forgets
 * still emits valid tags rather than inheriting a half-populated card.
 *
 * `themeColor` is deliberately absent: the field was deprecated in Next 14 and
 * lives on the `viewport` export below.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE.legalName, url: SITE_URL }],
  creator: SITE.legalName,
  publisher: SITE.legalName,
  category: "education",
  // No `icons` entry: `app/icon.svg` is a file-convention icon and Next emits
  // the <link rel="icon"> tags from it. Declaring the same path again here
  // would render a duplicate.
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@padhaanewala",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: { index: true, follow: true },
  other: {
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: "#071426" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * `Organization` and `WebSite` are emitted once, on the root layout, so every
 * page in the site shares the same two `@id`s. Every other structured-data node
 * references them by `@id` instead of restating the publisher, which is what
 * lets a crawler connect a college page to the organisation that publishes it.
 */
const ROOT_JSON_LD = ldGraph([organizationLd(), webSiteLd()]);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jakarta.variable} ${grotesk.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background pb-16 text-foreground transition-colors duration-300 lg:pb-0" suppressHydrationWarning>
        {/*
          Blocking, first in <body>, no `defer`/`async`. React renders a
          non-hoisted <script> exactly where it sits, so this executes before
          the first paint — which is the requirement for the dark-mode class to
          be present before anything is drawn. It used to be an inline
          `dangerouslySetInnerHTML` blob; Phase 5.1 moved it to
          `public/theme-init.js` so the CSP in `proxy.ts` needs no
          `'unsafe-inline'` in script-src for our own code. `next/script` is
          deliberately not used: it appends to the document asynchronously,
          which reintroduces the white flash.

          `no-sync-scripts` is suppressed for the reason the file says: the rule
          exists to stop render-blocking JavaScript, and this script's entire job
          is to run before the first paint. It is 20 lines, it is served from our
          own origin with a long cache lifetime, and nothing else in the document
          runs before it. This is the one place the rule's default is wrong.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
        <JsonLd data={ROOT_JSON_LD} />
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BottomNav />
          {/* The floating assistant. Opens a chat panel in place rather than
              navigating away, so a reader on a college detail page or an article
              does not lose their place to ask a question. `/api/ai` is capped at
              500 characters and 12 requests a minute per IP (Phase 4.7), which is
              what bounds the spend now that the button is on every page. Both the
              panel and three.js are code-split and fetched on first interaction. */}
          <AskAiFab />
          <WhatsAppFab />
        </Providers>
      </body>
    </html>
  );
}