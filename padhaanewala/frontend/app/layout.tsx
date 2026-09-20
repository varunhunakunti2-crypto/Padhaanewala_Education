import type { Metadata } from "next";
import { Caveat, Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { Providers } from "@/components/layout/Providers";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";

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
  metadataBase: new URL("https://padhaanewala.com"),
  title: {
    default: "padhaanewala — Find the College That Fits Your Future",
    template: "%s · padhaanewala",
  },
  description:
    "Explore 12,000+ colleges across India, compare courses, fees and placements, and discover the right opportunities that match your goals.",
  keywords: [
    "padhaanewala",
    "college discovery",
    "college search india",
    "compare colleges",
    "engineering colleges",
    "medical colleges",
    "mba colleges",
  ],
  openGraph: {
    title: "padhaanewala — Find the College That Fits Your Future",
    description:
      "Explore colleges, compare courses, understand fees, and discover opportunities that match your goals.",
    type: "website",
    siteName: "padhaanewala",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "padhaanewala — Find the College That Fits Your Future",
    description:
      "Explore colleges, compare courses, understand fees, and discover opportunities that match your goals.",
  },
  robots: { index: true, follow: true },
  other: {
    "format-detection": "telephone=no",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${grotesk.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col pb-16 lg:pb-0 bg-[#fbfbfd] text-[#232038] dark:bg-[#090d16] dark:text-[#f3f4f6] transition-colors duration-300" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("cp_theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})()`,
          }}
        />
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BottomNav />
          <WhatsAppFab />
        </Providers>
      </body>
    </html>
  );
}