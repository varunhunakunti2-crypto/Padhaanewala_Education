import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value: number;
  size?: number;
  className?: string;
  showValue?: boolean;
  count?: number;
}

export function Rating({ value, size = 14, className, showValue = false, count }: RatingProps) {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  const stars = Array.from({ length: 5 }, (_, i) => {
    const pos = i + 1;
    if (pos <= full) return "full";
    if (pos === full + 1 && hasHalf) return "half";
    return "empty";
  });

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span className="inline-flex items-center gap-px" aria-label={`Rated ${value} out of 5 stars`}>
        {stars.map((s, i) =>
          s === "half" ? (
            <span key={i} className="relative inline-flex">
              <Star size={size} className="fill-amber-200 text-amber-300" strokeWidth={1.5} />
              <StarHalf
                size={size}
                style={{ left: 0, top: 0, position: "absolute" }}
                className="fill-amber-500 text-amber-500"
                strokeWidth={1.5}
              />
            </span>
          ) : (
            <Star
              key={i}
              size={size}
              className={s === "full" ? "fill-amber-500 text-amber-500" : "fill-gray-200 text-gray-200"}
              strokeWidth={1.2}
            />
          ),
        )}
      </span>
      {showValue && (
        <span className="ml-1 text-sm font-bold text-amber-600">{value.toFixed(1)}</span>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-gray-500">({count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count})</span>
      )}
    </span>
  );
}