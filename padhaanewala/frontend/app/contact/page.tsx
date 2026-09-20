import { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, MapPin, Clock, MessageCircle, HelpCircle, Headset } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdmissionHelpButton } from "@/components/admission/AdmissionForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Padhaanewala team for admissions, scholarships, partnerships or feedback.",
};

const CHANNELS = [
  { icon: <Phone className="h-5 w-5" />, title: "Call us", value: "+91 98765 43210", sub: "Mon–Sat, 9 AM – 8 PM" },
  { icon: <Mail className="h-5 w-5" />, title: "Email us", value: "support@padhaanewala.com", sub: "Replies within 24 hours" },
  { icon: <MessageCircle className="h-5 w-5" />, title: "WhatsApp", value: "+91 98765 43210", sub: "Quick replies on WhatsApp" },
  { icon: <MapPin className="h-5 w-5" />, title: "Office", value: "Bengaluru, Karnataka", sub: "Online counselling pan-India" },
];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <SectionHeading
        eyebrow="We're here to help"
        title="Contact Padhaanewala"
        description="Questions about college admissions, scholarships or the platform? Reach out — our team is happy to help."
      />

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map((c) => (
          <div key={c.title} className="rounded-2xl border border-slate-100 bg-white p-6 text-center transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-900/5">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-purple-600">{c.icon}</span>
            <h3 className="mt-4 font-bold text-gray-900">{c.title}</h3>
            <p className="mt-1 text-sm font-semibold text-purple-700">{c.value}</p>
            <p className="mt-0.5 text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-700 to-indigo-700 p-8 text-white">
          <Headset className="h-8 w-8" />
          <h3 className="mt-4 font-display text-xl font-extrabold">Talk to a student counsellor</h3>
          <p className="mt-2 text-sm text-white/80">
            Get free, expert guidance to shortlist colleges and plan your admission journey.
          </p>
          <div className="mt-5">
            <AdmissionHelpButton label="Book a free call" />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-8">
          <HelpCircle className="h-8 w-8 text-purple-600" />
          <h3 className="mt-4 font-display text-xl font-extrabold text-gray-900">Frequently asked questions</h3>
          <p className="mt-2 text-sm text-gray-500">
            Find answers about admissions, exams and the platform in our resources.
          </p>
          <Link href="/blog" className="mt-5 inline-block text-sm font-semibold text-purple-700 hover:text-purple-800">
            Read our guides →
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-8">
          <Clock className="h-8 w-8 text-purple-600" />
          <h3 className="mt-4 font-display text-xl font-extrabold text-gray-900">Response time</h3>
          <p className="mt-2 text-sm text-gray-500">
            We respond to every enquiry within 24 hours on business days.
          </p>
        </div>
      </div>
    </section>
  );
}