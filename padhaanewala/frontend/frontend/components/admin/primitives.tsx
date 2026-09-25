"use client";

/** Shared presentational building blocks used across admin panels. */

import {
  Eye,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";

export const STAT_ICONS = { up: TrendingUp, down: TrendingDown };

export function StatCard({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  const Icon = up ? STAT_ICONS.up : STAT_ICONS.down;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-extrabold text-gray-900">{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", up ? "text-green-600" : "text-red-500")}>
          <Icon className="h-3.5 w-3.5" /> {delta}
        </p>
      )}
    </div>
  );
}

export function Panel({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-bold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SectionHeading({ title, description, count, action }: { title: string; description?: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-extrabold text-gray-900">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{count.toLocaleString("en-IN")}</span>
          )}
        </div>
        {description && <p className="mt-0.5 max-w-xl text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function AddButton({ label }: { label: string }) {
  const { showToast } = useApp();
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => showToast({ title: `New ${label}`, description: "Create flow is a demo action in this build.", variant: "info" })}
    >
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}

export function IconAction({ title, onClick, className, children }: { title: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function RowActions({ item, noun }: { item: string; noun: string }) {
  const { showToast } = useApp();
  const act = (label: string) =>
    showToast({ title: `${label} ${noun}`, description: `“${item}” — demo action in this build.`, variant: "info" });
  return (
    <div className="flex items-center justify-end gap-1">
      <IconAction title={`View ${noun}`} onClick={() => act("View")}>
        <Eye className="h-4 w-4" />
      </IconAction>
      <IconAction title={`Edit ${noun}`} onClick={() => act("Edit")}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      <IconAction title={`Delete ${noun}`} onClick={() => act("Delete")} className="hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </div>
  );
}


export function FilterChips<T extends string>({ options, value, onChange, counts }: {
  options: readonly T[];
  value: T | "all";
  onChange: (v: T | "all") => void;
  counts?: Partial<Record<T | "all", number>>;
}) {
  const render = (label: T | "all") => {
    const active = value === label;
    const labelText = label === "all" ? "All" : label.charAt(0).toUpperCase() + label.slice(1);
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(label)}
        aria-pressed={active}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
          active ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
      >
        {labelText}
        {counts && counts[label] !== undefined ? ` · ${counts[label]}` : ""}
      </button>
    );
  };
  return <div className="flex flex-wrap gap-2">{render("all")}{options.map(render)}</div>;
}

export function ProgressBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-xs font-semibold text-slate-500">{value}{suffix ?? "%"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-700 to-indigo-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function BadgeForStatus(status: string) {
  if (status === "Active" || status === "Approved" || status === "converted" || status === "Contacted") return "green";
  if (status === "Pending" || status === "new" || status === "contacted") return status === "contacted" ? "blue" : "yellow";
  if (status === "Lead") return "yellow";
  return "gray";
}

/* ---------------------------------- Dashboard ---------------------------------- */
