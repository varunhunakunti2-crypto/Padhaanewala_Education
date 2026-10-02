import { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, MapPin, Clock, MessageCircle, HelpCircle, Headset } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdmissionHelpButton } from "@/components/admission/AdmissionForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the Padhaanewala team for admissions, scholarships, partnerships or feedback.",
  path: "/contact",
});

/**
 * Read from `SITE` rather than retyped.
 *
 * This page published `support@padhaanewala.com` while the site is
 * `padhaanewala.in` and every legal document names `hello@padhaanewala.in`. Mail
 * to the `.com` address is delivered to a domain we may not even control, so the
 * address a customer is told to use for support was not the address that
 * reaches support. Three contact points for one small company is the same defect
 * in a different guise, so there is now one.
 */
interface Channel {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly value: string;
  /** Absent for a channel with no address to link, e.g. the postal office. */
  readonly href?: string;
  readonly sub: string;
}

const CHANNELS: readonly Channel[] = [
  { icon: <Phone className="h-5 w-5" />, title: "Call us", value: SITE.phone, href: `tel:${SITE.phoneRaw}`, sub: "Mon–Sat, 9 AM – 8 PM IST" },
  { icon: <Mail className="h-5 w-5" />, title: "Email us", value: SITE.email, href: `mailto:${SITE.email}`, sub: "Replies within 24 hours on business days" },
  { icon: <MessageCircle className="h-5 w-5" />, title: "WhatsApp", value: SITE.phone, href: `https://wa.me/${SITE.whatsapp}`, sub: "Quick replies on WhatsApp" },
  { icon: <MapPin className="h-5 w-5" />, title: "Office", value: `${SITE.address.locality}, ${SITE.address.region}`, sub: "Online counselling pan-India" },
];

const CHANNEL_CARD =
  "rounded-2xl border border-slate-100 bg-white p-6 text-center transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-900/5";

function ChannelBody({ channel }: { channel: Channel }) {
  return (
    <>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-purple-600">{channel.icon}</span>
      <h3 className="mt-4 font-bold text-gray-900">{channel.title}</h3>
      <p className="mt-1 text-sm font-semibold text-purple-700">{channel.value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{channel.sub}</p>
    </>
  );
}

export default function ContactPage() {
  const jsonLd = ldGraph([
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ]),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <JsonLd data={jsonLd} />
      <SectionHeading
        eyebrow="We're here to help"
        title="Contact Padhaanewala"
        description="Questions about college admissions, scholarships or the platform? Reach out — our team is happy to help."
      />

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map((c) =>
          c.href ? (
            <a
              key={c.title}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noreferrer" : undefined}
              className={CHANNEL_CARD}
            >
              <ChannelBody channel={c} />
            </a>
          ) : (
            <div key={c.title} className={CHANNEL_CARD}>
              <ChannelBody channel={c} />
            </div>
          ),
        )}
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
            We respond to every enquiry within 24 hours on business days. Complaints
            about the site itself go to our Grievance Officer instead — see the{" "}
            <Link href="/legal/grievance" className="font-semibold text-purple-700 hover:underline">
              Grievance Redressal page
            </Link>
            , which sets out the escalation route and the 30-day response window.
          </p>
        </div>
      </div>
    </section>
  );
}