import type { ReactNode } from "react";
import Link from "next/link";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
};

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-white px-4 py-16 text-neutral-900">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-black/5 bg-neutral-50 p-8 shadow-sm">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white">
              P
            </span>
            <span className="text-lg font-semibold tracking-tight text-neutral-950">
              Padhaanewala
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-neutral-950">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
          <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-neutral-950/5 px-3 py-1 text-xs font-medium text-neutral-600">
            {eyebrow}
          </p>

          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-4 text-center">{footer}</div>
      </div>
    </div>
  );
}