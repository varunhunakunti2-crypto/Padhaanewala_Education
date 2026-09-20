"use client";

import { useApp } from "@/lib/context/AppContext";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { darkMode, toggleDarkMode } = useApp();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "group relative inline-flex h-9 items-center gap-2 rounded-full p-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
        darkMode
          ? "bg-slate-800/90 text-amber-300 border border-slate-700/80 shadow-inner hover:bg-slate-700/90"
          : "bg-purple-100/80 text-purple-900 border border-purple-200/60 shadow-inner hover:bg-purple-200/70",
        showLabel ? "px-3" : "w-16",
        className
      )}
    >
      {/* Sliding Pill Background */}
      <span
        className={cn(
          "absolute top-1 bottom-1 w-7 rounded-full transition-transform duration-300 ease-out shadow-sm",
          darkMode
            ? "translate-x-7 bg-gradient-to-tr from-purple-600 to-indigo-500 text-white"
            : "translate-x-0 bg-white text-amber-500 shadow-purple-900/10"
        )}
      />

      {/* Sun Icon */}
      <span className="relative z-10 grid h-7 w-7 place-items-center transition-colors">
        <Sun
          className={cn(
            "h-4 w-4 transition-all duration-300",
            darkMode ? "text-slate-400 scale-90 opacity-70" : "text-amber-500 scale-100 opacity-100 rotate-0"
          )}
        />
      </span>

      {/* Moon Icon */}
      <span className="relative z-10 grid h-7 w-7 place-items-center transition-colors">
        <Moon
          className={cn(
            "h-4 w-4 transition-all duration-300",
            darkMode ? "text-amber-300 scale-100 opacity-100 rotate-0" : "text-purple-400 scale-90 opacity-70"
          )}
        />
      </span>

      {showLabel && (
        <span className="relative z-10 ml-1 text-xs font-semibold tracking-wide">
          {darkMode ? "Dark Mode" : "Light Mode"}
        </span>
      )}
    </button>
  );
}
