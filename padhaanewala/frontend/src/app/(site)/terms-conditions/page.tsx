import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that govern your use of the Padhaanewala platform.",
};

export default function TermsPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            Last updated: September 2026
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-8 text-sm leading-7 text-neutral-600">
          <div>
            <h2 className="text-base font-bold text-neutral-950">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing Padhaanewala, you agree to these terms. If you do not agree, please
              refrain from using the platform. References to &ldquo;we&rdquo;,
              &ldquo;us&rdquo; and &ldquo;Padhaanewala&rdquo; mean Padhaanewala Edutech Services.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">2. Use of the service</h2>
            <p className="mt-2">
              You may use the platform for lawful, personal, non-commercial purposes. You must not
              misuse the service, attempt to gain unauthorised access, or scrape data at scale
              without permission.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">3. Information accuracy</h2>
            <p className="mt-2">
              We work hard to keep college, fee, cutoff and placement data verified and current,
              but we cannot guarantee absolute accuracy. Always confirm critical details with the
              official institution or authority.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">4. No professional advice</h2>
            <p className="mt-2">
              Predictions and counselling support are guidance only and do not guarantee admission
              or scholarship outcomes.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">5. Limitation of liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, Padhaanewala is not liable for indirect or
              consequential losses arising from use of the platform.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">6. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Continued use of the platform after
              changes are posted constitutes acceptance of the revised terms.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}