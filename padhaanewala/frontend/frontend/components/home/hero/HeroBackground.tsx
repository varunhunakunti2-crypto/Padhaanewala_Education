import Image from "next/image";

interface HeroBackgroundProps {
  imageUrl?: string;
}

/**
 * Full-bleed cinematic background for the hero.
 *
 * By default it renders a premium, offline-safe dusk campus scene (SVG) — no
 * image request at all. Pass `imageUrl` to use a real photograph instead; it is
 * served through next/image so the 1.5 MB source is resized and re-encoded to
 * AVIF/WebP at the right size rather than shipped raw to every visitor.
 */
export function HeroBackground({ imageUrl }: HeroBackgroundProps) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={72}
          className="object-cover object-center"
        />
      ) : (
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="cm-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#081831" />
              <stop offset="0.55" stopColor="#12234d" />
              <stop offset="1" stopColor="#2b1c4e" />
            </linearGradient>
            <linearGradient id="cm-sun" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffcf6e" />
              <stop offset="1" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="cm-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3b4a86" />
              <stop offset="1" stopColor="#1c2a56" />
            </linearGradient>
            <radialGradient id="cm-sunglow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fbbf24" stopOpacity="0.5" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* sky */}
          <rect width="1440" height="900" fill="url(#cm-sky)" />

          {/* stars */}
          <g fill="#ffffff" opacity="0.5">
            <circle cx="180" cy="120" r="1.6" />
            <circle cx="420" cy="70" r="1.3" />
            <circle cx="760" cy="110" r="1.6" />
            <circle cx="980" cy="60" r="1.2" />
            <circle cx="1240" cy="150" r="1.5" />
            <circle cx="1330" cy="70" r="1.3" />
            <circle cx="680" cy="180" r="1.2" />
          </g>

          {/* warm sun + halo */}
          <circle cx="600" cy="440" r="210" fill="url(#cm-sunglow)" />
          <circle cx="600" cy="440" r="64" fill="url(#cm-sun)" opacity="0.9" />

          {/* left campus skyline */}
          <g fill="#101d3d">
            <rect x="0" y="300" width="150" height="360" rx="6" />
            <rect x="140" y="360" width="180" height="300" rx="6" />
            <rect x="300" y="280" width="130" height="380" rx="6" />
            <rect x="416" y="420" width="120" height="240" rx="6" />
          </g>
          <g fill="#fbbf24" opacity="0.22">
            <rect x="20" y="330" width="14" height="18" rx="2" />
            <rect x="56" y="350" width="14" height="18" rx="2" />
            <rect x="20" y="390" width="14" height="18" rx="2" />
            <rect x="92" y="330" width="14" height="18" rx="2" />
            <rect x="172" y="400" width="16" height="20" rx="2" />
            <rect x="220" y="420" width="16" height="20" rx="2" />
            <rect x="172" y="470" width="16" height="20" rx="2" />
            <rect x="268" y="450" width="16" height="20" rx="2" />
            <rect x="332" y="330" width="16" height="20" rx="2" />
            <rect x="380" y="360" width="16" height="20" rx="2" />
            <rect x="332" y="420" width="16" height="20" rx="2" />
            <rect x="440" y="470" width="14" height="18" rx="2" />
          </g>

          {/* right campus skyline (behind subject) */}
          <g fill="#182848">
            <rect x="820" y="330" width="150" height="330" rx="6" />
            <rect x="960" y="250" width="140" height="410" rx="6" />
            <rect x="1090" y="330" width="120" height="330" rx="6" />
            <rect x="1200" y="400" width="240" height="260" rx="6" />
          </g>
          {/* modern glass tower */}
          <g>
            <rect x="960" y="170" width="120" height="490" rx="8" fill="url(#cm-glass)" />
            <rect x="1006" y="186" width="28" height="458" rx="6" fill="#ffffff" opacity="0.06" />
            <g fill="#a5b4fc" opacity="0.4">
              <rect x="980" y="210" width="18" height="22" rx="2" />
              <rect x="1010" y="210" width="18" height="22" rx="2" />
              <rect x="980" y="270" width="18" height="22" rx="2" />
              <rect x="1042" y="300" width="18" height="22" rx="2" />
              <rect x="980" y="340" width="18" height="22" rx="2" />
              <rect x="1010" y="390" width="18" height="22" rx="2" />
              <rect x="1042" y="430" width="18" height="22" rx="2" />
            </g>
          </g>
          <g fill="#fbbf24" opacity="0.2">
            <rect x="844" y="370" width="16" height="20" rx="2" />
            <rect x="900" y="400" width="16" height="20" rx="2" />
            <rect x="844" y="440" width="16" height="20" rx="2" />
            <rect x="1114" y="380" width="16" height="20" rx="2" />
            <rect x="1172" y="420" width="16" height="20" rx="2" />
            <rect x="1240" y="450" width="16" height="20" rx="2" />
            <rect x="1320" y="480" width="16" height="20" rx="2" />
            <rect x="1400" y="500" width="16" height="20" rx="2" />
          </g>

          {/* trees */}
          <g fill="#0a1430">
            <ellipse cx="760" cy="660" rx="34" ry="46" />
            <ellipse cx="790" cy="680" rx="26" ry="36" />
            <ellipse cx="730" cy="690" rx="24" ry="32" />
            <circle cx="1500" cy="680" r="52" />
          </g>

          {/* ground */}
          <path d="M0 780 Q360 730 760 760 Q1120 790 1440 750 L1440 900 L0 900 Z" fill="#0a1430" />
          <path d="M0 830 Q480 780 1000 800 Q1240 810 1440 780 L1440 900 L0 900 Z" fill="#050d20" />

          {/* student subject (walking, back view, warm rim light) */}
          <g>
            <ellipse cx="1065" cy="655" rx="105" ry="150" fill="#fb923c" opacity="0.12" />
            <ellipse cx="1065" cy="655" rx="150" ry="200" fill="#8b5cf6" opacity="0.08" />
            {/* backpack */}
            <rect x="1032" y="570" width="34" height="104" rx="14" fill="#0b142e" />
            <rect x="1040" y="584" width="18" height="30" rx="6" fill="#1c2a56" />
            <rect x="1040" y="626" width="18" height="26" rx="6" fill="#1c2a56" />
            {/* legs */}
            <path d="M1038 660 L1022 782 L1008 782 L1030 660 Z" fill="#0b142e" />
            <path d="M1088 660 L1104 782 L1118 782 L1096 660 Z" fill="#0b142e" />
            {/* torso (light jacket) */}
            <path d="M1020 568 Q1060 528 1106 566 L1116 640 Q1062 668 1008 640 Z" fill="#14264f" />
            {/* arms */}
            <path d="M1020 588 L992 656 L1004 666 L1036 604 Z" fill="#14264f" />
            <path d="M1102 588 L1134 654 L1122 666 L1090 606 Z" fill="#14264f" />
            {/* hand holding phone */}
            <rect x="1128" y="652" width="16" height="24" rx="4" fill="#12203f" transform="rotate(-8 1136 664)" />
            <rect x="1130" y="654" width="12" height="20" rx="3" fill="#a5b4fc" opacity="0.55" transform="rotate(-8 1136 664)" />
            {/* head */}
            <circle cx="1065" cy="532" r="31" fill="#0b142e" />
            {/* hair */}
            <circle cx="1044" cy="520" r="22" fill="#0b142e" />
            <circle cx="1086" cy="520" r="22" fill="#0b142e" />
            {/* warm rim edge */}
            <path
              d="M1020 568 Q1060 528 1106 566 L1116 640 Q1062 668 1008 640 Z"
              fill="none"
              stroke="#fb923c"
              strokeOpacity="0.35"
              strokeWidth="2.5"
            />
            <circle cx="1065" cy="532" r="31" fill="none" stroke="#fb923c" strokeOpacity="0.35" strokeWidth="2.5" />
          </g>

          {/* light streaks */}
          <g fill="#ffffff" opacity="0.05">
            <rect x="820" y="700" width="260" height="3" rx="1.5" />
            <rect x="940" y="715" width="140" height="2.5" rx="1.25" />
          </g>
        </svg>
      )}

      {/* readability overlays: left navy → transparent, bottom navy */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/60 to-navy/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/10 to-transparent" />
      <div className="absolute inset-0 bg-navy/25" />

      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-24 top-16 h-96 w-96 rounded-full bg-brand/25 blur-3xl animate-glow" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[30rem] w-[30rem] rounded-full bg-electric/20 blur-3xl animate-glow" style={{ animationDelay: "1.4s" }} />
      <div className="pointer-events-none absolute bottom-8 right-1/4 h-80 w-80 rounded-full bg-cta/20 blur-3xl animate-glow" style={{ animationDelay: "2.6s" }} />

      {/* subtle grain */}
      <div className="absolute inset-0 bg-noise opacity-[0.06]" />
    </div>
  );
}