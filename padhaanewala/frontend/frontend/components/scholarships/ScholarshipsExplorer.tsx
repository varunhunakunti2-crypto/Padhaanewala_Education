"use client";

import { useState } from "react";
import {
  Award,
  ExternalLink,
  GraduationCap,
  Clock,
  Bookmark,
  FileText,
  ListChecks,
} from "lucide-react";
import { SCHOLARSHIPS } from "@/lib/data/scholarships";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/AppContext";
import type { Scholarship } from "@/lib/types";

const TAGS = ["All", "Merit", "Need", "Women", "Engineering", "Premier"];

function ScholarshipDetail({ sch, onClose }: { sch: Scholarship; onClose: () => void }) {
  const { isScholarshipSaved, toggleScholarshipSave } = useApp();
  const saved = isScholarshipSaved(sch.id);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-gray-900">{sch.name}</h3>
          <p className="text-xs text-slate-400">{sch.provider}</p>
        </div>
        <Badge variant="amber">
          <Clock className="h-3 w-3" /> Due {sch.deadline}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
          <p className="text-xs text-slate-500">Scholarship amount</p>
          <p className="text-lg font-extrabold text-green-700">{sch.amount}</p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
          <p className="text-xs text-slate-500">Renewable</p>
          <p className="text-lg font-extrabold text-purple-700">{sch.renewable ? "Yes" : "One-time"}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-gray-900">Eligibility</p>
        <p className="mt-1 text-sm text-slate-600">{sch.eligibility}</p>
      </div>

      {sch.documents?.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <FileText className="h-4 w-4 text-purple-500" /> Required documents
          </p>
          <ul className="mt-1.5 space-y-1">
            {sch.documents.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sch.applicationProcess?.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <ListChecks className="h-4 w-4 text-purple-500" /> Application process
          </p>
          <ol className="mt-1.5 space-y-1">
            {sch.applicationProcess.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 text-xs font-bold text-slate-500">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {sch.tags.map((t) => (
          <Badge key={t} variant="purple">{t}</Badge>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant={saved ? "secondary" : "accent"}
          className="flex-1"
          onClick={() => toggleScholarshipSave(sch.id, sch.name)}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          {saved ? "Saved to dashboard" : "Save scholarship"}
        </Button>
        <a
          href={sch.website ?? "#"}
          target="_blank"
          rel="noreferrer"
          className={
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          }
        >
          Official application <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <Button variant="ghost" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

export default function ScholarshipsExplorer() {
  const [tag, setTag] = useState("All");
  const [selected, setSelected] = useState<Scholarship | null>(null);
  const { isScholarshipSaved, toggleScholarshipSave } = useApp();
  const eligible = (sch: Scholarship) => tag === "All" || sch.tags.includes(tag);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-2xl">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-600">
          <GraduationCap className="h-4 w-4" /> Financial support
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Scholarships & Grants
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
          From national schemes like NSP and Pragati to major private foundations,
          explore funding that can make your education more affordable.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
        {SCHOLARSHIPS.filter(eligible).map((s) => {
          const saved = isScholarshipSaved(s.id);
          return (
            <article
              key={s.id}
              className="relative flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-orange-100/70 card-shadow transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`h-1.5 w-full bg-gradient-to-r ${s.color}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${s.color}`}>
                    <Award className="h-5 w-5" />
                  </span>
                  <button
                    type="button"
                    aria-label={saved ? `Unsave ${s.name}` : `Save ${s.name}`}
                    onClick={() => toggleScholarshipSave(s.id, s.name)}
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full transition",
                      saved ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-400 hover:bg-purple-50 hover:text-purple-600",
                    )}
                  >
                    <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
                  </button>
                </div>
                <h3 className="font-display mt-3 text-base font-bold leading-snug text-gray-900">{s.name}</h3>
                <p className="mt-1 text-xs text-gray-400">{s.provider}</p>

                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="w-20 shrink-0 text-xs font-medium text-gray-400">Amount</dt>
                    <dd className="font-bold text-purple-700 tabular-nums">{s.amount}</dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <dt className="w-20 shrink-0 text-xs font-medium text-gray-400">Eligibility</dt>
                    <dd className="text-xs leading-relaxed text-gray-500">{s.eligibility}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="w-20 shrink-0 text-xs font-medium text-gray-400">Deadline</dt>
                    <dd className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <Clock className="h-3 w-3" /> {new Date(s.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <Badge key={t} variant="purple" className="text-[11px]">
                      {t}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="accent" size="sm" className="flex-1" onClick={() => setSelected(s)}>
                    View details
                  </Button>
                  <a
                    href={s.website ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Apply for ${s.name}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scholarship details">
        {selected && <ScholarshipDetail sch={selected} onClose={() => setSelected(null)} />}
      </Modal>
    </section>
  );
}