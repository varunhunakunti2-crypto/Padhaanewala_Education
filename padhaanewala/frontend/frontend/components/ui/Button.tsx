import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "accent" | "warm-gradient" | "outline" | "ghost" | "danger" | "warm";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-white hover:brightness-110 active:brightness-95 shadow-md shadow-purple-600/25",
  secondary:
    "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700 ring-1 ring-inset ring-blue-200 dark:ring-slate-700 hover:ring-blue-300",
  accent:
    "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm shadow-orange-500/30",
  "warm-gradient":
    "bg-warm-gradient text-white hover:brightness-110 active:brightness-95 shadow-md shadow-orange-500/30",
  outline:
    "bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-200 dark:ring-slate-700 hover:ring-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700",
  ghost: "bg-transparent text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800",
  danger: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 ring-1 ring-inset ring-red-200 dark:ring-red-900/50",
  warm: "bg-amber-400 text-black hover:bg-amber-300 shadow-sm shadow-amber-400/30",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-8.5 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

const base =
  "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  href: string;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}