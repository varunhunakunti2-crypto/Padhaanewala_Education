"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock,
  FileQuestion,
  Play,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MOCK_TESTS } from "@/lib/data/mockTests";
import type { MockTest } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";

const DIFFICULTY_TONE: Record<string, "green" | "yellow" | "red"> = {
  Easy: "green",
  Medium: "yellow",
  Hard: "red",
};

export function MockTestCard({ test }: { test: MockTest }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-900/5">
      <div className="flex items-center justify-between">
        <Badge variant="purple">{test.exam}</Badge>
        <Badge variant={DIFFICULTY_TONE[test.difficulty]}>{test.difficulty}</Badge>
      </div>
      <h3 className="mt-3 font-display text-lg font-bold text-gray-900">{test.title}</h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-500">{test.description}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5 text-purple-500" /> {test.questionCount} questions</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-purple-500" /> {test.durationMins} mins</span>
        <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5 text-purple-500" /> {test.subject}</span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{test.attempts.toLocaleString("en-IN")} attempts</span>
        <ButtonLink href={`/mock-tests/${test.slug}`} variant="primary" size="sm">
          <Play className="h-4 w-4" /> Take test
        </ButtonLink>
      </div>
    </div>
  );
}

export function MockTestEngine({
  tests: dataset,
}: {
  /** Test catalogue resolved on the server. */
  tests?: MockTest[];
}) {
  const { testHistory } = useApp();
  const tests = dataset?.length ? dataset : MOCK_TESTS;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-900 dark:via-purple-950/50 dark:to-slate-900 p-5 shadow-xs">
        <div>
          <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-white">Practice mock tests</h2>
          <p className="text-sm text-slate-500 dark:text-gray-300">Attempt full-length and section-wise mocks with instant solutions and analytics.</p>
        </div>
        <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200">
          View exam calendar <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {testHistory.length > 0 && (
        <div className="mt-5 rounded-2xl border border-green-100 dark:border-emerald-800/50 bg-green-50/60 dark:bg-emerald-950/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-emerald-300">
            <Trophy className="h-4 w-4" /> Last result: {testHistory[0].score}/{testHistory[0].maxScore} · {testHistory[0].percentile} percentile
          </p>
        </div>
      )}

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          Mock tests run in a <b>full-screen, timed mode</b> with a server-authoritative timer and
          autosaved answers. Attempt history and scoring are stored against your account so your
          results follow you across devices.
        </p>
      </div>

      {tests.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No mock tests have been published yet. Please check back soon.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((t) => (
            <MockTestCard key={t.id} test={t} />
          ))}
        </div>
      )}
    </div>
  );
}