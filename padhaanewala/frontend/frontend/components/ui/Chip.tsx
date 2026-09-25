import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  href?: string;
  className?: string;
  /** Compact tinted style used for removable active-filter chips. */
  pill?: boolean;
}

export function Chip({ children, active, onClick, onRemove, href, className, pill }: ChipProps) {
  const cls = cn(
    pill
      ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-200"
      : "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-all",
    !pill && (active
      ? "bg-purple-600 text-white ring-purple-600 shadow-sm"
      : "bg-white text-gray-700 ring-gray-200 hover:ring-purple-300 hover:text-purple-700"),
    !pill && (onClick || href ? "cursor-pointer" : "cursor-default"),
    className,
  );

  const inner = (
    <>
      {children}
      {onRemove && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 grid h-4 w-4 place-items-center rounded-full hover:bg-gray-300/40"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </>
  );

  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );

  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}