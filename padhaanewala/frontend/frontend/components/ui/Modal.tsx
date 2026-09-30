"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Dialog"}
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-fade-in"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[88vh] w-full overflow-auto rounded-t-3xl bg-white dark:bg-slate-900 dark:border dark:border-slate-800 shadow-2xl outline-none animate-fade-up",
          "sm:max-w-lg sm:rounded-2xl",
          className,
        )}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-5 py-4 backdrop-blur">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              aria-label="Close"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 dark:text-slate-400 transition hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5 text-gray-900 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
}