type IconProps = {
  className?: string;
};

function Base({ className, children, fill = "none", strokeWidth = 2 }: IconProps & { children: React.ReactNode; fill?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Base>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Base>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Base>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </Base>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14a6.5 6.5 0 0 1 4 6" />
    </Base>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5" />
    </Base>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Base>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 17.3 6.2 20.6l1.1-6.4L2.5 9.8l6.4-.9L12 3l3.1 5.9 6.4.9-4.8 4.4 1.1 6.4Z" />
    </svg>
  );
}

export function QuoteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10.5 5C6.9 6.4 4.5 9.4 4.5 13.4c0 2.9 1.7 5 4.2 5 2.2 0 3.9-1.7 3.9-3.9 0-2.1-1.5-3.7-3.5-3.8.2-2 1.9-3.8 3.9-4.4L10.5 5Zm9 0c-3.6 1.4-6 4.4-6 8.4 0 2.9 1.7 5 4.2 5 2.2 0 3.9-1.7 3.9-3.9 0-2.1-1.5-3.7-3.5-3.8.2-2 1.9-3.8 3.9-4.4L19.5 5Z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Base>
  );
}

/* ------------------------------ Illustrations ------------------------------ */

export function HeroIllustration({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 360 360" fill="none" aria-hidden="true">
      <circle cx="180" cy="180" r="150" fill="#FFF3C4" />
      <circle cx="180" cy="180" r="150" stroke="#FFE65C" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="2 8" />
      <circle cx="86" cy="96" r="6" fill="#FFE65C" />
      <circle cx="288" cy="240" r="10" fill="#FFE65C" />
      <circle cx="120" cy="262" r="5" fill="#55C99A" opacity="0.5" />
      <circle cx="272" cy="104" r="5" fill="#55C99A" opacity="0.6" />

      {/* Male job seeker with glasses holding a laptop */}
      <g>
        {/* laptop */}
        <rect x="196" y="236" width="108" height="8" rx="4" fill="#1E293B" />
        <rect x="210" y="204" width="92" height="6" rx="3" fill="#0F172A" />
        <rect x="210" y="196" width="92" height="10" rx="2" fill="#334155" />
        <rect x="214" y="209" width="84" height="34" rx="3" fill="#E2E8F0" />
        <rect x="220" y="215" width="40" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="220" y="224" width="56" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="220" y="233" width="30" height="5" rx="2.5" fill="#CBD5E1" />
      </g>

      <g>
        {/* body */}
        <path d="M150 244c0-34 14-64 42-68 28 4 42 34 42 68v26c0 4-3 4-6 3l-72-2c-4 1-6-1-6-3v-24Z" fill="#0EA5E9" />
        <path d="M150 252c14 12 40 12 54 0" stroke="#F1F5F9" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        {/* collar */}
        <path d="M192 184l-12 16-12-16" fill="#F8FAFC" />
      </g>

      {/* head */}
      <circle cx="192" cy="150" r="32" fill="#F1C6A0" />
      {/* hair */}
      <path d="M160 148c-1-22 12-34 32-34s33 12 32 34c-3-8-12-12-32-12s-29 4-32 12Z" fill="#27272A" />
      <path d="M160 152c-3 8-2 20 4 28" stroke="#27272A" strokeWidth="10" strokeLinecap="round" />
      {/* ear */}
      <circle cx="160" cy="152" r="5" fill="#E8B188" />
      {/* glasses */}
      <rect x="163" y="146" width="20" height="14" rx="6" stroke="#0F172A" strokeWidth="3" />
      <rect x="191" y="146" width="20" height="14" rx="6" stroke="#0F172A" strokeWidth="3" />
      <path d="M183 153h8" stroke="#0F172A" strokeWidth="3" />
      <path d="M163 150h-6M211 150h6" stroke="#0F172A" strokeWidth="3" />
      {/* eyes */}
      <circle cx="173" cy="153" r="1.8" fill="#0F172A" />
      <circle cx="201" cy="153" r="1.8" fill="#0F172A" />
      {/* nose + mouth */}
      <path d="M192 158v5" stroke="#D99B72" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M184 169c3 2 5 2 8 0" stroke="#D99B72" strokeWidth="2.5" strokeLinecap="round" />
      {/* smile cheek */}
      <circle cx="164" cy="162" r="2.5" fill="#F4B08E" opacity="0.7" />
    </svg>
  );
}

