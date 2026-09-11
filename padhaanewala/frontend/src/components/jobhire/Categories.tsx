import { categories, type Category } from "./data";

function CategoryIcon({ name, className }: { name: Category["icon"]; className?: string }) {
  switch (name) {
    case "design":
      return (
        <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <circle cx="48" cy="48" r="34" fill="#FFF3C4" />
          <path d="M28 52c8-14 8-26-2-34 24 2 40 18 44 44-14-2-26-2-34 8-6-6-8-12-8-18Z" fill="#FFA8D2" />
          <circle cx="62" cy="50" r="6" fill="#FF6B9A" />
          <path d="M62 44c-3-6-8-8-16-6 6 1 10 4 12 10" fill="#FF6B9A" opacity="0.6" />
          <path d="M26 68c4 3 9 5 14 4" stroke="#7C4DFF" strokeWidth="3" strokeLinecap="round" />
          <circle cx="70" cy="66" r="3" fill="#7C4DFF" />
        </svg>
      );
    case "education":
      return (
        <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <circle cx="48" cy="48" r="34" fill="#DDEFEF" />
          <path d="M48 32 70 42 48 52 26 42 48 32Z" fill="#55C99A" />
          <path d="M34 52v12c0 4 6 8 14 8s14-4 14-8V52" stroke="#0B1626" strokeWidth="3" strokeLinecap="round" />
          <path d="M34 52v12c0 4 6 8 14 8s14-4 14-8V52" fill="none" />
          <path d="M34 52v12c0 4 6 8 14 8s14-4 14-8V52" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="70" cy="30" r="7" fill="#FFE65C" />
        </svg>
      );
    case "code":
      return (
        <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <rect x="18" y="30" width="60" height="40" rx="8" fill="#E9EDF2" />
          <rect x="22" y="34" width="52" height="30" rx="4" fill="#FFFFFF" stroke="#C9D2DE" strokeWidth="2" />
          <rect x="22" y="30" width="28" height="5" rx="2.5" fill="#FFE65C" />
          <path d="M34 44l-6 6 6 6M44 44l6 6-6 6" stroke="#FF6B9A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="42" y="70" width="12" height="8" rx="2" fill="#C9D2DE" />
          <circle cx="52" cy="26" r="5" fill="#55C99A" />
        </svg>
      );
    case "marketing":
      return (
        <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <circle cx="48" cy="48" r="34" fill="#FFF3C4" />
          <path d="M32 30h16a16 16 0 0 1 16 16v4a12 12 0 0 0 0 24H32a20 20 0 0 1 0-44Z" fill="#7C4DFF" />
          <circle cx="44" cy="48" r="7" fill="#FFE65C" />
          <path d="M64 74c10-6 10-18 0-24" stroke="#55C99A" strokeWidth="3" strokeLinecap="round" />
          <path d="M64 74c14-9 14-26 0-34" stroke="#55C99A" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        </svg>
      );
  }
}

export function CategoryCard({ name, positions, icon }: Category) {
  return (
    <a
      href="#jobs"
      className="group flex flex-col items-center rounded-2xl bg-white px-6 py-9 text-center shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_45px_-25px_rgba(7,19,40,0.35)]"
    >
      <CategoryIcon
        name={icon}
        className="h-20 w-20 transition-transform duration-200 group-hover:scale-105"
      />
      <h3 className="mt-5 text-lg font-semibold text-jh-ink">{name}</h3>
      <p className="mt-1.5 text-sm text-jh-muted">{positions}</p>
    </a>
  );
}

export function CategoriesSection() {
  return (
    <section className="bg-jh-teal/50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-jh-ink sm:text-4xl">
            Thousands of
            <br />
            dreams jobs available now
          </h2>
          <p className="mt-3 text-base text-jh-muted">Browse some featured jobs</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} {...category} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="#jobs"
            className="inline-flex items-center gap-2 rounded-full bg-jh-yellow px-7 py-3.5 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-[#FFD93D]"
          >
            Browse more Categories
          </a>
        </div>
      </div>
    </section>
  );
}