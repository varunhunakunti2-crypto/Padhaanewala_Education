"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { register, storeTokens, ApiError } from "@/lib/api";

type FieldErrors = {
  name?: string;
  email?: string;
  mobile?: string;
  password?: string;
  confirmPassword?: string;
};

function validateName(v: string): string | undefined {
  const v2 = v.trim();
  if (!v2) return "Name is required";
  if (v2.length < 2) return "Name must be at least 2 characters";
  if (v2.length > 255) return "Name is too long";
  return undefined;
}

function validateEmail(v: string): string | undefined {
  const v2 = v.trim();
  if (!v2) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v2)) return "Enter a valid email address";
  return undefined;
}

function sanitizeMobile(v: string): string {
  return v.replace(/\D/g, "").replace(/^91/, "");
}

function validateMobile(v: string): string | undefined {
  const digits = sanitizeMobile(v);
  if (!digits) return "Mobile number is required";
  if (digits.length !== 10)
    return "Mobile must be a valid 10-digit Indian number";
  if (!"6789".includes(digits[0]))
    return "Mobile must start with 6, 7, 8 or 9";
  return undefined;
}

function validatePassword(v: string): string | undefined {
  if (!v) return "Password is required";
  if (v.length < 8) return "Password must be at least 8 characters";
  if (v.length > 128) return "Password is too long";
  return undefined;
}

function validateConfirm(
  password: string,
  confirmPassword: string
): string | undefined {
  if (!confirmPassword) return "Please confirm your password";
  if (password !== confirmPassword) return "Passwords do not match";
  return undefined;
}

function passwordStrength(v: string): { score: number; label: string; color: string } {
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-400" };
  if (score <= 4) return { score, label: "Strong", color: "bg-lime-500" };
  return { score, label: "Very strong", color: "bg-green-600" };
}

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const strength = passwordStrength(password);

  function validate(): boolean {
    const next: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      mobile: validateMobile(mobile),
      password: validatePassword(password),
      confirmPassword: validateConfirm(password, confirmPassword),
    };
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
  }

  function clearFieldError(key: keyof FieldErrors) {
    setErrors((p) => ({ ...p, [key]: undefined }));
    if (formError) setFormError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const tokens = await register({
        name: name.trim(),
        email: email.trim(),
        mobile: sanitizeMobile(mobile),
        password,
      });
      storeTokens(tokens);
      router.replace("/");
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
      eyebrow="Start your college search journey"
      title="Create your account"
      subtitle="Save colleges, track scholarships and take mock tests — all in one place."
      footer={
        <p className="text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-neutral-950 hover:text-neutral-600"
          >
            Sign in
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

        {/* Name */}
        <div>
          <label
            htmlFor="signup-name"
            className="block text-sm font-medium text-neutral-700"
          >
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            placeholder="e.g. Priya Sharma"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="signup-email"
            className="block text-sm font-medium text-neutral-700"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Mobile */}
        <div>
          <label
            htmlFor="signup-mobile"
            className="block text-sm font-medium text-neutral-700"
          >
            Mobile number
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
              +91
            </span>
            <input
              id="signup-mobile"
              type="tel"
              name="mobile"
              autoComplete="tel-national"
              required
              value={mobile}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d+]/g, "");
                setMobile(raw);
                clearFieldError("mobile");
              }}
              placeholder="98765 43210"
              className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-12 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
              aria-invalid={!!errors.mobile}
            />
          </div>
          {errors.mobile && (
            <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="signup-password"
            className="block text-sm font-medium text-neutral-700"
          >
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
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
          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < strength.score ? strength.color : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label
            htmlFor="signup-confirm"
            className="block text-sm font-medium text-neutral-700"
          >
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearFieldError("confirmPassword");
            }}
            placeholder="Re-enter your password"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
            aria-invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}