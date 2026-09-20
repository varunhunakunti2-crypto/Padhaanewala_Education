import { cn, BANNER_GRADIENTS } from "@/lib/utils";

interface CampusArtProps {
  gradientId: string;
  initials: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Deterministic, network-free "campus image" built from brand gradient + subtle art.
 * Used as the college banner image on cards and detail pages.
 */
export function CampusArt({ gradientId, initials, className, ariaLabel }: CampusArtProps) {
  const gradient = BANNER_GRADIENTS[gradientId] ?? BANNER_GRADIENTS.g0;
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `${initials} campus artwork`}
      className={cn(
        "relative isolate overflow-hidden bg-gradient-to-br text-white",
        gradient,
        className,
      )}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.28),transparent_45%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_90%,rgba(255,255,255,0.16),transparent_40%)]" />
      {/* faint building skyline silhouette */}
      <svg
        className="absolute inset-x-0 bottom-0 h-1/2 w-full text-white/[0.16]"
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 80V52h18v-8h14v8h10V38h16v14h10v-18h12v18h8V30h14v26h10v-8h12v8h14V44h10v16h12V36h12v20h8v-6h16v8h8V44h14v22h10v-12h14v10h12v-16h10v18h12V50h16v30H0Z"
          fill="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-5xl font-extrabold tracking-tight drop-shadow-sm opacity-90 sm:text-6xl">
          {initials}
        </span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}

interface CollegeLogoProps {
  initials: string;
  gradientId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-9 w-9 text-xs rounded-lg",
  md: "h-12 w-12 text-sm rounded-xl",
  lg: "h-16 w-16 text-lg rounded-2xl",
};

export function CollegeLogo({ initials, gradientId, size = "md", className }: CollegeLogoProps) {
  const gradient = BANNER_GRADIENTS[gradientId] ?? BANNER_GRADIENTS.g0;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center bg-gradient-to-br font-bold text-white shadow-md ring-2 ring-white",
        gradient,
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}