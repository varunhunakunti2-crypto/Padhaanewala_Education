import type { InputHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-gray-700", className)} {...props}>
      {children}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-gray-900 placeholder:text-gray-400",
        "border-gray-200 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none",
        error && "border-red-400 focus:border-red-400 focus:ring-red-200",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  error,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-sm",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
        "bg-[position:right_0.75rem_center] bg-no-repeat pr-9",
        "focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none",
        error && "border-red-400 focus:border-red-400 focus:ring-red-200",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}