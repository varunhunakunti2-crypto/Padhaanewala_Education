import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "../globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Jobhire — Find Your Dream Job",
    template: "%s | Jobhire",
  },
  description:
    "Search thousands of verified job openings, browse categories, and grow your career with Jobhire.",
};

export default function JobhireLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body
        style={{
          fontFamily:
            "var(--font-poppins), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
        className="bg-white text-jh-ink antialiased"
      >
        {children}
      </body>
    </html>
  );
}