"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Phone,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  MailCheck,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Header";
import {
  ApiError,
  authApi,
  isEmailNotVerified,
  otpApi,
  storeAuth,
  storeUser,
  toStudentProfile,
  type AgeBand,
  type AuthTokens,
} from "@/lib/api";

type Mode = "login" | "signup" | "otp";
/** Within the OTP mode: which half of the two-step challenge is on screen. */
type OtpStage = "mobile" | "code";

/** Matches the backend's `SMS_OTP_MAX_SENDS_PER_WINDOW` of 3 per 10 minutes. */
const RESEND_COOLDOWN_SECONDS = 45;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setProfile, setAuthenticated, showToast } = useApp();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "login",
  );

  useEffect(() => {
    const targetMode = searchParams.get("mode") === "signup" ? "signup" : "login";
    setMode(targetMode);
    setServerError("");
    setErrors({});
  }, [searchParams]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
// Signup only, and deliberately not defaulted: `RegisterRequest.age_band` has no
// default on the server either, because an account whose age is unknown would
// have to be treated as either adult or blocked, and the first of those is the
// failure DPDP s.9 exists to close. Empty means "not asked yet", so the form
// cannot be submitted before the question is answered.
const [ageBand, setAgeBand] = useState<AgeBand | "">("");
  const [errors, setErrors] = useState<{
  name?: string;
  mobile?: string;
  email?: string;
  password?: string;
  age?: string;
}>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Phase 3: OTP login + email-verification gate ---
  const [otpStage, setOtpStage] = useState<OtpStage>("mobile");
  const [otpCode, setOtpCode] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Set when login is refused *only* because the address is unconfirmed, so the
  // UI can offer a resend instead of asking for the password again.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const validate = () => {
    const errs: typeof errors = {};
    if (mode === "signup" && name.trim().length < 3) errs.name = "Name must be at least 3 characters.";
    if (mode === "signup" && !/^[6-9]\d{9}$/.test(mobile)) errs.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (mode !== "otp" && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Please enter a valid email.";
    if (mode !== "otp" && password.length < 8) errs.password = mode === "signup" ? "Password must be at least 8 characters." : "Please enter your password.";
    if (mode === "otp" && otpStage === "mobile" && !/^[6-9]\d{9}$/.test(mobile)) errs.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (mode === "otp" && otpStage === "code" && !/^\d{4,8}$/.test(otpCode)) errs.password = "Enter the code from your SMS.";
    // Without this the register call omits the field entirely and the server
    // answers 422 — the failure this whole block was added to prevent.
    if (mode === "signup" && ageBand === "") errs.age = "Please tell us whether you are under 18.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const completeSession = async () => {
    try {
      const profile = await authApi.myProfile();
      storeUser(profile);
      setProfile(toStudentProfile(profile));
    } catch {
      /* profile optional — session works without persisted preferences */
    }
  };

  const finishLogin = async (next: string | null, title: string, description: string) => {
    setAuthenticated(true);
    await completeSession();
    showToast({ variant: "success", title, description });
    router.push(next && next.startsWith("/") ? next : "/dashboard");
  };

  const sendOtp = async () => {
    setServerError("");
    setOtpNotice("");
    setLoading(true);
    try {
      const res = await otpApi.sendLoginOtp(mobile);
      setOtpNotice(res.message);
      setOtpStage("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      // No rate-limit branch here on purpose: `login/otp/send` absorbs a 429
      // rather than reporting it, because a per-number 429 would only ever be
      // reachable for a registered number and would leak exactly that.
      setServerError(
        err instanceof Error
          ? err.message
          : "We could not send the OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setServerError("");
    setLoading(true);
    try {
      const tokens = await otpApi.verifyLoginOtp(mobile, otpCode);
      storeAuth(tokens);
      await finishLogin(
        searchParams.get("next"),
        "Welcome back!",
        "You are now logged in to Padhaanewala.",
      );
    } catch (err) {
      // The code was right; the address is not confirmed yet. The backend checks
      // this here rather than at send, so the resend banner is the way out.
      if (isEmailNotVerified(err)) {
        setUnverifiedEmail(err.detail.email);
        setServerError("");
        setOtpCode("");
        return;
      }
      setServerError(
        err instanceof Error
          ? err.message
          : "That code is not valid. Request a new one and try again.",
      );
      // A wrong code stays in the box for correction rather than being cleared,
      // but a fresh send replaces it entirely.
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      const res = await otpApi.resendVerification(unverifiedEmail);
      showToast({ variant: "success", title: "Confirmation sent", description: res.message });
    } catch {
      showToast({
        variant: "error",
        title: "Could not resend",
        description: "Please try again in a moment.",
      });
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError("");

    if (mode === "otp") {
      if (otpStage === "mobile") await sendOtp();
      else await verifyOtp();
      return;
    }

    // `validate` already rejected an unanswered band, so the guard inside the
    // signup branch below is unreachable. It is there to narrow the type rather
    // than to default the band to adult, which is the exact shortcut
    // `RegisterRequest.age_band` was written without a default to forbid.

    setLoading(true);
    try {
      // An if/else rather than a ternary so the age band narrows *inside* the
      // signup branch. The unreachable guard below is the point: without it the
      // only way to satisfy the type would be to default the band to adult,
      // which is precisely what `RegisterRequest.age_band` having no default is
      // written to forbid.
      let tokens: AuthTokens;
      if (mode === "login") {
        tokens = await authApi.login({ email, password });
      } else {
        if (ageBand === "") return;
        tokens = await authApi.register({ name, email, mobile, password, age_band: ageBand });
      }
      storeAuth(tokens);
      setUnverifiedEmail(null);
      await finishLogin(
        searchParams.get("next"),
        mode === "login" ? "Welcome back!" : "Account created!",
        mode === "login"
          ? "You are now logged in to Padhaanewala."
          : "Your account is ready. Welcome to Padhaanewala!",
      );
    } catch (err) {
      if (mode === "login" && isEmailNotVerified(err)) {
        // Not a failure to report as an error: the credentials were right, and
        // the only thing missing is the confirmation click.
        setUnverifiedEmail(err.detail.email);
        setServerError("");
        return;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      setServerError(message);
      showToast({ variant: "error", title: "Could not sign in", description: message });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setServerError("");
    setErrors({});
    setOtpNotice("");
    // The banner belongs to the account that just refused to sign in; carrying
    // it into an unrelated attempt would offer a resend for the wrong address.
    setUnverifiedEmail(null);
    if (next === "otp") {
      setOtpStage("mobile");
      setOtpCode("");
    }
  };

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="w-full rounded-2xl bg-white p-8 ring-1 ring-purple-100/60 card-shadow sm:p-10">
        <h1 className="font-display text-center text-2xl font-extrabold tracking-tight text-purple-950">
          {mode === "login"
            ? "Sign in to Padhaanewala"
            : mode === "signup"
              ? "Create your account"
              : "Sign in with an OTP"}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          {mode === "login"
            ? "Enter your email and password to access your account."
            : mode === "signup"
              ? "Create a free account to save colleges across devices."
              : otpStage === "mobile"
                ? "We will text a one-time code to the mobile on your account."
                : "Enter the code we just sent by SMS."}
        </p>

        {unverifiedEmail && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">Confirm your email address</p>
                <p className="mt-1 leading-relaxed">
                  Your password is correct, but{" "}
                  <span className="font-medium">{unverifiedEmail}</span> has not been
                  confirmed yet. Open the link we emailed you, or send a fresh one.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={resendVerification}
                  disabled={resending}
                >
                  {resending ? "Sending…" : "Resend confirmation email"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        {otpNotice && !serverError && (
          <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-700">
            {otpNotice}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  className={cn(
                    "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm shadow-sm transition-colors focus:outline-none",
                    errors.name
                      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                  )}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>
          )}

          {(mode === "signup" || (mode === "otp" && otpStage === "mobile")) && (
            <div>
              <label htmlFor="mobile" className="mb-1 block text-sm font-medium text-gray-700">
                Mobile number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className={cn(
                    "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm shadow-sm transition-colors focus:outline-none",
                    errors.mobile
                      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                  )}
                />
              </div>
              {errors.mobile && <p className="mt-1 text-xs text-red-500">{errors.mobile}</p>}
            </div>
          )}

          {mode === "otp" && otpStage === "code" && (
            <div>
              <label htmlFor="otp" className="mb-1 block text-sm font-medium text-gray-700">
                One-time code
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="6-digit code"
                  className={cn(
                    "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm tracking-[0.3em] shadow-sm transition-colors focus:outline-none",
                    errors.password
                      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                  )}
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}

              <div className="mt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStage("mobile");
                    setOtpCode("");
                    setOtpNotice("");
                    setServerError("");
                  }}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Change number
                </button>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={cooldown > 0 || loading}
                  className="font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {mode !== "otp" && (
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya@example.com"
                  className={cn(
                    "h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm shadow-sm transition-colors focus:outline-none",
                    errors.email
                      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                  )}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
          )}

          {mode !== "otp" && (
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                {mode === "login" && (
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
                  className={cn(
                    "h-11 w-full rounded-xl border bg-white pl-10 pr-10 text-sm shadow-sm transition-colors focus:outline-none",
                    errors.password
                      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200",
                  )}
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
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>
          )}

          {mode === "signup" && (
            <fieldset className="rounded-xl border border-gray-200 px-4 py-3.5">
              <legend className="px-1 text-sm font-medium text-gray-700">
                Are you under 18?
              </legend>
              <p className="mb-2.5 text-xs leading-relaxed text-gray-500">
                We ask only this, because Indian law treats personal data of a
                person under 18 differently. We never ask for your date of birth.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "18_plus" as AgeBand, label: "I am 18 or older" },
                    { value: "under_18" as AgeBand, label: "I am under 18" },
                  ]
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                      ageBand === option.value
                        ? "border-purple-400 bg-purple-50 text-purple-900"
                        : "border-gray-200 text-gray-700 hover:border-purple-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="signup-age"
                      value={option.value}
                      checked={ageBand === option.value}
                      onChange={() => {
                        setAgeBand(option.value);
                        setErrors((e) => ({ ...e, age: undefined }));
                      }}
                      className="h-4 w-4 border-gray-300 accent-purple-600"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {errors.age && (
                <p className="mt-2 text-xs text-red-500" role="alert">
                  {errors.age}
                </p>
              )}
            </fieldset>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Please wait…
              </span>
            ) : (
              <>
                <span>
                  {mode === "signup"
                    ? "Create account"
                    : mode === "otp"
                      ? otpStage === "mobile"
                        ? "Send OTP"
                        : "Verify and sign in"
                      : "Sign in"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              {"Don't have an account? "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-blue-600 hover:text-purple-700"
              >
                Create one free
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-semibold text-blue-600 hover:text-purple-700"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-semibold text-blue-600 hover:text-purple-700"
              >
                Sign in with a password
              </button>{" "}
              instead
            </>
          )}
        </p>

        {mode === "login" && (
          <p className="mt-3 text-center text-sm">
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className="inline-flex items-center gap-1.5 font-semibold text-purple-600 hover:underline"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Use a one-time code instead
            </button>
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        By continuing you agree to our{" "}
        <Link href="/legal/terms" className="text-blue-600 hover:underline">Terms</Link>
        {" "}and{" "}
        <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
      </p>
    </section>
  );
}
