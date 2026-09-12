import Link from "next/link";
import { StarIcon } from "@/components/icons";
import {
  bucketMeta,
  courseLabel,
  examRules,
  type Bucket,
  type PredictionInput,
  type PredictionResult,
} from "@/data/predictor";

const bucketOrder: Bucket[] = ["highly-suitable", "possible", "reach", "not-eligible"];

function ResultCard({ result }: { result: PredictionResult }) {
  const meta = bucketMeta[result.bucket];
  return (
    <Link
      href={`/colleges?q=${encodeURIComponent(result.college.name)}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-6 text-neutral-950 group-hover:text-neutral-700">
          {result.college.name}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-neutral-500">
        {result.college.type} · {result.college.location}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-700">
        <span className="flex items-center gap-1">
          <StarIcon className="h-4 w-4 text-amber-400" />
          <span className="font-semibold">{result.college.rating}</span>
        </span>
        <span>{result.college.fees}</span>
        <span>{result.college.hasHostel ? "Hostel available" : "No hostel"}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs font-medium text-neutral-500">
          <span className="font-semibold text-neutral-700">
            {result.confidence}% confidence
          </span>
          <span>
            Closing rank estimate: #{result.closingRank.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${meta.dot}`}
            style={{ width: `${result.confidence}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-black/5 pt-4">
        {result.reasons.map((reason, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-xs leading-relaxed text-neutral-600"
          >
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${meta.dot}`} />
            {reason}
          </li>
        ))}
      </ul>
    </Link>
  );
}

export default function PredictorResults({
  input,
  results,
}: {
  input: PredictionInput;
  results: PredictionResult[];
}) {
  const exam = examRules.find((e) => e.slug === input.exam);
  const summary = `${courseLabel(input.course)} · ${exam?.name ?? input.exam} · ${
    input.category
  } · rank #${input.rank.toLocaleString("en-IN")}`;

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-neutral-50 px-6 py-16 text-center">
        <p className="text-base font-semibold text-neutral-900">
          No matching colleges found
        </p>
        <p className="mt-2 max-w-md text-sm text-neutral-500">
          {input.ownership === "government"
            ? "Our current sample data has no government colleges for this course yet. Try selecting “Any type”."
            : "Try adjusting your choices — pick a different course, college type or clear the preferences."}
        </p>
      </div>
    );
  }

  const counts = bucketOrder.map((bucket) => ({
    bucket,
    count: results.filter((r) => r.bucket === bucket).length,
  }));
  const visibleCounts = counts.filter((c) => c.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-black/5 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-900">
          Predictions for {summary}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {results.length} college{results.length === 1 ? "" : "s"} shortlisted based
          on your inputs.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleCounts.map(({ bucket, count }) => (
            <span
              key={bucket}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${bucketMeta[bucket].badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${bucketMeta[bucket].dot}`} />
              {bucketMeta[bucket].label}: {count}
            </span>
          ))}
        </div>
      </div>

      {bucketOrder.map((bucket) => {
        const group = results.filter((r) => r.bucket === bucket);
        if (group.length === 0) return null;
        return (
          <section key={bucket}>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-bold text-neutral-950">
                {bucketMeta[bucket].label}
              </h2>
              <span className="text-sm text-neutral-400">{group.length}</span>
            </div>
            <p className="mb-4 text-sm text-neutral-500">
              {bucketMeta[bucket].description}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.map((result) => (
                <ResultCard key={result.college.id} result={result} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">How to read these predictions</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <span className="font-semibold">Highly Suitable</span> — strong chance, apply
            without worry.
          </li>
          <li>
            <span className="font-semibold">Possible</span> — keep it as a realistic option;
            it may convert in later rounds.
          </li>
          <li>
            <span className="font-semibold">Reach</span> — worth listing only if you are open
            to cutoffs dipping.
          </li>
          <li>
            <span className="font-semibold">Not eligible</span> — beyond the expected cutoff
            for this college.
          </li>
        </ul>
        <p className="mt-3 font-semibold">Disclaimer</p>
        <p className="mt-1">
          These are estimates based on previous year trends, your rank/score and preferences.
          They do not guarantee admission. Actual cutoffs depend on the number of applicants,
          exam difficulty and available seats. Always verify with official counselling
          announcements and the college.
        </p>
      </div>

      {input.budget && (
        <p className="text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">Note:</span> budget filter applied
          at ₹{input.budget} L/year. Colleges above this budget are shown at a lower
          chance level rather than removed.
        </p>
      )}
    </div>
  );
}