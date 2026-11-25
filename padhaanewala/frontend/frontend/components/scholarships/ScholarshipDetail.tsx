"use client";

import {
  Bookmark,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/AppContext";
import type { Scholarship } from "@/lib/types";

/**
 * Shared scholarship detail body.
 *
 * The listing opens it inside a modal; `/scholarships/[slug]` renders the same
 * content as a page. `onClose` is therefore optional, and the heading can be an
 * `h1` on the page without giving the modal two competing top-level headings.
 */
export function ScholarshipDetail({
  sch,
  onClose,
  titleAs = "h3",
}: {
  sch: Scholarship;
  onClose?: () => void;
  titleAs?: "h1" | "h3";
}) {
  const { isScholarshipSaved, toggleScholarshipSave } = useApp();
  const saved = isScholarshipSaved(sch.id);
  const Heading = titleAs === "h1" ? "h1" : "h3";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Heading className="font-display text-lg font-bold text-gray-900">{sch.name}</Heading>
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
        <SafeExternalLink
          href={sch.website}
          className={
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          }
        >
          Official application <ExternalLink className="h-4 w-4" />
        </SafeExternalLink>
      </div>

      {onClose && (
        <Button variant="ghost" className="w-full" onClick={onClose}>Close</Button>
      )}
    </div>
  );
}
