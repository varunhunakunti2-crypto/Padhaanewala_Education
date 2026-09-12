import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Padhaanewala pricing — free college discovery, scholarships and mock tests with optional premium counselling plans.",
};

const plans = [
  {
    name: "Free",
    price: "₹0",
    tagline: "Everything you need to start your search",
    features: [
      "College & course listings",
      "College predictor",
      "Mock tests",
      "Scholarship alerts",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Counselling Plus",
    price: "₹999",
    tagline: "Guided admission support from real counsellors",
    features: [
      "Everything in Free",
      "1-on-1 admission counselling",
      "Application & deadline tracking",
      "Priority support",
    ],
    cta: "Book counselling",
    featured: true,
  },
];

export default function PricingPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Simple, honest pricing
          </h1>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            College discovery, scholarships and mock tests are always free.
            Premium counselling is optional — no hidden fees, ever.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:px-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-3xl border p-8 ${
              plan.featured
                ? "border-neutral-950 bg-neutral-950 text-white shadow-xl"
                : "border-black/5 bg-neutral-50"
            }`}
          >
            <h2
              className={`text-lg font-bold ${
                plan.featured ? "text-white" : "text-neutral-950"
              }`}
            >
              {plan.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">{plan.tagline}</p>
            <p
              className={`mt-5 text-4xl font-bold tracking-tight ${
                plan.featured ? "text-white" : "text-neutral-950"
              }`}
            >
              {plan.price}
              <span className="text-base font-medium text-neutral-500"> / once</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className={`flex items-start gap-2 ${
                    plan.featured ? "text-neutral-200" : "text-neutral-600"
                  }`}
                >
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className={`mt-8 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-bold transition-colors ${
                plan.featured
                  ? "bg-white text-neutral-950 hover:bg-neutral-200"
                  : "border border-neutral-300 text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}