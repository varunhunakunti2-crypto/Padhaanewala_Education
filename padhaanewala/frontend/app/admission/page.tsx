import { Metadata } from "next";
import {
  Phone,
  Mail,
  MessageSquare,
  Users,
  FileText,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { AdmissionForm } from "@/components/admission/AdmissionForm";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Get Admission Help",
  description:
    "Get free admission counselling from Padhaanewala. Fill in your details and our expert counsellors will contact you with a personalised admission plan.",
};

const STEPS = [
  { icon: <FileText className="h-5 w-5" />, title: "Share your details", desc: "Tell us your course, state and goal." },
  { icon: <Users className="h-5 w-5" />, title: "Counsellor matching", desc: "We connect you with an admissions expert." },
  { icon: <Phone className="h-5 w-5" />, title: "Personal call", desc: "Get a free one-on-one counselling session." },
  { icon: <CheckCircle2 className="h-5 w-5" />, title: "Admission plan", desc: "Get a step-by-step plan for your admission." },
];

export default function AdmissionPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading
            eyebrow="Free Counselling"
            eyebrowTone="warm"
            title="Get Admission Help"
            description="Planning a college admission? Our expert counsellors help you shortlist the right colleges, understand cutoffs and complete every step of your application — completely free."
            align="left"
          />
          <div className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                  {s.icon}
                </span>
                <div>
                  <p className="flex items-center gap-2 font-bold text-gray-900">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-purple-600 text-[11px] font-bold text-white">{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="font-bold text-gray-900">Prefer to talk directly?</p>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 text-purple-600" /> +91 98765 43210 (Mon–Sat, 9 AM – 8 PM)
            </p>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 text-purple-600" /> counsellor@padhaanewala.com
            </p>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <MessageSquare className="h-4 w-4 text-purple-600" /> WhatsApp us on the same number
            </p>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-purple-600" /> Counselling available pan-India (online)
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5 sm:p-8">
          <h2 className="font-display text-xl font-extrabold text-gray-900">Submit your enquiry</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            Our counsellor will contact you within 24 hours.
          </p>
          <AdmissionForm compact />
        </div>
      </div>
    </section>
  );
}