import Link from "next/link";

export default function Pagination({
  page,
  totalPages,
  basePath,
  path = "/colleges",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  path?: string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  function href(p: number) {
    const params = new URLSearchParams(basePath.split("?")[1] ?? "");
    params.set("page", String(p));
    return `${path}?${params.toString()}`;
  }

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900"
        >
          Prev
        </Link>
      ) : (
        <span className="rounded-xl border border-black/5 px-4 py-2 text-sm font-medium text-neutral-300">
          Prev
        </span>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            p === page
              ? "bg-neutral-950 text-white"
              : "border border-black/10 text-neutral-700 hover:border-neutral-900"
          }`}
        >
          {p}
        </Link>
      ))}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-xl border border-black/5 px-4 py-2 text-sm font-medium text-neutral-300">
          Next
        </span>
      )}
    </nav>
  );
}