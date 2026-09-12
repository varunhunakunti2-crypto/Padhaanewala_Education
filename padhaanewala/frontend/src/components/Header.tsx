"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { Bell, ChevronDown, Menu, Sun, X } from "lucide-react";

const navLinks = [
  { label: "Courses", href: "/courses", chevron: true },
  { label: "Explore", href: "/colleges", chevron: true },
  { label: "Practice", href: "/mock-tests", chevron: true },
  { label: "Pricing", href: "/pricing", chevron: false },
];

const smoothSpring = {
  type: "spring" as const,
  stiffness: 240,
  damping: 26,
  mass: 0.8,
};

const easeOutSpec = [0.22, 1, 0.36, 1] as [number, number, number, number];
const navbarTransition = { duration: 0.35, ease: easeOutSpec };

export default function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 30);
  });

  useEffect(() => {
    // Immediately sync scroll position on reload/mount
    setScrolled(window.scrollY > 30);

    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDevice("mobile");
      } else if (width < 1024) {
        setDevice("tablet");
      } else {
        setDevice("desktop");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDesktop = device === "desktop";
  const isTablet = device === "tablet";

  const topHeight = isDesktop ? 62 : isTablet ? 58 : 54;
  const scrolledHeight = isDesktop ? 54 : isTablet ? 50 : 48;

  const getMaxWidth = () => {
    if (scrolled) {
      if (isDesktop) return 920;
      if (isTablet) return "90%";
      return "94%";
    } else {
      if (isDesktop) return 1280;
      if (isTablet) return "95%";
      return "96%";
    }
  };

  return (
    <header className="relative z-[1000]">
      {/* Reserved space to prevent layout jump */}
      <div aria-hidden className="h-[64px] md:h-[70px] lg:h-[76px]" />

      <motion.nav
        initial={false}
        aria-label="Main"
        className="fixed inset-x-0 top-0 flex justify-center z-[1000]"
        animate={{
          paddingInline: isDesktop ? 16 : 8,
          paddingTop: scrolled ? (isDesktop ? 14 : 10) : (isDesktop ? 12 : 8),
        }}
        transition={navbarTransition}
        style={{ pointerEvents: "none" }}
      >
        <motion.div
          initial={false}
          className="pointer-events-auto flex w-full items-center justify-between overflow-hidden text-white will-change-[max-width,height,border-radius,background-color,box-shadow,backdrop-filter]"
          animate={{
            maxWidth: getMaxWidth(),
            height: scrolled ? scrolledHeight : topHeight,
            paddingLeft: isDesktop ? 24 : 16,
            paddingRight: isDesktop ? 24 : 16,
            borderRadius: 9999,
            backgroundColor: scrolled
              ? "rgba(12, 12, 12, 0.88)"
              : "rgba(15, 15, 15, 0.75)",
            borderWidth: 1,
            borderColor: scrolled
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(255, 255, 255, 0.08)",
            backdropFilter: scrolled
              ? "blur(20px) saturate(160%)"
              : "blur(12px)",
            boxShadow: scrolled
              ? "0 14px 40px -5px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 0, 0, 0.2)"
              : "0 8px 30px -5px rgba(0, 0, 0, 0.4)",
          }}
          transition={navbarTransition}
        >
          <div className="mx-auto flex w-full max-w-[1536px] items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5"
              onClick={() => setOpen(false)}
            >
              <motion.span
                className="flex items-center justify-center bg-white font-black text-black shadow-sm transition-transform duration-200 group-hover:scale-105"
                animate={{
                  width: scrolled ? 26 : 28,
                  height: scrolled ? 26 : 28,
                  fontSize: scrolled ? 12 : 13,
                  borderRadius: 7,
                }}
                transition={navbarTransition}
              >
                P
              </motion.span>
              <motion.span
                className="whitespace-nowrap font-bold tracking-tight text-white transition-colors duration-200 group-hover:text-neutral-200"
                animate={{ fontSize: scrolled ? (isDesktop ? 16 : 15) : 17.5 }}
                transition={navbarTransition}
              >
                Padhaanewala
              </motion.span>
            </Link>

            {/* Desktop Navigation Links — Centered */}
            <nav
              aria-label="Primary"
              className="hidden items-center gap-1.5 lg:flex"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[14px] font-medium text-white/80 transition-colors duration-200 hover:text-white"
                >
                  <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100" />
                  <span className="relative z-10">{link.label}</span>
                  {link.chevron && (
                    <ChevronDown className="relative z-10 h-3.5 w-3.5 text-white/60 transition-transform duration-200 group-hover:rotate-180 group-hover:text-white" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Right-Side Controls (Tablet & Desktop) */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                aria-label="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff5500] px-1 text-[9.5px] font-bold leading-none text-white shadow-sm">
                  1
                </span>
              </button>
              <button
                type="button"
                aria-label="Your profile"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff5500] text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-orange-500/30 active:scale-95"
              >
                P
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/10 lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.div>
      </motion.nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={smoothSpring}
            className="fixed inset-x-3 top-[64px] z-[999] rounded-3xl border border-white/12 bg-[#0a0a0a]/95 p-4 shadow-2xl backdrop-blur-2xl lg:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-neutral-200 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                  {link.chevron && (
                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                  )}
                </Link>
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 px-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Toggle theme"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff5500] px-1 text-[9.5px] font-bold leading-none text-white">
                      1
                    </span>
                  </button>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff5500] text-sm font-bold text-white shadow-sm">
                  P
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}