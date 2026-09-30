"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MOCK_TESTS, getMockTest } from "@/lib/data/mockTests";

interface PlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  exam: string;
  examSlug: string;
  kind: "mock" | "exam";
  slug?: string;
  note?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function monthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const STORAGE_KEY = "pw-exam-plans";

function loadPlans(): PlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PlanEntry[];
  } catch {
    return [];
  }
}

export function ExamPlanner() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [selected, setSelected] = useState<Date | null>(null);
  const [selSlug, setSelSlug] = useState(MOCK_TESTS[0]?.slug ?? "");
  const [formDate, setFormDate] = useState(toKey(today));
  const [note, setNote] = useState("");

  useEffect(() => {
    // Hydrate persisted planner entries from localStorage on first mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans(loadPlans());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    } catch {
      // private mode — best-effort
    }
  }, [plans]);

  const plansByDate = useMemo(() => {
    const m = new Map<string, PlanEntry[]>();
    plans.forEach((p) => {
      const arr = m.get(p.date) ?? [];
      arr.push(p);
      m.set(p.date, arr);
    });
    return m;
  }, [plans]);

  const mockOptions = useMemo(
    () =>
      MOCK_TESTS.map((t) => ({
        slug: t.slug,
        title: t.title,
        exam: t.exam,
        examSlug: t.examSlug,
        slugLabel: t.slug,
      })),
    [],
  );

  const addMockPlan = () => {
    const mockTest = getMockTest(selSlug);
    if (!mockTest) return;
    const entry: PlanEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: formDate,
      title: mockTest.title,
      exam: mockTest.exam,
      examSlug: mockTest.examSlug,
      kind: "mock",
      slug: mockTest.slug,
      note: note.trim() || undefined,
    };
    setPlans((prev) => [...prev, entry]);
    setNote("");
  };

  const removePlan = (id: string) => setPlans((prev) => prev.filter((p) => p.id !== id));

  const cells = monthMatrix(cursor.y, cursor.m);
  const todayKey = toKey(today);
  const selectedKey = selected ? toKey(selected) : null;
  const upcoming = useMemo(() => {
    const days: { key: string; entries: PlanEntry[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const key = toKey(d);
      days.push({ key, entries: plansByDate.get(key) ?? [] });
    }
    return days;
  }, [today, plansByDate]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 sm:text-4xl">
            Exam Planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Block out your mock tests and real exam dates on a calendar so you can see exactly what your next
            two weeks look like — and close the gaps before the real thing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple">
            <Target className="h-3 w-3" /> {plans.length} planned
          </Badge>
          <ButtonLink variant="ghost" size="sm" href="/mock-tests">
            <ArrowLeft className="h-4 w-4" /> Back to mock tests
          </ButtonLink>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Calendar */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold text-gray-900">
              {new Date(cursor.y, cursor.m).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} />;
              const key = toKey(cell);
              const list = plansByDate.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(cell)}
                  className={cn(
                    "flex min-h-[64px] flex-col rounded-xl border p-1.5 text-left transition hover:border-purple-300",
                    isSelected ? "border-purple-500 bg-purple-50" : "border-slate-100 bg-white",
                  )}
                >
                  <span className={cn("text-xs font-bold", isToday ? "text-purple-700" : "text-gray-700")}>
                    {cell.getDate()}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-0.5">
                    {list.slice(0, 3).map((p) => (
                      <span key={p.id} className={cn("h-1.5 w-1.5 rounded-full", p.kind === "mock" ? "bg-purple-500" : "bg-amber-500")} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold text-gray-900">
                {selected.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <div className="mt-2 space-y-1.5">
                {(plansByDate.get(toKey(selected)) ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">Nothing planned yet — add a mock test below.</p>
                )}
                {(plansByDate.get(toKey(selected)) ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-900">{p.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.kind === "mock" ? "Mock test" : "Exam date"} {p.exam}
                      </p>
                    </div>
                    <button type="button" aria-label="Remove" onClick={() => removePlan(p.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <h3 className="font-display text-sm font-extrabold text-gray-900">Add a mock test</h3>
            <select value={selSlug} onChange={(e) => setSelSlug(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {mockOptions.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.title}
                </option>
              ))}
            </select>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. morning slot)" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <Button variant="primary" size="sm" className="mt-3 w-full" onClick={addMockPlan}>
              <Plus className="h-4 w-4" /> Add to calendar
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <h3 className="font-display text-sm font-extrabold text-gray-900">Upcoming 7 days</h3>
            <div className="mt-2 space-y-2">
              {upcoming.map((d) => (
                <button key={d.key} type="button" onClick={() => setSelected(fromKey(d.key))} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
                  <span className="text-xs font-semibold text-gray-800">
                    {new Date(d.key).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="text-[11px] text-slate-400">{d.entries.length || "—"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
