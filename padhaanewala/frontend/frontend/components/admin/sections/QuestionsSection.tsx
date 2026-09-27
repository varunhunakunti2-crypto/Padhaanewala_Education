"use client";

/**
 * No question bank exists.
 *
 * This panel used to list four textbook questions from `admin/fixtures.ts` —
 * "The SI unit of force is:", "DNA replication occurs in which phase?" — as if
 * they were rows in the platform's question bank. They were not; the database
 * has no question tables, and nothing in the repo imports real question content
 * (the mock PDFs were explicitly out of scope). Rather than keep a CRUD screen
 * over data that does not exist, the panel states that plainly and explains what
 * has to exist first.
 */
export function QuestionsSection() {
  return (
    <div>
      <p className="font-display text-lg font-extrabold tracking-tight text-gray-900">Question bank</p>
      <p className="mt-1 text-sm text-slate-500">Curate questions across mock tests</p>
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">No question bank is connected.</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          There are no question tables in the database and no importer wired up, so there is
          nothing to list or edit here yet. This screen becomes usable once questions are stored
          server-side — a question needs a stem, options, the correct option, a topic and a
          difficulty, and every one of those has to come from a source rather than being typed
          in by hand.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- People sections ---------------------------------- */