export function ResumeIllustration({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 420 360" fill="none" aria-hidden="true">
      <circle cx="330" cy="70" r="12" fill="#FFE65C" />
      <circle cx="70" cy="290" r="16" fill="#DDEFEF" />
      <circle cx="368" cy="268" r="8" fill="#55C99A" opacity="0.5" />

      {/* resume document */}
      <g>
        <rect x="210" y="40" width="170" height="250" rx="10" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="2" />
        <rect x="232" y="66" width="126" height="10" rx="5" fill="#111111" />
        <rect x="232" y="88" width="90" height="7" rx="3.5" fill="#55C99A" />
        <g>
          <rect x="232" y="116" width="126" height="8" rx="4" fill="#E9EDF2" />
          <rect x="232" y="132" width="110" height="8" rx="4" fill="#F1F3F6" />
          <rect x="232" y="148" width="126" height="8" rx="4" fill="#E9EDF2" />
        </g>
        <g>
          <rect x="232" y="176" width="126" height="8" rx="4" fill="#E9EDF2" />
          <rect x="232" y="192" width="96" height="8" rx="4" fill="#F1F3F6" />
          <rect x="232" y="208" width="120" height="8" rx="4" fill="#E9EDF2" />
        </g>
        <rect x="232" y="246" width="60" height="24" rx="12" fill="#FFE65C" />
        <rect x="232" y="272" width="126" height="6" rx="3" fill="#F1F3F6" />
        <rect x="232" y="282" width="104" height="6" rx="3" fill="#F1F3F6" />
      </g>

      {/* person standing beside the resume */}
      <g>
        {/* body */}
        <path d="M96 236c0-30 12-56 36-60 24 4 36 30 36 60v20c0 5-4 6-8 5l-56-2c-5 1-8-1-8-5v-18Z" fill="#0EA5E9" />
        <path d="M96 244c12 10 36 10 48 0" stroke="#F1F5F9" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
        {/* arm resting */}
        <path d="M132 196c18 10 30 20 34 34" stroke="#0B84C2" strokeWidth="12" strokeLinecap="round" />
        <circle cx="168" cy="234" r="7" fill="#F1C6A0" />
      </g>
      {/* head */}
      <circle cx="132" cy="118" r="28" fill="#F1C6A0" />
      <path d="M104 116c-1-19 11-30 28-30s29 11 28 30c-2-7-10-11-28-11s-26 4-28 11Z" fill="#27272A" />
      <path d="M106 122c-2 8-1 18 4 26" stroke="#27272A" strokeWidth="8" strokeLinecap="round" />
      {/* glasses */}
      <rect x="110" y="116" width="17" height="12" rx="5" stroke="#0F172A" strokeWidth="2.5" />
      <rect x="133" y="116" width="17" height="12" rx="5" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M127 122h6" stroke="#0F172A" strokeWidth="2.5" />
      <circle cx="118" cy="121" r="1.5" fill="#0F172A" />
      <circle cx="141" cy="121" r="1.5" fill="#0F172A" />
      <path d="M133 132c2 1.6 4 1.6 6 0" stroke="#D99B72" strokeWidth="2" strokeLinecap="round" />

      {/* sparkles near resume */}
      <path d="M352 146l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5 2.5-5Z" fill="#55C99A" />
    </svg>
  );
}

