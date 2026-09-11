import { testimonial } from "./data";
import { QuoteIcon, StarIcon } from "./icons";

function Portrait({ variant, label, className }: { variant: "beard" | "blonde" | "brunette"; label: string; className?: string }) {
  const palettes = {
    beard: { skin: "#C68B59", shirt: "#0EA5E9", hair: "#3A3A3A" },
    blonde: { skin: "#F2C79B", shirt: "#F472B6", hair: "#E8B94A" },
    brunette: { skin: "#F2C79B", shirt: "#55C99A", hair: "#5B3A2A" },
  }[variant];

  const beardShape =
    variant === "beard" ? <path d="M33 52c0-8 3-14 8-18h4c5 4 8 10 8 18v6H33v-6Z" fill="#3A3A3A" /> : null;

  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" role="img" aria-label={label}>
      <rect width="80" height="80" fill="none" />
      <path d="M24 80V58c0-9 7-15 16-15s16 6 16 15v22Z" fill={palettes.shirt} />
      <circle cx="40" cy="34" r="17" fill={palettes.skin} />
      <path d="M23 33c-1-12 7-19 17-19s18 7 17 19c-2.4-5-9-7.5-17-7.5S25.4 28 23 33Z" fill={palettes.hair} />
      {beardShape}
      <circle cx="45" cy="36" r="2.6" fill="#1E293B" />
      <circle cx="34" cy="36" r="2.6" fill="#1E293B" />
      <path d="M33 45c4.5 3.4 9.5 3.4 14 0" stroke="#B8704A" strokeWidth="2" strokeLinecap="round" />
      {variant === "blonde" && (
        <>
          <path d="M24 32c-4 3-5 9-4 14" stroke={palettes.hair} strokeWidth="7" strokeLinecap="round" />
          <path d="M57 32c4 3 5 9 4 14" stroke={palettes.hair} strokeWidth="7" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function Testimonials() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1160px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold tracking-tight text-jh-ink sm:text-4xl">
              {testimonial.heading}
            </h2>
            <QuoteIcon className="mt-6 h-9 w-9 text-jh-yellow" />
            <p className="mt-4 text-[15px] leading-relaxed text-jh-muted">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div className="mt-7 flex items-center gap-4">
              <Portrait variant="brunette" label="Portrait of Daniyel Martin" className="h-14 w-14 rounded-full object-cover ring-2 ring-jh-line" />
              <div>
                <p className="text-base font-semibold text-jh-ink">{testimonial.name}</p>
                <p className="text-sm font-medium text-jh-green">{testimonial.role}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto h-[280px] w-full max-w-[520px]">
          <Portrait variant="beard" label="Older bearded man" className="absolute left-0 top-6 h-52 w-52 rounded-3xl object-cover shadow-[0_24px_45px_-25px_rgba(7,19,40,0.4)]" />
          <Portrait variant="blonde" label="Blonde woman" className="absolute left-32 top-0 h-52 w-52 rounded-3xl object-cover shadow-[0_24px_45px_-25px_rgba(7,19,40,0.4)]" />
          <Portrait variant="brunette" label="Young brunette woman" className="absolute left-64 top-10 h-52 w-52 rounded-3xl object-cover shadow-[0_24px_45px_-25px_rgba(7,19,40,0.4)]" />
          <span className="absolute right-6 bottom-0 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
            <span className="flex items-center gap-0.5">
              <StarIcon className="h-5 w-5 text-jh-yellow" />
              <StarIcon className="h-5 w-5 text-jh-yellow" />
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}