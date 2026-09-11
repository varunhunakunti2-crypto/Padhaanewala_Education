"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="mt-5 flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder="Email Address"
        className="h-12 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-jh-yellow"
      />
      <button
        type="submit"
        className="h-12 shrink-0 rounded-full bg-jh-yellow px-6 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-[#FFD93D]"
      >
        {submitted ? "Subscribed" : "Submit"}
      </button>
    </form>
  );
}