"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

import { otpApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Header";

/**
 * Rules the backend enforces via `ResetPasswordRequest`. Mirrored here so the
 * user finds out before a round-trip, not after one.
 */
const PASSWORD_RULES: readonly { test: RegExp; label: string }[] = [
  { test: /^.{8,}$/, label: "At least 8 characters" },
  { test: /[a-z]/, label: "A lowercase letter" },
  { test: /[A-Z]/, label: "An uppercase letter" },
  { test: /\d/, label: "A number" },
];

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const met = useMemo(
    () => PASSWORD_RULES.map((rule) => rule.test.test(password)),
    [password],
  );
  const allMet = met.every(Boolean);
  const mismatch = confirm.length > 0 && confirm !== password;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!allMet) {
      setError("Your new password does not meet all the requirements above.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await otpApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That reset link is invalid or has expired.",
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
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-purple-950">
              Password changed
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              Your new password is active. Sign in with it to continue.
            </p>
            <ButtonLink
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              href="/login"
            >
              Sign in
            </ButtonLink>
          </div>
        ) : (
          <>
            <h1 className="font-display text-center text-2xl font-extrabold tracking-tight text-purple-950">
              Choose a new password
            </h1>
            <p className="mt-2 text-center text-sm text-gray-500">
              Pick something you have not used here before.
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
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm shadow-sm transition-colors focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>

                <ul className="mt-3 space-y-1">
                  {PASSWORD_RULES.map((rule, i) => (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        met[i] ? "text-emerald-600" : "text-gray-400",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          met[i] ? "bg-emerald-500" : "bg-gray-300",
                        )}
                      />
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm shadow-sm transition-colors focus:outline-none",
                      mismatch
                        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                    )}
                  />
                </div>
                {mismatch && (
                  <p className="mt-1 text-xs text-red-500">The two passwords do not match.</p>
                )}
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={loading || !allMet || mismatch}
              >
                {loading ? "Saving…" : "Save new password"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
