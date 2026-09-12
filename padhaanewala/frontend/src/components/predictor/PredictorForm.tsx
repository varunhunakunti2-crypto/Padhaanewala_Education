"use client";

import { useState } from "react";
import { SparklesIcon } from "@/components/icons";
import { courseOptions, states } from "@/data/colleges";
import {
  categories,
  estimateRank,
  examsForCourse,
  ownershipOptions,
  type Category,
  type OwnershipPref,
  type PredictionInput,
} from "@/data/predictor";

type EntryMode = "rank" | "score";

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export default function PredictorForm({
  onSubmit,
}: {
  onSubmit: (input: PredictionInput) => void;
}) {
  const [course, setCourse] = useState("mbbs");
  const [exam, setExam] = useState(examsForCourse("mbbs")[0].slug);
  const [mode, setMode] = useState<EntryMode>("rank");
  const [rankValue, setRankValue] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [category, setCategory] = useState<Category>("General");
  const [stateCode, setStateCode] = useState("");
  const [budget, setBudget] = useState("");
  const [ownership, setOwnership] = useState<OwnershipPref>("any");
  const [hostelRequired, setHostelRequired] = useState(false);
  const [error, setError] = useState("");

  const allowed = examsForCourse(course);
  const activeExam = allowed.find((e) => e.slug === exam) ?? allowed[0];

  function handleCourseChange(value: string) {
    setCourse(value);
    const nextExams = examsForCourse(value);
    if (nextExams.length > 0) {
      const current = nextExams.find((e) => e.slug === exam);
      setExam((current ?? nextExams[0]).slug);
    } else {
      setExam("");
    }
    setError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeExam) {
      setError("No entrance exam is mapped for this course yet.");
      return;
    }

    let rank: number | null = null;
    if (mode === "rank") {
      const value = parseInt(rankValue, 10);
      rank = Number.isFinite(value) && value > 0 ? value : null;
    } else {
      const value = parseFloat(scoreValue);
      if (!Number.isFinite(value) || value <= 0) {
        rank = null;
      } else {
        rank = estimateRank(activeExam.scoreAnchors, value);
        if (rank === null) rank = null;
      }
    }

    if (rank === null) {
      setError(mode === "rank" ? "Enter a valid rank (whole number, 1 or above)." : `Enter a valid score (max ${activeExam.maxScore}).`);
      return;
    }
    setError("");

    const budgetValue = budget.trim() === "" ? null : parseFloat(budget);
    onSubmit({
      course,
      exam: activeExam.slug,
      category,
      rank,
      stateCode,
      budget: budgetValue !== null && Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null,
      ownership,
      hostelRequired,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-neutral-50 p-5 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Course
          </span>
          <select
            value={course}
            onChange={(e) => handleCourseChange(e.target.value)}
            className={fieldClass}
          >
            {courseOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Entrance exam
          </span>
          <select
            value={activeExam?.slug ?? ""}
            onChange={(e) => setExam(e.target.value)}
            className={fieldClass}
            disabled={allowed.length === 0}
          >
            {allowed.length === 0 ? (
              <option value="">Not available</option>
            ) : (
              allowed.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
          Your result
        </span>
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 rounded-xl border border-black/10 bg-white p-1">
            {(["rank", "score"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === m
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {m === "rank" ? "Rank" : "Score"}
              </button>
            ))}
          </div>
          {mode === "rank" ? (
            <input
              type="number"
              min={1}
              value={rankValue}
              onChange={(e) => setRankValue(e.target.value)}
              placeholder="e.g. 42000"
              className={fieldClass}
            />
          ) : (
            <input
              type="number"
              min={0}
              max={activeExam?.maxScore ?? 999}
              value={scoreValue}
              onChange={(e) => setScoreValue(e.target.value)}
              placeholder={`Score out of ${activeExam?.maxScore ?? "—"}`}
              className={fieldClass}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={fieldClass}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Preferred state <span className="font-normal text-neutral-400">(optional)</span>
          </span>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className={fieldClass}
          >
            <option value="">Anywhere in India</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Annual budget <span className="font-normal text-neutral-400">(in ₹ L)</span>
          </span>
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 5"
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            College type
          </span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as OwnershipPref)}
            className={fieldClass}
          >
            {ownershipOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700 select-none">
        <input
          type="checkbox"
          checked={hostelRequired}
          onChange={(e) => setHostelRequired(e.target.checked)}
          className="h-4 w-4 accent-neutral-950"
        />
        I need hostel accommodation
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
      >
        <SparklesIcon className="h-4 w-4" />
        Predict my colleges
      </button>
    </form>
  );
}