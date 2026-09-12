"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { Bell, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";

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
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [isDark, setIsDark] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 30);
  });

  useEffect(() => {
    queueMicrotask(() => setIsDark(document.documentElement.classList.contains("dark")));

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

  const toggleTheme = () => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    const apply = () => {
      flushSync(() => {
        const isDarkNow = document.documentElement.classList.toggle("dark");
        localStorage.setItem("padhaanewala-theme", isDarkNow ? "dark" : "light");
      });
    };
    if (doc.startViewTransition) doc.startViewTransition(apply);
    else apply();
    setIsDark(document.documentElement.classList.contains("dark"));
  };

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
      return "100%";
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
                className="foreground-accent flex items-center justify-center bg-white font-black text-black shadow-sm transition-transform duration-200 group-hover:scale-105"
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
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className="group relative flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[14px] font-medium text-white/80 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <span className={`absolute inset-0 rounded-full bg-white/10 transition-all duration-200 ${active ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 group-hover:scale-100"}`} />
                    <span className={`relative z-10 ${active ? "text-white" : ""}`}>{link.label}</span>
                    {link.chevron && (
                      <ChevronDown className="relative z-10 h-3.5 w-3.5 text-white/60 transition-transform duration-200 group-hover:rotate-180 group-hover:text-white" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right-Side Controls (Tablet & Desktop) */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
              >
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-1 text-[9.5px] font-bold leading-none text-white shadow-sm">
                  1
                </span>
              </button>
              <Link
                href="/auth/signup"
                className="group relative ml-1 inline-flex h-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-4 text-[13px] font-bold text-white shadow-md shadow-[#A654F0]/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-[#B04FFF]/50 active:scale-95 whitespace-nowrap"
              >
                <div className="relative h-4.5 overflow-hidden">
                  <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
                    <span className="flex h-4.5 items-center justify-center whitespace-nowrap">Get Started</span>
                    <span className="flex h-4.5 items-center justify-center whitespace-nowrap">Login →</span>
                  </div>
                </div>
              </Link>
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
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors duration-150 hover:bg-white/10 hover:text-white ${
                      active ? "font-semibold text-white" : "font-medium text-neutral-200"
                    }`}
                  >
                    {link.label}
                    {link.chevron && (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    )}
                  </Link>
                );
              })}
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 px-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Toggle theme"
                    onClick={toggleTheme}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                  >
                    {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-1 text-[9.5px] font-bold leading-none text-white">
                      1
                    </span>
                  </button>
                </div>
                <Link
                  href="/auth/signup"
                  onClick={() => setOpen(false)}
                  className="group relative inline-flex h-8.5 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-4 text-xs font-bold text-white shadow-sm transition-all duration-200"
                >
                  <div className="relative h-4 overflow-hidden">
                    <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
                      <span className="flex h-4 items-center justify-center whitespace-nowrap">Get Started</span>
                      <span className="flex h-4 items-center justify-center whitespace-nowrap">Login →</span>
                    </div>
                  </div>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}