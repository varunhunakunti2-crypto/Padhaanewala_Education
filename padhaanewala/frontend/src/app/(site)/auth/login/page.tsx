import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Padhaanewala account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-white px-4 py-16 text-neutral-900">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-black/5 bg-neutral-50 p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white">
              P
            </span>
            <span className="text-lg font-semibold tracking-tight text-neutral-950">
              Padhaanewala
            </span>
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-neutral-950">
            Sign in to Padhaanewala
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Access your saved colleges, scholarships and mock-test history.
          </p>

          <form className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 rounded-xl bg-white px-4 py-3 text-xs text-neutral-500">
            Account login is part of the upcoming release. For now, explore the platform as a
            guest — the predictor, mock tests and college data all work without an account.
          </p>

          <p className="mt-6 text-center text-sm text-neutral-500">
            New to Padhaanewala?{" "}
            <Link href="/" className="font-semibold text-neutral-950 hover:text-neutral-600">
              Explore for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}