import Link from "next/link";
import { ClipboardIcon } from "@/components/icons";
import type { MockTest } from "@/data/mockTests";

const difficultyStyles: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

const difficultyLabels: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function MockTestCard({ test }: { test: MockTest }) {
  return (
    <Link
      href={`/mock-tests/${test.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <ClipboardIcon className="h-6 w-6 text-indigo-600" />
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${difficultyStyles[test.difficulty]}`}
          >
            {difficultyLabels[test.difficulty]}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              test.mode === "Proctored"
                ? "bg-rose-50 text-rose-700"
                : "bg-sky-50 text-sky-700"
            }`}
          >
            {test.mode}
          </span>
        </div>
      </div>

      <h3 className="mt-4 text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
        {test.name}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        {test.examName} · {test.subject}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Questions</dt>
          <dd className="mt-0.5 font-semibold text-neutral-900">
            {test.questions}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Duration</dt>
          <dd className="mt-0.5 font-semibold text-neutral-900">
            {test.duration} min
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Max marks</dt>
          <dd className="mt-0.5 font-semibold text-neutral-900">
            {test.totalMarks}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Negative marking</dt>
          <dd className="mt-0.5 font-semibold text-neutral-900">
            {test.negativeMarking ? `−${test.negativePerWrong} per wrong` : "None"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
        <span className="text-xs text-neutral-500">
          {test.attemptsAllowed} attempt{test.attemptsAllowed === 1 ? "" : "s"} allowed
        </span>
        <span className="inline-flex items-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-neutral-800">
          Start test
        </span>
      </div>
    </Link>
  );
}