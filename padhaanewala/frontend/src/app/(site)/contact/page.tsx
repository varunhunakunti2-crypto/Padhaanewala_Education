import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ChatIcon, WhatsAppIcon, BadgeCheckIcon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import ContactForm from "@/components/contact/ContactForm";

const WHATSAPP_NUMBER = "919000000000";

export const metadata: Metadata = {
  title: "Contact Padhaanewala",
  description:
    "Get in touch with the Padhaanewala team for free admission counselling and support. Request a callback, chat on WhatsApp or email us.",
};

const channels = [
  {
    icon: <ChatIcon className="h-5 w-5 text-neutral-700" />,
    title: "Free counselling",
    body: "Talk to our counsellors for help shortlisting colleges, understanding cutoffs and planning applications.",
    action: { label: "Start with the predictor", href: "/college-predictor" },
  },
  {
    icon: <WhatsAppIcon className="h-5 w-5 text-neutral-700" />,
    title: "WhatsApp",
    body: "Prefer chat? Message us on WhatsApp and get admission help from anywhere in India.",
    action: { label: "Chat on WhatsApp", href: `https://wa.me/${WHATSAPP_NUMBER}`, external: true },
  },
];

export default function ContactPage() {
  return (
    <div className="bg-white text-neutral-900 dark:bg-[#0a0a0a] dark:text-neutral-100">
      <section className="border-b border-black/5 bg-neutral-50 dark:bg-neutral-900/60">
        <div className="mx-auto w-full max-w-[1536px] px-4 py-12 sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
              Contact us
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-3 max-w-2xl text-sm text-neutral-500 sm:text-base">
              Questions about admissions, counselling or your account? Reach out — we respond within
              one working day.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex h-full flex-col gap-6">
              {channels.map((channel) => (
                <div
                  key={channel.title}
                  className="rounded-2xl border border-black/5 bg-neutral-50 p-6 dark:border-white/10 dark:bg-neutral-900/60"
                >
                  <div className="flex items-center gap-2">
                    {channel.icon}
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      {channel.title}
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {channel.body}
                  </p>
                  {channel.action.external ? (
                    <a
                      href={channel.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
                    >
                      {channel.action.label}
                      <ArrowRightIcon className="h-4 w-4" />
                    </a>
                  ) : (
                    <Link
                      href={channel.action.href}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
                    >
                      {channel.action.label}
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))}

              <div className="rounded-2xl border border-black/5 bg-neutral-50 p-6 dark:border-white/10 dark:bg-neutral-900/60">
                <h2 className="text-sm font-bold text-neutral-950 dark:text-white">Email</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  For partnerships, data corrections and general support:
                  <span className="mt-2 block font-semibold text-neutral-900 dark:text-white">
                    support@padhaanewala.in
                  </span>
                </p>
                <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
                  Padhaanewala Edutech Services, Bengaluru - 560100
                </p>
              </div>

              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <li className="inline-flex items-center gap-1.5">
                  <BadgeCheckIcon className="h-4 w-4 text-emerald-600" />
                  Free of cost
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <BadgeCheckIcon className="h-4 w-4 text-emerald-600" />
                  Response within 1 working day
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <BadgeCheckIcon className="h-4 w-4 text-emerald-600" />
                  No spam — ever
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}