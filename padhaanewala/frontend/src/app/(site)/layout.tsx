import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIFloatingAssistant from "@/components/AIFloatingAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("padhaanewala-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <AIFloatingAssistant />
      </body>
    </html>
  );
}