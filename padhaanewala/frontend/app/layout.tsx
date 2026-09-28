import type { Metadata } from "next";
import { Caveat, Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { Providers } from "@/components/layout/Providers";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";
import { SITE, SITE_URL } from "@/lib/site";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "padhaanewala",
    "college discovery",
    "college search india",
    "compare colleges",
    "engineering colleges",
    "medical colleges",
    "mba colleges",
    "entrance exams",
    "mock tests",
    "scholarships",
  ],
  authors: [{ name: SITE.legalName }],
  creator: SITE.legalName,
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  other: {
    "format-detection": "telephone=no",
  },
};

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
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BottomNav />
          {/* `AskAiFab` is no longer mounted. It was a site-wide floating link
              into `/ask-ai`, which is de-listed: the route relays the user's raw
              message to a metered third-party model with no rate limit, no input
              cap and no timeout. A persistent global entry point to a metered
              relay is a cost exposure on every page load, not just the page it
              links to. */}
          <WhatsAppFab />
        </Providers>
      </body>
    </html>
  );
}