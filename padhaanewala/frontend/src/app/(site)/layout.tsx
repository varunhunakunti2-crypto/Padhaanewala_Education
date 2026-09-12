import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIFloatingAssistant from "@/components/AIFloatingAssistant";
import StickyCta from "@/components/StickyCta";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://padhaanewala.in";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Padhaanewala",
  url: SITE_URL,
  description:
    "India's education discovery platform. Verified colleges, courses, scholarships, mock tests and free admission counselling.",
  email: "support@padhaanewala.in",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bengaluru",
    addressRegion: "Karnataka",
    postalCode: "560100",
    addressCountry: "IN",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Padhaanewala — Find the Right College for Your Future",
    template: "%s | Padhaanewala",
  },
  description:
    "Search 1,000+ verified Indian colleges, compare courses, check fees, placements and cutoffs, find scholarships, take mock tests and get free admission assistance.",
  keywords: [
    "colleges in India",
    "BHMS",
    "BAMS",
    "MBBS",
    "B.Sc Nursing",
    "college predictor",
    "college comparison",
    "scholarships India",
    "mock tests",
    "admission counselling",
  ],
  openGraph: {
    title: "Padhaanewala — Find the Right College for Your Future",
    description:
      "Verified college data, AI college predictor, scholarships, mock tests and free counselling.",
    siteName: "Padhaanewala",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Padhaanewala — Find the Right College for Your Future",
    description:
      "Verified college data, AI college predictor, scholarships, mock tests and free counselling.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("padhaanewala-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <MotionConfig reducedMotion="user">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <AIFloatingAssistant />
          <StickyCta />
        </MotionConfig>
      </body>
    </html>
  );
}