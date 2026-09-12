"use client";

import { useState } from "react";
import PredictorForm from "@/components/predictor/PredictorForm";
import PredictorResults from "@/components/predictor/PredictorResults";
import {
  predictColleges,
  type PredictionInput,
  type PredictionResult,
} from "@/data/predictor";

const steps = [
  {
    step: "1",
    title: "Tell us your profile",
    text: "Course, entrance exam, rank or score, category and where you'd like to study.",
  },
  {
    step: "2",
    title: "Set your preferences",
    text: "Add an annual budget, hostel requirement and government/private preference.",
  },
  {
    step: "3",
    title: "Get a shortlist",
    text: "Colleges are grouped as Highly Suitable, Possible, Reach or Not eligible — each with a reason and confidence level.",
  },
];

export default function CollegePredictor() {
  const [results, setResults] = useState<PredictionResult[] | null>(null);
  const [lastInput, setLastInput] = useState<PredictionInput | null>(null);

  function handleSubmit(input: PredictionInput) {
    setLastInput(input);
    setResults(predictColleges(input));
  }

  function handleReset() {
    setResults(null);
    setLastInput(null);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <PredictorForm onSubmit={handleSubmit} />
      </div>

      <div className="lg:col-span-8">
        {results === null || lastInput === null ? (
          <div className="flex h-full flex-col justify-center rounded-2xl border border-black/5 bg-neutral-50 px-6 py-10">
            <h2 className="text-lg font-bold text-neutral-950">
              How the predictor works
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Enter your details on the left and we will shortlist colleges that
              realistically match your rank. Results are estimates based on last
              year&apos;s cutoff trends — never a guarantee.
            </p>
            <div className="mt-6 space-y-5">
              {steps.map((s) => (
                <div key={s.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                      {s.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 rounded-xl border border-black/5 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-500">
              Currently running on sample college data with search-based ranks.
              It will be powered by real cutoff data (Phases 10 &amp; 40) and a
              formal prediction rules engine when those go live.
            </p>
          </div>
        ) : (
          <>
            <PredictorResults input={lastInput} results={results} />
            <button
              type="button"
              onClick={handleReset}
              className="mt-6 rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              New prediction
            </button>
          </>
        )}
      </div>
    </div>
  );
}