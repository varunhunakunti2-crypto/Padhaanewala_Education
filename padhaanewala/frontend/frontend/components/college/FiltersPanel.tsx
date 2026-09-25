"use client";

import {
  MapPin,
  GraduationCap,
  Landmark,
  Building2,
  FileCheck2,
  Award,
  BedDouble,
  IndianRupee,
  RotateCcw,
  X,
  Layers,
  CheckSquare,
  CircleCheck,
  Star,
} from "lucide-react";
import type { SearchFilters, Sector } from "@/lib/types";
import { FEE_RANGES, buildFacets, type CollegeFacets } from "@/lib/data";
import { cn } from "@/lib/utils";

const ADMISSION_LABELS: Record<string, string> = {
  open: "Admissions open",
  closed: "Admissions closed",
  upcoming: "Admissions upcoming",
};

export function FilterGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-gray-100 px-4 py-4 last:border-0">
      <legend className="mb-2.5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-gray-700">
        {icon}
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-purple-50/60"
    >
      <span
        className={cn(
          "grid h-4.5 w-4.5 shrink-0 place-items-center rounded border transition-colors",
          checked ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2.5 6.5 5 9 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="flex-1 truncate text-sm text-gray-700 group-hover:text-purple-800">{label}</span>
      {typeof count === "number" && (
        <span className="text-xs text-gray-400">{count}</span>
      )}
    </button>
  );
}

interface FiltersProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onClear: () => void;
  counts?: Record<string, number>;
  onClose?: () => void;
  /** Facet values derived from the active dataset; falls back to bundled lists. */
  facets?: CollegeFacets;
}

const BUNDLED = buildFacets();

