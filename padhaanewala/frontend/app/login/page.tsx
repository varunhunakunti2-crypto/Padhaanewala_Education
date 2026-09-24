"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff, Phone, AlertCircle, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Header";
import {
  ApiError,
  authApi,
  storeAuth,
  storeUser,
  toStudentProfile,
} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setProfile, setAuthenticated, showToast } = useApp();
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login",
  );
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: typeof errors = {};
    if (mode === "signup" && name.trim().length < 3) errs.name = "Name must be at least 3 characters.";
    if (mode === "signup" && !/^[6-9]\d{9}$/.test(mobile)) errs.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Please enter a valid email.";
    if (password.length < 8) errs.password = mode === "signup" ? "Password must be at least 8 characters." : "Please enter your password.";
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError("");
    setLoading(true);
    try {
      const tokens =
        mode === "login"
          ? await authApi.login({ email, password })
          : await authApi.register({ name, email, mobile, password });
      storeAuth(tokens);
      setAuthenticated(true);
      await completeSession();
      const next = searchParams.get("next");
      showToast({
        variant: "success",
        title: mode === "login" ? "Welcome back!" : "Account created!",
        description:
          mode === "login"
            ? "You are now logged in to Padhaanewala."
            : "Your account is ready. Welcome to Padhaanewala!",
      });
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
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

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="w-full rounded-2xl bg-white p-8 ring-1 ring-purple-100/60 card-shadow sm:p-10">
        <h1 className="font-display text-center text-2xl font-extrabold tracking-tight text-purple-950">
          {mode === "login" ? "Sign in to Padhaanewala" : "Create your account"}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          {mode === "login"
            ? "Enter your email and password to access your dashboard."
            : "Join 2.4 lakh+ students exploring colleges on Padhaanewala."}
        </p>

        {serverError && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
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

          {mode === "signup" && (
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
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
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

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
              <input
                id="email"
                type="email"
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

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
<input
                  id="password"
                  type={showPw ? "text" : "password"}
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
                <span>{mode === "login" ? "Sign in" : "Create account"}</span>
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
                onClick={() => setMode("signup")}
                className="font-semibold text-blue-600 hover:text-purple-700"
              >
                Create one free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-semibold text-blue-600 hover:text-purple-700"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        By continuing you agree to our{" "}
        <Link href="/about" className="text-blue-600 hover:underline">Terms</Link>
        {" "}and{" "}
        <Link href="/about" className="text-blue-600 hover:underline">Privacy Policy</Link>.
      </p>
    </section>
  );
}