"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";

import { otpApi } from "@/lib/api";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Header";

type State = "verifying" | "success" | "error";

/**
 * Consumes a one-shot email-confirmation link.
 *
 * The token is submitted automatically on mount because the only way to arrive
 * here is by clicking a link in an email — a form the user still had to press
 * would just be a second chance to lose the token.
 *
 * `POST /auth/verify-email` collapses absent / expired / already-used / wrong
 * into one 400, so the error copy deliberately does not speculate about which it
 * was, and offers a resend instead.
 */
export function VerifyEmailPanel({ token }: { token: string }) {
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");
  // React 18 StrictMode mounts effects twice in development, which would consume
  // a single-use token on the first pass and then show a spurious "expired".
  // A ref, not state, because it guards a side effect rather than driving render.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    otpApi
      .verifyEmail(token)
      .then((res) => {
        setState("success");
        setMessage(res.message || "Your email address is confirmed.");
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "That confirmation link is invalid or has expired.",
        );
      });
  }, [token]);

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="w-full rounded-2xl bg-white p-8 text-center ring-1 ring-purple-100/60 card-shadow sm:p-10">
        {state === "verifying" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-purple-500" aria-hidden="true" />
            <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-purple-950">
              Confirming your email
            </h1>
            <p className="mt-2 text-sm text-gray-500">One moment…</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-purple-950">
              Email confirmed
            </h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <ButtonLink variant="accent" size="lg" className="mt-6 w-full" href="/dashboard">
              Go to your dashboard
            </ButtonLink>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-purple-950">
              That link did not work
            </h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <p className="mt-4 text-sm text-gray-500">
              Confirmation links work once and expire. If you still need to confirm
              this address, request a fresh one from the sign-in page.
            </p>
            <ButtonLink variant="accent" size="lg" className="mt-6 w-full" href="/login">
              Back to sign in
            </ButtonLink>
          </>
        )}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
        <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
        We only use your email to confirm your account and to let you back in.
      </p>
    </section>
  );
}
