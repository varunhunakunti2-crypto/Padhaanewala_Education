"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  FileQuestion,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MockTest, MockTestQuestion } from "@/lib/types";
import type { Violation } from "@/components/mocktests/types";

export interface ResultSummary {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeTakenSec: number;
  percentile: number;
  topicPerf: Record<string, { correct: number; total: number }>;
}

/** Post-exam screen: score summary, topic breakdown, and optional solutions. */
export function TestResultScreen({
  test,
  result,
  questions,
  answers,
  violations,
  showSolutions,
  onToggleSolutions,
  onRestart,
}: {
  test: MockTest;
  result: ResultSummary;
  questions: MockTestQuestion[];
  answers: Record<string, { selected?: number | null; marked?: boolean }>;
  violations: Violation[];
  showSolutions: boolean;
  onToggleSolutions: () => void;
  onRestart: () => void;
}) {
  const router = useRouter();

  const pct = questions.length ? Math.round((result.correct / questions.length) * 100) : 0;
  const timeStr = `${Math.floor(result.timeTakenSec / 60)}m ${result.timeTakenSec % 60}s`;
  const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Average" : "Needs practice";
  const gradeTone: "green" | "yellow" | "amber" | "red" =
    pct >= 80 ? "green" : pct >= 60 ? "yellow" : pct >= 40 ? "amber" : "red";

  const stats = [
    {
      label: "Score",
      value: `${Math.max(0, result.score)}/${result.maxScore}`,
      tone: "text-purple-700 bg-purple-50 dark:bg-purple-950/70 dark:text-purple-300",
    },
    {
      label: "Percentage",
      value: `${pct}%`,
      tone: "text-blue-700 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300",
    },
    {
      label: "Correct",
      value: String(result.correct),
      tone: "text-green-700 bg-green-50 dark:bg-emerald-950/70 dark:text-emerald-300",
    },
    {
      label: "Incorrect",
      value: String(result.incorrect),
      tone: "text-red-700 bg-red-50 dark:bg-rose-950/70 dark:text-rose-300",
    },
    {
      label: "Unattempted",
      value: String(result.unattempted),
      tone: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
    },
    {
      label: "Time taken",
      value: timeStr,
      tone: "text-orange-700 bg-orange-50 dark:bg-amber-950/70 dark:text-amber-300",
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-100 dark:bg-[#090d16]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 p-8 text-center text-white">
          <Trophy className="mx-auto h-10 w-10 text-amber-300" />
          <h2 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">Test completed!</h2>
          <p className="mt-1 text-sm text-white/75">{test.title}</p>
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Score</p>
              <p className="text-xl font-extrabold">
                {Math.max(0, result.score)}
                <span className="text-sm font-medium text-white/60">/{result.maxScore}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Percentage</p>
              <p className="text-xl font-extrabold">{pct}%</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Percentile</p>
              <p className="text-xl font-extrabold">{result.percentile}</p>
            </div>
          </div>
          <Badge variant={gradeTone} className="mt-4">
            {grade}
          </Badge>
        </div>

        {violations.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4" /> {violations.length} focus violation(s) during
              this test
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {violations.map((v, i) => (
                <li key={i}>• {v.reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-100 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900"
            >
              <span className={cn("mx-auto grid h-9 w-9 place-items-center rounded-xl", s.tone)}>
                <Target className="h-4 w-4" />
              </span>
              <p className="mt-2 text-lg font-extrabold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
              <ListChecks className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Topic-wise
              performance
            </h3>
            <div className="mt-4 space-y-3">
              {Object.entries(result.topicPerf).map(([topic, perf]) => {
                const p = perf.total ? Math.round((perf.correct / perf.total) * 100) : 0;
                return (
                  <div key={topic}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{topic}</span>
                      <span className="text-slate-400">
                        {perf.correct}/{perf.total}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          p >= 70 ? "bg-green-500" : p >= 40 ? "bg-amber-400" : "bg-red-400",
                        )}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(result.topicPerf).length === 0 && (
                <p className="text-sm text-slate-400">No topic data was recorded for this attempt.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                onRestart();
                router.push(`/mock-tests/${test.slug}`);
              }}
            >
              <RefreshCw className="h-4 w-4" /> Practice again
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onToggleSolutions}
            >
              <BookOpen className="h-4 w-4" /> {showSolutions ? "Hide" : "View"} solutions
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => router.push("/mock-tests")}
            >
              <FileQuestion className="h-4 w-4" /> Back to all tests
            </Button>
          </div>
        </div>

        {showSolutions && (
          <div className="mt-6 space-y-4">
            {questions.map((q, i) => {
              const chosen = answers[q.id]?.selected;
              const isCorrect = chosen === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Q{i + 1}. {q.text}
                    </p>
                    {chosen === undefined || chosen === null ? (
                      <Badge variant="amber">Unattempted</Badge>
                    ) : isCorrect ? (
                      <Badge variant="green">Correct</Badge>
                    ) : (
                      <Badge variant="red">Incorrect</Badge>
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <p
                        key={oi}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                          oi === q.correctIndex &&
                            "border-green-200 bg-green-50 font-medium text-green-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
                          oi === chosen &&
                            oi !== q.correctIndex &&
                            "border-red-200 bg-red-50 text-red-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300",
                          oi !== q.correctIndex &&
                            oi !== chosen &&
                            "border-transparent text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                        {oi === q.correctIndex && (
                          <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600 dark:text-emerald-400" />
                        )}
                        {oi === chosen && oi !== q.correctIndex && (
                          <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-500 dark:text-rose-400" />
                        )}
                      </p>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-200">
                      <b className="text-purple-900 dark:text-purple-300">Explanation:</b>{" "}
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
