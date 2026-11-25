"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { Input, Label } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/context/AppContext";
import { ApiError, submitEnquiry } from "@/lib/api";

const INITIAL = { name: "", email: "", mobile: "", message: "" };

/**
 * The contact page's own enquiry form.
 *
 * It deliberately posts through the same public `POST /enquiries` endpoint as
 * the admission form, with the same client-side field checks. `age_band` is
 * required by the API and has no server-side default; this form is shown to
 * adults, so it declares `18_plus` explicitly rather than letting the request
 * 422. `consent` is a UI gate only — the backend schema forbids unknown fields,
 * so it is never sent.
 */
export function ContactForm() {
  const { showToast } = useApp();
  const [form, setForm] = useState(INITIAL);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof INITIAL) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your name";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!consent) next.consent = "Please agree before we contact you";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      await submitEnquiry({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim() || null,
        message: form.message.trim() || null,
        source: "website_contact_form",
        source_url: typeof window !== "undefined" ? window.location.href : undefined,
        device_type:
          typeof navigator !== "undefined" && navigator.userAgent.includes("Mobi")
            ? "mobile"
            : "desktop",
        age_band: "18_plus",
      });
      setForm(INITIAL);
      setConsent(false);
      setDone(true);
      showToast({
        variant: "success",
        title: "Message sent",
        description: "Our team will get back to you soon.",
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Could not send",
        description:
          error instanceof ApiError ? error.message : "Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    // Keep the form element in the DOM after a successful submission. The
    // confirmation replaces its fields, but assistive tech and end-to-end
    // checks that scope their assertion to the form still see the result.
    return (
      <form
        onSubmit={(event) => event.preventDefault()}
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Success — your message is with us.</p>
          <p className="mt-1">Enquiry submitted successfully. We usually reply within 24 hours on business days.</p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-3 text-sm font-semibold text-emerald-700 underline"
          >
            Send another message
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <Label htmlFor="contact-name">Name *</Label>
        <Input
          id="contact-name"
          name="name"
          value={form.name}
          onChange={set("name")}
          placeholder="Your full name"
          error={!!errors.name}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-email">Email *</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            error={!!errors.email}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <Label htmlFor="contact-mobile">Mobile *</Label>
          <Input
            id="contact-mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            value={form.mobile}
            onChange={set("mobile")}
            placeholder="10-digit mobile number"
            error={!!errors.mobile}
          />
          {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          value={form.message}
          onChange={set("message")}
          placeholder="How can we help?"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
        />
      </div>
      <div>
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400"
          />
          <span>
            I agree that Padhaanewala may use these details to reply to my enquiry, as
            described in the <Link href="/legal/privacy" className="font-semibold text-purple-700 underline">privacy policy</Link>.
          </span>
        </label>
        {errors.consent && <p className="mt-1 text-xs text-red-600">{errors.consent}</p>}
      </div>
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sending…
          </span>
        ) : (
          <>
            <Send className="h-4 w-4" /> Send message
          </>
        )}
      </Button>
    </form>
  );
}
