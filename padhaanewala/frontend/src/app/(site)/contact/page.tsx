import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ChatIcon, WhatsAppIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact Padhaanewala",
  description:
    "Get in touch with the Padhaanewala team for free admission counselling and support.",
};

export default function ContactPage() {
  return (
    <div className="bg-white text-neutral-900">
      <section className="border-b border-black/5 bg-neutral-50">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Contact us
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-neutral-500 sm:text-base">
            Questions about admissions, counselling or your account? Reach out — we respond within
            one working day.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
            <div className="flex items-center gap-2">
              <ChatIcon className="h-5 w-5 text-neutral-700" />
              <h2 className="text-sm font-bold text-neutral-950">Free counselling</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Talk to our counsellors for help shortlisting colleges, understanding cutoffs and
              planning applications.
            </p>
            <Link
              href="/college-predictor"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 hover:text-neutral-600"
            >
              Start with the predictor
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
            <div className="flex items-center gap-2">
              <WhatsAppIcon className="h-5 w-5 text-neutral-700" />
              <h2 className="text-sm font-bold text-neutral-950">WhatsApp</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Prefer chat? Message us on WhatsApp and get admission help from anywhere in India.
            </p>
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 hover:text-neutral-600"
            >
              Chat on WhatsApp
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>

          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6">
            <h2 className="text-sm font-bold text-neutral-950">Email</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              For partnerships, data corrections and general support:
              <span className="mt-2 block font-semibold text-neutral-900">
                support@padhaanewala.in
              </span>
            </p>
            <p className="mt-4 text-xs text-neutral-500">
              Padhaanewala Edutech Services, Bengaluru - 560100
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}