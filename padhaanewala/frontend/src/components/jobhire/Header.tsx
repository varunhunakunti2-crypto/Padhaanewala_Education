"use client";

import { useState } from "react";
import { navLinks } from "./data";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "./icons";

function Logo() {
  return (
    <a href="#" className="flex items-center gap-2" aria-label="Jobhire home">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#55C99A] to-[#FFE65C] text-sm font-bold text-white shadow-sm"
        aria-hidden="true"
      >
        J
      </span>
      <span className="text-xl font-bold tracking-tight text-jh-ink">Jobhire</span>
    </a>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-jh-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-jh-muted transition-colors duration-200 hover:bg-jh-teal/50 hover:text-jh-ink"
            >
              {link.label}
              {link.hasDropdown && <ChevronDownIcon className="h-3.5 w-3.5" />}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#"
            className="rounded-full border border-jh-line px-5 py-2 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:border-jh-ink"
          >
            Login
          </a>
          <a
            href="#"
            className="rounded-full bg-jh-yellow px-5 py-2 text-sm font-semibold text-jh-ink transition-transform duration-200 hover:scale-[1.03] hover:shadow-sm"
          >
            Post a Job
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-jh-ink hover:bg-jh-teal/60 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-jh-line bg-white lg:hidden">
          <nav className="mx-auto flex max-w-[1160px] flex-col gap-1 px-4 py-4" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium text-jh-ink hover:bg-jh-teal/50"
              >
                {link.label}
                {link.hasDropdown && <ChevronDownIcon className="h-4 w-4" />}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-3 border-t border-jh-line pt-4">
              <a href="#" onClick={() => setOpen(false)} className="rounded-full border border-jh-line px-4 py-2.5 text-center text-sm font-semibold text-jh-ink">
                Login
              </a>
              <a href="#" onClick={() => setOpen(false)} className="rounded-full bg-jh-yellow px-4 py-2.5 text-center text-sm font-semibold text-jh-ink">
                Post a Job
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}