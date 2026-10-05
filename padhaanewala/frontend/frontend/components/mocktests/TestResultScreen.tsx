"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileQuestion,
  Hourglass,
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
import type { ResultQuestion } from "@/lib/api";
import {
  answerKeyReleased,
  isNumericQuestion,
  type ResultSummary,
} from "@/lib/attempt-session";
import type { MockTest } from "@/lib/types";
import type { Violation } from "@/components/mocktests/types";

/**
 * Post-exam screen: the server's grade, the topic breakdown, and optional
 * solutions.
 *
 * Every verdict here is the server's. The screen used to recompute all of it from
 * the runner's own answer map against `q.correctIndex`, which meant two graders:
 * this one, and `POST /attempts/{id}/submit`. They agreed only until they didn't,
 * and when they didn't the student saw a score that no record anywhere else
 * agreed with. There is no `correctIndex` in a `ResultQuestion` now, so there is
 * nothing left to grade against -- `is_correct` is the verdict, and
 * `selected_answer` is what the student chose.
 */
export function TestResultScreen({
  test,
  result,
  questions,
  violations,
  showSolutions,
  onToggleSolutions,
  onRestart,
}: {
  test: MockTest;
  result: ResultSummary;
  questions: ResultQuestion[];
  violations: Violation[];
  showSolutions: boolean;
  onToggleSolutions: () => void;
  onRestart: () => void;
}) {
  const router = useRouter();

  // The server's share-of-paper percentage, not `correct / questions`: the two
  // disagree as soon as questions are worth different marks.
  const pct = Math.round(result.percentage);
  const timeStr = `${Math.floor(result.timeTakenSec / 60)}m ${result.timeTakenSec % 60}s`;
  const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Average" : "Needs practice";
  const gradeTone: "green" | "yellow" | "amber" | "red" =
    pct >= 80 ? "green" : pct >= 60 ? "yellow" : pct >= 40 ? "amber" : "red";

  // Withheld unless the paper sets `result_visibility: immediate`. Absent that, the
  // solutions panel has nothing truthful to show and says so instead.
  const keyReleased = answerKeyReleased(questions);

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
          {/* The old line read "+4 correct, -1 incorrect" from `resolveMarks`, a
              per-paper rule the backend does not apply. Grading is per question
              and negative marking is a per-paper flag, so the score line is all
              that can be stated as fact here. */}
          <p className="mt-1 text-xs text-white/55">
            Marked out of {result.maxScore} marks
            {result.pendingReview > 0 && (
              <> · {result.pendingReview} answer(s) awaiting manual review</>
            )}
          </p>
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
              <p className="text-[11px] uppercase tracking-wide text-white/60">Correct</p>
              <p className="text-xl font-extrabold">{result.correct}</p>
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

        {/* Only rendered when something is actually awaiting review. An essay
            pending manual marking is neither correct nor incorrect, so leaving it
            out of every tally would make the counts appear not to add up. */}
        {result.pendingReview > 0 && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/60 dark:bg-purple-950/40">
            <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-purple-900 dark:text-purple-200">
              <b>{result.pendingReview}</b> of your answers cannot be marked automatically and
              were not counted towards your score. Your teacher will review them and the score will
              be updated.
            </p>
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
              disabled={!keyReleased}
              title={
                keyReleased
                  ? undefined
                  : "This paper's answers are not published until a later date"
              }
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
              const numeric = isNumericQuestion(q);
              // What the student chose, as stored: option text for an MCQ, typed
              // text for a numerical one. Compared as text rather than by index,
              // because the graded question list is rebuilt in stored order and may
              // not be the order the student saw if the paper shuffles options.
              const chosen = q.selected_answer;
              const attempted = chosen !== null && chosen !== "";
              // Null means nobody has ruled on it yet, which is not the same as
              // wrong. An essay pending review has to read as pending.
              const verdict =
                q.is_correct === null ? "pending" : q.is_correct ? "correct" : "incorrect";
              const marksAwarded = q.marks_awarded === null ? null : Number(q.marks_awarded);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Q{i + 1}. {q.question_text}
                    </p>
                    {verdict === "pending" ? (
                      <Badge variant="purple">Awaiting review</Badge>
                    ) : !attempted ? (
                      <Badge variant="amber">Unattempted</Badge>
                    ) : verdict === "correct" ? (
                      <Badge variant="green">Correct</Badge>
                    ) : (
                      <Badge variant="red">Incorrect</Badge>
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {numeric ? (
                      <>
                        <p
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                            !attempted
                              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300"
                              : verdict === "correct"
                                ? "border-green-200 bg-green-50 font-medium text-green-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "border-red-200 bg-red-50 text-red-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300",
                          )}
                        >
                          Your answer: {chosen ?? "—"}
                          {verdict === "correct" ? (
                            <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600 dark:text-emerald-400" />
                          ) : verdict === "incorrect" ? (
                            <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-500 dark:text-rose-400" />
                          ) : (
                            <Clock className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                          )}
                        </p>
                        {q.numeric_answer !== null && (
                          <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Correct answer: {q.numeric_answer}
                            <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600 dark:text-emerald-400" />
                          </p>
                        )}
                        {/* The tolerance grading actually used. Shown because an
                            accepted range is the difference between "your answer
                            is wrong" and "your answer was close enough". */}
                        {q.tolerance !== null && Number(q.tolerance) !== 0 && (
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Accepted tolerance: ±{q.tolerance}
                          </p>
                        )}
                      </>
                    ) : (
                      (q.options ?? []).map((opt, oi) => {
                        const isKey = q.correct_answer !== null && opt === q.correct_answer;
                        const isChosen = opt === chosen;
                        return (
                          <p
                            key={oi}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                              isKey &&
                                "border-green-200 bg-green-50 font-medium text-green-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
                              isChosen &&
                                !isKey &&
                                "border-red-200 bg-red-50 text-red-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300",
                              !isKey &&
                                !isChosen &&
                                "border-transparent text-slate-700 dark:text-slate-300",
                            )}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                            {isKey && (
                              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-600 dark:text-emerald-400" />
                            )}
                            {isChosen && !isKey && (
                              <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-500 dark:text-rose-400" />
                            )}
                          </p>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {marksAwarded !== null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {marksAwarded} of {q.marks} marks
                      </span>
                    )}
                    {verdict === "incorrect" && Number(q.negative_marks) > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:bg-red-950/60 dark:text-red-300">
                        −{q.negative_marks} applied
                      </span>
                    )}
                  </div>
                  {q.grader_feedback && (
                    <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                      <b>Teacher&apos;s feedback:</b> {q.grader_feedback}
                    </p>
                  )}
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