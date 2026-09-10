"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon, CloseIcon, ArrowRightIcon } from "@/components/icons";

const navLinks = [
  { label: "Colleges", href: "/colleges" },
  { label: "Courses", href: "/courses" },
  { label: "Predictor", href: "/college-predictor" },
  { label: "Scholarships", href: "/scholarships" },
  { label: "Mock Tests", href: "/mock-tests" },
  { label: "Exams", href: "/exams" },
  { label: "Blog", href: "/blog" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight text-neutral-950">
            Padhaanewala
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/auth/login"
            className="text-sm font-semibold text-neutral-700 transition-colors hover:text-neutral-950"
          >
            Login
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Get Admission Help
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-black/5 pt-4">
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-200 px-4 py-2.5 text-center text-sm font-semibold text-neutral-800"
              >
                Login
              </Link>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white"
              >
                Get Admission Help
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}