export function FiltersPanel({ filters, onChange, onClear, onClose, facets = BUNDLED }: FiltersProps) {
  const toggle = <T,>(arrKey: "states" | "cities" | "courseNames" | "sectors" | "types" | "exams" | "accreditations" | "districts" | "universities" | "admissionStatuses", value: T) => {
    const current = (filters[arrKey] as T[]) ?? [];
    const exists = current.some((x) => String(x) === String(value));
    onChange({
      [arrKey]: exists ? current.filter((x) => String(x) !== String(value)) : [...current, value],
    } as Partial<SearchFilters>);
  };

  const activeCount =
    (filters.states?.length ?? 0) +
    (filters.cities?.length ?? 0) +
    (filters.courseNames?.length ?? 0) +
    (filters.sectors?.length ?? 0) +
    (filters.types?.length ?? 0) +
    (filters.exams?.length ?? 0) +
    (filters.accreditations?.length ?? 0) +
    (filters.districts?.length ?? 0) +
    (filters.universities?.length ?? 0) +
    (filters.admissionStatuses?.length ?? 0) +
    (filters.minRating !== null ? 1 : 0) +
    (filters.hostel === true ? 1 : 0) +
    (filters.placementRate === true ? 1 : 0) +
    (filters.minFee !== null ? 1 : 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-bold text-gray-900">
          Filters{" "}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {(activeCount > 0 || filters.query) && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-purple-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
          {onClose && (
            <button
              aria-label="Close filters"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto pb-28 lg:pb-4">
        <FilterGroup title="Degree" icon={<GraduationCap className="h-3.5 w-3.5 text-purple-500" />}>
          <div className="space-y-0.5">
            {facets.degrees.map((d) => (
              <CheckboxRow
                key={d}
                label={d}
                checked={(filters.courseNames ?? []).includes(d)}
                onChange={() => toggle("courseNames", d)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="State" icon={<MapPin className="h-3.5 w-3.5 text-blue-500" />}>
          <div className="space-y-0.5">
            {facets.states.map((s) => (
              <CheckboxRow
                key={s}
                label={s}
                checked={(filters.states ?? []).includes(s)}
                onChange={() => toggle("states", s)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="City" icon={<MapPin className="h-3.5 w-3.5 text-amber-500" />}>
          <div className="space-y-0.5">
            {facets.cities.map((c) => (
              <CheckboxRow
                key={c}
                label={c}
                checked={(filters.cities ?? []).includes(c)}
                onChange={() => toggle("cities", c)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="College type" icon={<Building2 className="h-3.5 w-3.5 text-orange-500" />}>
          <div className="space-y-0.5">
            {facets.types.map((t) => (
              <CheckboxRow
                key={t}
                label={t}
                checked={(filters.types ?? []).includes(t)}
                onChange={() => toggle("types", t)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Ownership" icon={<Landmark className="h-3.5 w-3.5 text-purple-500" />}>
          <div className="space-y-0.5">
            {(["Government", "Private"] as Sector[]).map((s) => (
              <CheckboxRow
                key={s}
                label={`${s} colleges`}
                checked={(filters.sectors ?? []).includes(s)}
                onChange={() => toggle("sectors", s)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Entrance exam" icon={<FileCheck2 className="h-3.5 w-3.5 text-blue-500" />}>
          <div className="space-y-0.5">
            {facets.exams.map((e) => (
              <CheckboxRow
                key={e}
                label={e}
                checked={(filters.exams ?? []).includes(e)}
                onChange={() => toggle("exams", e)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Accreditation" icon={<Award className="h-3.5 w-3.5 text-amber-500" />}>
          <div className="space-y-0.5">
            {facets.accreditations.map((a) => (
              <CheckboxRow
                key={a}
                label={a}
                checked={(filters.accreditations ?? []).includes(a)}
                onChange={() => toggle("accreditations", a)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Rating" icon={<Star className="h-3.5 w-3.5 text-amber-500" />}>
          <div className="space-y-0.5">
            {[4.5, 4.0, 3.5].map((r) => (
              <CheckboxRow
                key={r}
                label={`${r}? & above`}
                checked={filters.minRating === r}
                onChange={(v) => onChange({ minRating: v ? r : null })}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Admission status" icon={<CircleCheck className="h-3.5 w-3.5 text-green-500" />}>
          <div className="space-y-0.5">
            {(["open", "closed", "upcoming"] as const).map((s) => (
              <CheckboxRow
                key={s}
                label={ADMISSION_LABELS[s]}
                checked={(filters.admissionStatuses ?? []).includes(s)}
                onChange={() => toggle("admissionStatuses", s)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="District" icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}>
          <div className="space-y-0.5">
            {facets.districts.map((d) => (
              <CheckboxRow
                key={d}
                label={d}
                checked={(filters.districts ?? []).includes(d)}
                onChange={() => toggle("districts", d)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="University / Board" icon={<CheckSquare className="h-3.5 w-3.5 text-purple-500" />}>
          <div className="space-y-0.5">
            {facets.universities.map((u) => (
              <CheckboxRow
                key={u}
                label={u}
                checked={(filters.universities ?? []).includes(u)}
                onChange={() => toggle("universities", u)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Facilities" icon={<BedDouble className="h-3.5 w-3.5 text-purple-500" />}>
          <div className="space-y-0.5">
            <CheckboxRow
              label="Hostel available"
              checked={filters.hostel === true}
              onChange={(v) => onChange({ hostel: v ? true : null })}
            />
            <CheckboxRow
              label="85%+ placement rate"
              checked={filters.placementRate === true}
              onChange={(v) => onChange({ placementRate: v ? true : null })}
            />
          </div>
        </FilterGroup>

        <FilterGroup title="Annual fees" icon={<IndianRupee className="h-3.5 w-3.5 text-orange-500" />}>
          <div className="space-y-0.5">
            {FEE_RANGES.map((r) => {
              const active = filters.minFee === r.min && filters.maxFee === r.max;
              return (
                <CheckboxRow
                  key={r.label}
                  label={r.label}
                  checked={active}
                  onChange={(v) =>
                    onChange(v ? { minFee: r.min, maxFee: r.max } : { minFee: null, maxFee: null })
                  }
                />
              );
            })}
          </div>
        </FilterGroup>
      </div>

      <div className="border-t border-gray-100 p-4 lg:hidden">
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-700"
        >
          Show {activeCount > 0 ? `${activeCount} filtered ` : ""}results
        </button>
      </div>
    </div>
  );
}
