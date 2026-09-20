"use client";

import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";

export function StayUpdatedBanner() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="relative isolate overflow-hidden rounded-3xl border border-purple-100 bg-[#f4effe] p-8 sm:p-10 lg:p-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          {/* Left copy */}
          <div className="max-w-md">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              Stay Updated
            </h2>
            <p className="mt-1.5 text-sm text-gray-600 sm:text-base">
              Get the latest college news, admission alerts and expert tips.
            </p>
          </div>

          {/* Right form & airplane doodle */}
          <div className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center md:w-auto">
            {subscribed ? (
              <div className="rounded-xl bg-purple-100 px-6 py-3.5 text-sm font-bold text-purple-800">
                ✓ Thank you for subscribing! Check your inbox soon.
              </div>
            ) : (
              <form
                onSubmit={handleSubscribe}
                className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center md:w-auto"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-12 w-full min-w-[260px] rounded-xl border border-purple-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 sm:w-72"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-6 text-sm font-bold text-white shadow-md shadow-purple-600/25 transition hover:bg-purple-700 active:scale-95"
                >
                  Subscribe <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Paper Airplane Doodle */}
            <div className="hidden text-purple-500 lg:block lg:pl-2">
              <Send className="h-10 w-10 -rotate-12 stroke-[1.5]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
