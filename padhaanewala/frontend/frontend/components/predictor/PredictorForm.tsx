"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  TrendingUp,
  Flag,
  ShieldAlert,
  ArrowRight,
  GraduationCap,
  Wallet,
  Home,
  Landmark,
  MapPin,
} from "lucide-react";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CollegeCard } from "@/components/college/CollegeCard";
import { COLLEGES, ALL_STATES, ALL_CITIES } from "@/lib/data";
import { ALL_EXAMS } from "@/lib/data";
import { ALL_DEGREES } from "@/lib/data";
import { predictColleges } from "@/lib/data/predictor";
import type { PredictorInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  "Course",
  "Exam",
  "Rank / Score",
  "Category",
  "State",
  "Preferred City",
  "Budget",
  "Sector",
  "Hostel",
  "Review",
] as const;

const CATEGORIES = ["General", "OBC-NCL", "SC", "ST", "EWS", "General-PwD"];
const SECTOR_OPTIONS = ["Any", "Government", "Private"] as const;
const BUDGETS = [
  "Under ₹1L",
  "₹1L – ₹2.5L",
  "₹2.5L – ₹5L",
  "₹5L – ₹10L",
  "Above ₹10L",
  "No budget limit",
];
const ADDITIONALS = ["Good placement record", "Campus near metro city", "Strong research culture", "Larger alumni network"];

const INITIAL: PredictorInput = {
  course: "",
  exam: "",
  rankOrScore: "",
  category: "General",
  state: "All India",
  preferredCity: "Any city",
  budget: "No budget limit",
  sectorPref: "Any",
  hostel: null,
  additional: [],
};

interface StepProps {
  input: PredictorInput;
  set: (patch: Partial<PredictorInput>) => void;
}

