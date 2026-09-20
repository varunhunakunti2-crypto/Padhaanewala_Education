"use client";

import { CheckCircle2, AlertCircle, Info, TriangleAlert } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

const accent = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6"
    >
      {toasts.map((t) => {
        const Icon = icons[t.variant ?? "info"];
        return (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            aria-label={`Dismiss notification: ${t.title}`}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-left shadow-lg animate-toast-in",
              accent[t.variant ?? "info"],
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t.title}</span>
              {t.description && (
                <span className="block text-sm text-inherit opacity-85">{t.description}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}