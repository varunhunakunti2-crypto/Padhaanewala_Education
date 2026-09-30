import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  eyebrowTone?: "primary" | "warm" | "cool";
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  action?: ReactNode;
}

const eyebrowTones = {
  primary:
    "bg-purple-50 text-purple-700 ring-purple-200",
  warm: "bg-orange-50 text-orange-600 ring-orange-200",
  cool: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function SectionHeading({
  eyebrow,
  eyebrowTone = "primary",
  title,
  description,
  align = "left",
  className,
  action,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-8 md:mb-10",
        align === "center" && "text-center",
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ring-1 ring-inset",
            eyebrowTones[eyebrowTone],
          )}
        >
          {eyebrow}
        </p>
      )}
      <div className={cn("flex flex-wrap items-end justify-between gap-4", align === "center" && "justify-center")}>
        <h2 className="section-title font-display font-extrabold text-purple-950">
          {title}
        </h2>
        {action}
      </div>
      {description && (
        <p
          className={cn(
            "mt-3 max-w-2xl text-base leading-relaxed text-gray-500",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}