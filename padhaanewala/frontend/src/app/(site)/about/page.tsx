import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Padhaanewala",
  description:
    "Padhaanewala is India's education discovery platform — verified college data, scholarships, mock tests and free admission counselling.",
};

export default function AboutPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            About Padhaanewala
          </h1>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            India-wide education discovery, examination and counselling support for students and
            families.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold tracking-tight text-neutral-950">What we do</h2>
        <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
          Padhaanewala helps students find the right college, course and scholarship path. We
          aggregate verified data on colleges, courses, fees, placements and entrance exams across
          India, and pair it with practical tools — a college predictor, mock tests and free
          admission counselling — so every student can make an informed decision.
        </p>

        <h2 className="mt-10 text-xl font-bold tracking-tight text-neutral-950">Why students trust us</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Verified data",
              text: "College fees, cutoffs and placement records are cross-checked before they go live.",
            },
            {
              title: "Practical tools",
              text: "Predictor, mock tests and deadline reminders that turn research into action.",
            },
            {
              title: "Free counselling",
              text: "Real guidance for every admission step — no hidden fees, ever.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-black/5 bg-neutral-50 p-5">
              <h3 className="text-sm font-bold text-neutral-950">{item.title}</h3>
              <p className="mt-2 text-xs leading-6 text-neutral-600">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-black/5 bg-neutral-50 p-6">
          <h2 className="text-sm font-bold text-neutral-950">Company</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Padhaanewala Edutech Services
            <br />
            Bengaluru - 560100, India
          </p>
        </div>
      </section>
    </div>
  );
}