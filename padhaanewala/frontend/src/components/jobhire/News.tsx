import { articles } from "./data";
import { CalendarIcon, NewsImage } from "./icons";

export function NewsCard({ title, date, image }: (typeof articles)[number]) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-jh-line bg-white transition-shadow duration-200 hover:shadow-[0_24px_45px_-28px_rgba(7,19,40,0.35)]">
      <div className="relative overflow-hidden bg-jh-teal/60">
        <NewsImage variant={image} className="h-44 w-full object-cover p-0 transition-transform duration-300 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-jh-green">
          <CalendarIcon className="h-4 w-4" />
          {date}
        </p>
        <h3 className="text-base font-semibold leading-relaxed text-jh-ink group-hover:text-jh-green">
          {title}
        </h3>
      </div>
    </article>
  );
}

export default function NewsSection() {
  return (
    <section id="news" className="bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-jh-ink sm:text-4xl">
          Latest News
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <NewsCard key={article.id} {...article} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-full bg-jh-yellow px-7 py-3.5 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-[#FFD93D]"
          >
            View our Blog
          </a>
        </div>
      </div>
    </section>
  );
}