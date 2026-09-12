import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Padhaanewala collects, uses and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            Last updated: September 2026
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-8 text-sm leading-7 text-neutral-600">
          <div>
            <h2 className="text-base font-bold text-neutral-950">1. Information we collect</h2>
            <p className="mt-2">
              We collect the details you provide when using the platform — such as your name,
              email, mobile number, education level and course interests — along with basic usage
              data (pages visited and features used) to improve the service.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">2. How we use your information</h2>
            <p className="mt-2">
              Your information is used to provide admission counselling, personalise college and
              scholarship recommendations, send deadline reminders and improve our tools. We do
              not sell your personal data to third parties.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">3. Data sharing</h2>
            <p className="mt-2">
              We share data only with service providers required to operate the platform (for
              example hosting and messaging), and where required by law.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">4. Data security</h2>
            <p className="mt-2">
              Passwords are stored as strong salted hashes and access to databases is restricted.
              No security measure is perfect, so we encourage strong, unique passwords.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">5. Your rights</h2>
            <p className="mt-2">
              You may request access to, correction of, or deletion of your personal information by
              contacting us. Where allowed by law, you can also object to certain processing.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950">6. Contact</h2>
            <p className="mt-2">
              For any privacy concern, write to us at support@padhaanewala.in or by post at
              Padhaanewala Edutech Services, Bengaluru - 560100.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}