"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { WhatsAppIcon, ArrowRightIcon } from "@/components/icons";

type FieldName = "name" | "mobile" | "email";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950 focus-visible:ring-2 focus-visible:ring-violet-500/40";

function validateName(v: string): string | undefined {
  if (!v.trim()) return "Please enter your name";
  if (v.trim().length < 2) return "Name must be at least 2 characters";
  return undefined;
}

function validateMobile(v: string): string | undefined {
  const digits = v.replace(/[\s-]/g, "");
  if (!digits) return "Please enter your mobile number";
  if (!/^(\+?91)?[6-9]\d{9}$/.test(digits)) {
    return "Enter a valid 10-digit Indian mobile number";
  }
  return undefined;
}

function validateEmail(v: string): string | undefined {
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address";
  }
  return undefined;
}

export default function ContactForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const utm = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);

  function validate(): boolean {
    const next: FieldErrors = {
      name: validateName(name),
      mobile: validateMobile(mobile),
      email: validateEmail(email),
    };
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (company) return; // honeypot — bait for bots
    setStatus("idle");
    setErrorText("");
    if (!validate()) return;

    setStatus("submitting");
    const deviceType = navigator.userAgent.includes("Mobi") ? "mobile" : "desktop";
    const combinedMessage = [
      interest.trim() ? `Interested in: ${interest.trim()}` : "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await apiFetch("/api/v1/enquiries", {
        method: "POST",
        body: {
          name: name.trim(),
          mobile: mobile.replace(/[\s-]/g, ""),
          email: email.trim() || null,
          message: combinedMessage || null,
          source: "website_contact",
          source_url: window.location.href,
          device_type: deviceType,
          utm_source: utm?.get("utm_source") ?? null,
          utm_medium: utm?.get("utm_medium") ?? null,
          utm_campaign: utm?.get("utm_campaign") ?? null,
        },
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorText(
        err instanceof ApiError
          ? err.message
          : "We couldn't submit your request right now."
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex h-full flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <p className="text-sm font-bold text-emerald-800">
          Thank you, {name.split(" ")[0] || "friend"}! Your request has been received.
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-700">
          Our counsellors will reach out on {mobile} within one working day. For
          faster help, chat with us on WhatsApp.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://wa.me/919000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-transform hover:scale-105"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Chat now
          </a>
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Explore colleges
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-bold text-neutral-950">Request free counselling</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Share your details and a counsellor will call you back — free of cost.
        </p>
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorText}{" "}
          <span>
            Meanwhile, you can{" "}
            <a
              href="https://wa.me/919000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              chat on WhatsApp
            </a>{" "}
            or email{" "}
            <a href="mailto:support@padhaanewala.in" className="font-semibold underline">
              support@padhaanewala.in
            </a>.
          </span>
        </div>
      )}

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-neutral-700">
          Full name <span className="text-red-600">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
          }}
          placeholder="e.g. Ananya Sharma"
          className={inputClass}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
        />
        {errors.name && (
          <p id="contact-name-error" className="mt-1 text-xs text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-mobile" className="block text-sm font-medium text-neutral-700">
          Mobile number <span className="text-red-600">*</span>
        </label>
        <input
          id="contact-mobile"
          type="tel"
          name="mobile"
          inputMode="numeric"
          autoComplete="tel"
          required
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value);
            if (errors.mobile) setErrors((p) => ({ ...p, mobile: undefined }));
          }}
          placeholder="10-digit mobile number"
          className={inputClass}
          aria-invalid={!!errors.mobile}
          aria-describedby={errors.mobile ? "contact-mobile-error" : undefined}
        />
        {errors.mobile && (
          <p id="contact-mobile-error" className="mt-1 text-xs text-red-600">
            {errors.mobile}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-neutral-700">
          Email <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder="you@example.com"
          className={inputClass}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
        />
        {errors.email && (
          <p id="contact-email-error" className="mt-1 text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-interest" className="block text-sm font-medium text-neutral-700">
          Course or career you&apos;re exploring <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="contact-interest"
          type="text"
          name="interest"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          placeholder="e.g. MBBS, B.Sc Nursing, B.Tech"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-700">
          Message <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your rank, budget or preferences"
          className={`${inputClass} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 text-sm font-semibold text-white transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting…" : "Request a call back"}
        {status !== "submitting" && <ArrowRightIcon className="h-4 w-4" />}
      </button>

      <p className="text-xs text-neutral-500">
        Your details are used only to contact you about admissions. We never share
        your information.
      </p>
    </form>
  );
}