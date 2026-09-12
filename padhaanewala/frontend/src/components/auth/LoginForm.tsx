"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { login, storeTokens, ApiError } from "@/lib/api";

type FieldErrors = {
  email?: string;
  password?: string;
};

function validateEmail(v: string): string | undefined {
  const v2 = v.trim();
  if (!v2) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v2)) return "Enter a valid email address";
  return undefined;
}

function validatePassword(v: string): string | undefined {
  if (!v) return "Password is required";
  if (v.length < 8) return "Password must be at least 8 characters";
  return undefined;
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const next: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const tokens = await login(email.trim(), password);
      storeTokens(tokens);
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get("next") ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Explore colleges, mock tests & scholarships"
      title="Sign in to Padhaanewala"
      subtitle="Access your saved colleges, scholarships and mock-test history."
      footer={
        <p className="text-sm text-neutral-500">
          New to Padhaanewala?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-neutral-950 hover:text-neutral-600"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-neutral-700"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              if (formError) setFormError(null);
            }}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-neutral-700"
          >
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((p) => ({ ...p, password: undefined }));
                if (formError) setFormError(null);
              }}
              placeholder="8+ characters"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 pr-16 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}