export function PhoneIllustration({ className }: IconProps) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative mx-auto h-[340px] w-[190px] rounded-[30px] border-[8px] border-[#0B1626] bg-white shadow-[0_30px_60px_-20px_rgba(7,19,40,0.45)]">
        <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-[#0B1626]" />
        <div className="mt-5 flex h-full w-full flex-col overflow-hidden rounded-[14px]">
          <div className="flex items-center justify-between bg-white px-3 py-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#55C99A] to-[#FFE65C] text-[8px] font-bold text-white">J</span>
            <span className="text-[8px] font-semibold text-[#111111]">Jobhire</span>
            <span className="h-2 w-2 rounded-full bg-[#FFE65C]" />
          </div>
          <div className="bg-[#DDEFEF] px-3 pb-4 pt-3">
            <p className="text-[10px] font-bold leading-tight text-[#111111]">
              Find your dream job
            </p>
            <p className="mt-0.5 text-[7px] text-[#777777]">35,000+ live openings</p>
            <div className="mt-2 flex items-center gap-1 rounded-[10px] bg-white px-2 py-1.5">
              <span className="text-[8px] text-[#777777]">Designer, Developer…</span>
              <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-[6px] bg-[#FFE65C] text-[7px] font-bold text-[#111111]">Go</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 bg-[#F7F9FB] px-3 py-3">
            {[
              { t: "Web Developer", c: "The Simpsons", s: "$1500-$3600", b: "#DDEFEF" },
              { t: "UI/UX Designer", c: "Sylent Corp", s: "$1250-$3000", b: "#FFF3C4" },
              { t: "Graphic Designer", c: "Acme Corp", s: "$800-$2000", b: "#DDEFEF" },
            ].map((job) => (
              <div key={job.t} className="flex items-center gap-2 rounded-[10px] border border-[#E8E8E8] bg-white px-2 py-2">
                <span className="h-7 w-7 shrink-0 rounded-[8px]" style={{ background: job.b }} />
                <div className="min-w-0">
                  <p className="truncate text-[8px] font-semibold text-[#111111]">{job.t}</p>
                  <p className="truncate text-[6.5px] text-[#55C99A]">{job.c}</p>
                </div>
                <p className="ml-auto shrink-0 text-[6.5px] font-medium text-[#777777]">{job.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const avatarColors = [
  ["#F1C6A0", "#27272A", "#0EA5E9"],
  ["#F4D0A8", "#E8B94A", "#F472B6"],
  ["#E3A98B", "#6B4226", "#55C99A"],
];

export function AvatarIllustration({ className, variant = 0, label }: IconProps & { variant?: number; label?: string }) {
  const [skin, hair, shirt] = avatarColors[variant % avatarColors.length];
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={label ?? "User avatar"}
    >
      <rect width="64" height="64" fill="#DDEFEF" />
      <rect width="64" height="26" fill="#FFE65C" opacity="0.45" />
      <path d="M16 64V50c0-9 7-15 16-15s16 6 16 15v14Z" fill={shirt} />
      <circle cx="32" cy="28" r="14" fill={skin} />
      <path d="M18 27c-1-10 6-15 14-15s15 5 14 15c-2-4-7-6-14-6s-12 2-14 6Z" fill={hair} />
      <circle cx="36" cy="34" r="2.2" fill="#1E293B" />
      <circle cx="28" cy="34" r="2.2" fill="#1E293B" />
      <path d="M27 41c4 3 6 3 10 0" stroke="#C98A5E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function NewsImage({ className, variant = "team-work" }: IconProps & { variant?: string }) {
  const artMap: Record<string, React.ReactNode> = {
    "team-work": (
      <g>
        <rect x="16" y="18" width="120" height="96" rx="10" fill="#FFFFFF" />
        <rect x="30" y="30" width="44" height="34" rx="6" fill="#DDEFEF" />
        <rect x="82" y="30" width="40" height="18" rx="6" fill="#FFF3C4" />
        <rect x="82" y="54" width="46" height="14" rx="4" fill="#E9EDF2" />
        <circle cx="42" cy="78" r="10" fill="#FFE65C" />
        <circle cx="66" cy="80" r="8" fill="#55C99A" opacity="0.6" />
        <circle cx="92" cy="78" r="9" fill="#0EA5E9" />
        <circle cx="116" cy="80" r="7" fill="#DDEFEF" stroke="#55C99A" strokeWidth="2" />
      </g>
    ),
    meeting: (
      <g>
        <rect x="18" y="30" width="116" height="76" rx="14" fill="#FFFFFF" />
        <rect x="18" y="30" width="116" height="18" rx="14" fill="#DDEFEF" />
        <rect x="30" y="56" width="92" height="8" rx="4" fill="#E9EDF2" />
        <rect x="30" y="70" width="70" height="8" rx="4" fill="#F1F3F6" />
        <circle cx="40" cy="94" r="8" fill="#FFE65C" />
        <circle cx="60" cy="96" r="7" fill="#0EA5E9" />
        <circle cx="78" cy="94" r="6" fill="#55C99A" />
      </g>
    ),
    remote: (
      <g>
        <rect x="20" y="36" width="112" height="72" rx="12" fill="#FFFFFF" />
        <path d="M20 54h112" stroke="#DDEFEF" strokeWidth="2" />
        <rect x="34" y="64" width="84" height="26" rx="6" fill="#DDEFEF" />
        <rect x="42" y="72" width="40" height="5" rx="2.5" fill="#0EA5E9" />
        <rect x="42" y="82" width="68" height="4" rx="2" fill="#E9EDF2" />
        <circle cx="150" cy="58" r="8" fill="#FFE65C" />
      </g>
    ),
  };

  const art = artMap[variant] ?? artMap["team-work"];

  return (
    <svg className={className} viewBox="0 0 152 116" fill="none" role="img" aria-label="Article illustration">
      {art}
    </svg>
  );
}

export function AppStoreBadge({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 150 46" fill="none" aria-label="Download on the App Store">
      <rect width="150" height="46" rx="12" fill="#0B1626" />
      <g>
        <path d="M29 14.5c0-1.2.9-2 2.3-2.1-.1-1.7 1-3.1 2.6-3.9 1.5-.8 3.4-.7 4.9.1-.2.3-.4.7-.5 1-.5-1.1-1.6-1.9-2.8-2 .8-1.4 2.2-2.2 3.8-2.3 1.5-.2 3 .4 4 .6-1-1.3-2.4-2.2-4.2-2.4 2.3-1.6 5.5-1.5 7.8-.3.6-1.1 1.5-2 2.6-2.6-.4 1.9-1.8 3.5-2.6 5.2l-2 2.7c.2 1.6 1 2.6 2.3 3 .8.5 1.5.9 2.3 1.7-.6 1-1.4 1.9-2.4 2.5-2.8-1.8-5.8-2.1-8.8-1.6-1.8-1.6-4.2-2.1-6.4-2.6-2.1-.3-4.3.6-5.8 2.1-4.2 3.9-3.5 10-4 15.5-.3 3.6-1.9 3.8-4.2 4.2-1.2-1.1-2.5-2.2-3.6-3.4" fill="#FFF" transform="rotate(0)" />
        <path d="M27.5 15.6c-.4 2.1-1.4 4.4-3.6 5.2.9 2.2 1.8 4.5 2.9 6.6.8 1.6 2 3.4 3.7 3.5 1.9.1 2.7-1.5 4.1-2.4 1.5-.9 2-1 3.9-.2 1.6.8 2.8.9 4.5.3 2.6-2.9 5-5.9 7.7-8.9-1.9-1.9-4-3.7-4.9-6.3-.7-2.2-.9-4.6-.8-6.9-2 .4-3.8 1.4-4.8 3.1-1 1.9-1.4 4.4-2.7 6-1.2-1.8-2-3.7-2.4-5.7-2.9-1.9-5.6-2.3-7.6-2-.5 1.8-1.7 3.5-2.6 7.2Z" fill="#FFF" />
        <path d="M45 22c0 2.6-1.9 4.7-4.6 4.7-2.6 0-4.7-2.1-4.7-4.6 0-2.6 2.1-4.7 4.8-4.7 2.6 0 4.6 2 4.6 4.6Z" fill="#FFF" />
      </g>
      <text x="44" y="28" fill="#FFFFFF" fontSize="7" fontWeight="600">Download on the</text>
      <text x="44" y="38" fill="#FFFFFF" fontSize="12" fontWeight="700">App Store</text>
    </svg>
  );
}

export function PlayStoreBadge({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 150 46" fill="none" aria-label="Get it on Google Play">
      <rect width="150" height="46" rx="12" fill="#0B1626" />
      <g>
        <path d="M31 12.5v21l8.5-10.5L31 12.5Z" fill="#00D3FF" />
        <path d="M43.6 8.6 34.4 14.4l5.8 6.6 9.6-9.2" fill="#00E06B" />
        <path d="m44.9 23 .9 12.4-4.4 2.3" fill="#FFD700" />
        <path d="M31 33.5v-21l12 12.9" fill="#FF4C4C" transform="translate(0 2)" />
        <path d="M39.8 13.4 43.6 8.6l1.3 12.4-9.4 8.5" fill="#7000F7" opacity="0" />
        <path d="m40.2 14.2-15.9 9.1-1.3-1.4 2.6-2.6 3.2-2 14.2-8.2" fill="#7000F7" />
        <path d="m45.8 20.6-5.6 5.8.9 9.5 4.4-2.5 1 .7" fill="#B9E0FF" />
      </g>
      <text x="44" y="28" fill="#FFFFFF" fontSize="7" fontWeight="600">GET IT ON</text>
      <text x="44" y="38" fill="#FFFFFF" fontSize="12" fontWeight="700">Google Play</text>
    </svg>
  );
}