function StepCourse({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor="pred-course">Which course are you targeting?</Label>
      <Select id="pred-course" value={input.course} onChange={(e) => set({ course: e.target.value })}>
        <option value="">Select a course</option>
        {ALL_DEGREES.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
        <option value="MBBS">MBBS (Medical)</option>
        <option value="BAMS">BAMS (Ayurveda)</option>
        <option value="BHMS">BHMS (Homeopathy)</option>
        <option value="B.Sc Nursing">B.Sc Nursing</option>
        <option value="B.Arch">B.Arch</option>
        <option value="LLB">LLB (Law)</option>
      </Select>
      <p className="text-xs text-slate-400">We&apos;ll rank colleges that offer courses matching your choice.</p>
      <PopularCourses onPick={(c) => set({ course: c })} input={input} />
    </div>
  );
}

function PopularCourses({ onPick, input }: { onPick: (c: string) => void; input: PredictorInput }) {
  const popular = ["B.Tech", "MBA", "BBA", "B.Sc", "B.Pharm", "MBBS"];
  return (
    <div className="flex flex-wrap gap-2">
      {popular.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            input.course === c
              ? "border-purple-500 bg-purple-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-700",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function StepExam({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor="pred-exam">Which entrance exam will you appear for?</Label>
      <Select id="pred-exam" value={input.exam} onChange={(e) => set({ exam: e.target.value })}>
        <option value="">Select an exam (optional)</option>
        {[...ALL_EXAMS, "BITSAT", "CLAT", "NEET", "CAT", "GATE"].sort().filter((v, i, a) => a.indexOf(v) === i).map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </Select>
      <p className="text-xs text-slate-400">Choose the exam so we can match colleges that accept its scores.</p>
    </div>
  );
}

function StepRank({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor="pred-rank">Expected rank or score</Label>
      <Input
        id="pred-rank"
        value={input.rankOrScore}
        onChange={(e) => set({ rankOrScore: e.target.value })}
        placeholder={input.exam ? "e.g. AIR ~5000 or 97 percentile" : "e.g. 15000 rank / 95 percentile"}
      />
      <p className="text-xs text-slate-400">Enter a rank like &quot;AIR 4500&quot;, a percentile, or leave blank for a general estimate.</p>
    </div>
  );
}

function StepCategory({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Select your category</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set({ category: c })}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
              input.category === c
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-purple-300",
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepState({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor="pred-state">Which state are you from?</Label>
      <Select id="pred-state" value={input.state} onChange={(e) => set({ state: e.target.value })}>
        <option value="All India">All India</option>
        {ALL_STATES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      <p className="text-xs text-slate-400">Home-state quota can improve your chances in government colleges.</p>
    </div>
  );
}

function StepCity({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor="pred-city">Any preferred city?</Label>
      <Select id="pred-city" value={input.preferredCity} onChange={(e) => set({ preferredCity: e.target.value })}>
        <option value="Any city">Any city</option>
        {ALL_CITIES.map((c) => (
          <option key={c} value={c.split(",")[0].trim()}>{c}</option>
        ))}
      </Select>
    </div>
  );
}

function StepBudget({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Annual tuition budget (per year)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BUDGETS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => set({ budget: b })}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              input.budget === b
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-purple-300",
            )}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepSector({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Government or private preference?</p>
      <div className="grid grid-cols-3 gap-2">
        {SECTOR_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set({ sectorPref: s })}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-medium transition",
              input.sectorPref === s
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-purple-300",
            )}
          >
            {s === "Government" ? <Landmark className="h-5 w-5" /> : s === "Private" ? <GraduationCap className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepHostel({ input, set }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Do you need hostel facilities?</p>
      <div className="grid grid-cols-3 gap-2">
        {(["Yes", "No", "Not sure"] as const).map((h) => {
          const val = h === "Yes" ? true : h === "No" ? false : null;
          return (
            <button
              key={h}
              type="button"
              onClick={() => set({ hostel: val })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-medium transition",
                input.hostel === val
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-purple-300",
              )}
            >
              <Home className="h-5 w-5" />
              {h}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepReview({ input, set }: StepProps) {
  const summary: [string, string][] = [
    ["Course", input.course || "—"],
    ["Exam", input.exam || "Any"],
    ["Rank / score", input.rankOrScore || "Not entered"],
    ["Category", input.category],
    ["State", input.state],
    ["Preferred city", input.preferredCity],
    ["Budget", input.budget],
    ["Sector", input.sectorPref],
    ["Hostel", input.hostel === null ? "Not sure" : input.hostel ? "Required" : "Not required"],
  ];
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Additional preferences (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {ADDITIONALS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() =>
                set({ additional: input.additional.includes(a) ? input.additional.filter((x) => x !== a) : [...input.additional, a] })
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                input.additional.includes(a)
                  ? "border-purple-500 bg-purple-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-purple-300",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <div className="divide-y divide-slate-100">
          {summary.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between bg-white px-4 py-2.5">
              <span className="text-xs font-medium text-slate-500">{k}</span>
              <span className="text-sm font-semibold text-slate-800">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type StepComponent = (props: StepProps) => React.ReactNode;

const STEPS_COMPONENT: Record<string, StepComponent> = {
  Course: StepCourse,
  Exam: StepExam,
  "Rank / Score": StepRank,
  Category: StepCategory,
  State: StepState,
  "Preferred City": StepCity,
  Budget: StepBudget,
  Sector: StepSector,
  Hostel: StepHostel,
  Review: StepReview,
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  Course: <GraduationCap className="h-5 w-5" />,
  Exam: <Sparkles className="h-5 w-5" />,
  "Rank / Score": <TrendingUp className="h-5 w-5" />,
  Category: <Target className="h-5 w-5" />,
  State: <Landmark className="h-5 w-5" />,
  "Preferred City": <MapPin className="h-5 w-5" />,
  Budget: <Wallet className="h-5 w-5" />,
  Sector: <GraduationCap className="h-5 w-5" />,
  Hostel: <Home className="h-5 w-5" />,
  Review: <Flag className="h-5 w-5" />,
};

export function PredictorForm() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<PredictorInput>(INITIAL);
  const [done, setDone] = useState(false);
  const [asked, setAsked] = useState(false);

  const stepName = STEPS[step];
  const StepComp = STEPS_COMPONENT[stepName];

  const canNext = step === 0 ? input.course.trim().length > 0 : true;

  const results = input.course.trim() && asked ? predictColleges(input) : null;

  const set = (patch: Partial<PredictorInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const next = () => {
    if (step === STEPS.length - 1) {
      setAsked(true);
      setDone(true);
      return;
    }
    setStep((s) => s + 1);
  };

  if (done && results) {
    return (
      <PredictorResults
        results={results}
        input={input}
        onRestart={() => {
          setInput(INITIAL);
          setStep(0);
          setDone(false);
          setAsked(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-xl shadow-purple-900/5">
      {/* Progress header */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-5">
        <div className="flex items-center gap-2 text-white/80">
          <Sparkles className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">AI College Predictor</p>
        </div>
        <h2 className="mt-1 font-display text-xl font-extrabold text-white">
          Find colleges that fit your profile
        </h2>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-300 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-white">
            Step {step + 1}/{STEPS.length}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
            {STEP_ICONS[stepName]}
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{stepName}</h3>
            <p className="text-xs text-slate-400">Padhaanewala AI College Predictor</p>
          </div>
        </div>

        <StepComp input={input} set={set} />

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="accent" onClick={next} disabled={!canNext}>
            {step === STEPS.length - 1 ? (
              <>
                <Sparkles className="h-4 w-4" /> Predict colleges
              </>
            ) : (
              <>
                Next <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-orange-50/60 px-6 py-3 dark:border-slate-800 dark:bg-orange-950/30">
        <p className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300 font-medium">
          <ShieldAlert className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
          This prediction is an estimate based on curated data and does not guarantee admission.
        </p>
      </div>
    </div>
  );
}

export function PredictorResults({
  results,
  input,
  onRestart,
}: {
  results: { highlySuitable: typeof COLLEGES; possible: typeof COLLEGES; reach: typeof COLLEGES };
  input: PredictorInput;
  onRestart: () => void;
}) {
  const sections = [
    { key: "highlySuitable" as const, title: "Highly Suitable", icon: <Target className="h-4 w-4" />, tone: "green", desc: "Best matches for your profile and goals." },
    { key: "possible" as const, title: "Possible", icon: <TrendingUp className="h-4 w-4" />, tone: "amber", desc: "Good options if your rank varies from the estimate." },
    { key: "reach" as const, title: "Reach", icon: <Flag className="h-4 w-4" />, tone: "purple", desc: "Ambitious choices — worth trying for top scores." },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 px-6 py-8 text-center shadow-xl">
        <Sparkles className="mx-auto h-8 w-8 text-amber-300" />
        <h2 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
          Your college matches are ready
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
          Based on {input.course || "your course"}, {input.exam || "all exams"}, {input.category} category
          {input.state !== "All India" ? ` from ${input.state}` : ""} · {input.budget}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="purple">{results.highlySuitable.length + results.possible.length + results.reach.length} colleges found</Badge>
          <Badge variant="yellow">Estimate only</Badge>
          <Button variant="warm-gradient" size="sm" onClick={onRestart} className="rounded-full">
            Restart predictor <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {sections.map((section) => {
          const colleges = results[section.key];
          if (!colleges.length) return null;
          return (
            <section key={section.key}>
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
                  {section.icon}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-slate-500">{section.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {colleges.map((c) => (
                  <CollegeCard key={c.id} college={c} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-5 dark:border-orange-900/40 dark:bg-orange-950/30">
        <ShieldAlert className="h-5 w-5 shrink-0 text-orange-500 dark:text-orange-400" />
        <p className="text-sm text-orange-800 dark:text-orange-300">
          The prediction is an estimate and does not guarantee admission. Cutoffs change every year based on
          exam difficulty and seat availability. Always cross-check with official counselling brochures and
          rank predictors for your specific exam.
        </p>
      </div>
    </div>
  );
}