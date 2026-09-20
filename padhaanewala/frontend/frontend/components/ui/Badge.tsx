import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "purple" | "blue" | "yellow" | "orange" | "amber" | "green" | "gray" | "red";

const variants: Record<Variant, string> = {
  purple: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 ring-purple-200 dark:ring-purple-800",
  blue: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-800",
  yellow: "bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 ring-yellow-300 dark:ring-yellow-800",
  orange: "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800",
  amber: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 ring-amber-300 dark:ring-amber-800",
  green: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
  gray: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-gray-200 dark:ring-slate-700",
  red: "bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 ring-red-200 dark:ring-red-800",
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = "purple", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}