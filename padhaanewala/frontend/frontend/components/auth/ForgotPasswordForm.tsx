"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Send } from "lucide-react";

import { otpApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Header";

/**
 * Requests a password-reset link.
 *
 * The confirmation copy is fixed and identical whether or not the address has an
 * account, matching the backend's deliberate uniformity. Showing "no account with
 * that email" here would undo the anti-enumeration work in `forgot_password`.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await otpApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not send the reset link. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="w-full rounded-2xl bg-white p-8 ring-1 ring-purple-100/60 card-shadow sm:p-10">
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-purple-950">
              Check your inbox
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              If an account exists for{" "}
              <span className="font-semibold text-gray-700">{email}</span>, a reset link is
              on its way. It works once and expires in an hour.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Nothing arrived? Check your spam folder, or confirm you used the address
              you signed up with.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-6 w-full"
              onClick={() => setSent(false)}
            >
              Send to a different address
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-center text-2xl font-extrabold tracking-tight text-purple-950">
              Forgot your password?
            </h1>
            <p className="mt-2 text-center text-sm text-gray-500">
              Enter the email address on your account and we will send you a link to
              choose a new password.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className={cn(
                      "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm shadow-sm transition-colors focus:outline-none",
                      error
                        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending…
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send reset link
                  </>
                )}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
