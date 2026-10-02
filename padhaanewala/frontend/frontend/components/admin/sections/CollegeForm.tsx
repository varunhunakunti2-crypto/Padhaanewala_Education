"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import type { AdminCourse, AdminDistrict, AdminState, AdminUniversity } from "@/lib/api";
import { EMPTY_COLLEGE_COURSE, type CollegeFormValues } from "@/lib/college-form";

/**
 * The field set for creating and editing a college.
 *
 * One component serves both modes because the fields are the same and the
 * *submission* is not: `lib/college-form.ts` applies `CollegeCreate`'s or
 * `CollegeUpdate`'s field set from `mode`. What does differ visibly is the
 * course repeater, which is create-only because `CollegeUpdate` has no `courses`
 * key, and the feature toggle, which is update-only for the same reason.
 *
 * No value is coerced on the way in. Every numeric field is a string until the
 * payload builder decides it is a number, because `JSON.stringify` turns `NaN`
 * into `null` and a typo would otherwise be written as a deliberate clear.
 */

const TEXTAREA =
  "w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none";

/** Stands in for `null` rather than `""`, which would store an empty string. */
function optional(value: string | null | undefined, label: string) {
  return (
    <option value="">{label}</option>
  );
}

function TriStateSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: CollegeFormValues["has_hostel"];
  onChange: (v: CollegeFormValues["has_hostel"]) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as "yes" | "no" | "unknown")}>
        <option value="unknown">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function CollegeFormFields({
  values,
  onChange,
  onSelectState,
  mode,
  states,
  districts,
  districtsLoading,
  universities,
  courses,
  disabled,
}: {
  values: CollegeFormValues;
  onChange: (next: CollegeFormValues) => void;
  onSelectState: (stateId: string) => void;
  mode: "create" | "update";
  states: AdminState[];
  districts: AdminDistrict[];
  districtsLoading: boolean;
  universities: AdminUniversity[];
  courses: AdminCourse[];
  disabled?: boolean;
}) {
  const set = <K extends keyof CollegeFormValues>(key: K, value: CollegeFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const setCourse = (index: number, key: keyof (typeof values.courses)[number], value: string) =>
    onChange({
      ...values,
      courses: values.courses.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    });

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-gray-900">Identity</legend>
        <Field id="college-name" label="Name" hint="Shown in listings and used to build the public URL. 2–255 characters.">
          <Input
            id="college-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Indian Institute of Technology Madras"
            required
            aria-required="true"
            maxLength={255}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="college-official-name" label="Official name" hint="The name on the institution's own records, if it differs.">
            <Input
              id="college-official-name"
              value={values.official_name}
              onChange={(e) => set("official_name", e.target.value)}
            />
          </Field>
          <Field id="college-type" label="Institution type" hint="For example Institute, University, Polytechnic.">
            <Input
              id="college-type"
              value={values.college_type}
              onChange={(e) => set("college_type", e.target.value)}
            />
          </Field>
          <Field id="college-ownership" label="Ownership">
            <Select id="college-ownership" value={values.ownership} onChange={(e) => set("ownership", e.target.value)}>
              {optional(values.ownership, "Not recorded")}
              <option value="Government">Government</option>
              <option value="Private">Private</option>
              <option value="Deemed">Deemed</option>
              <option value="Autonomous">Autonomous</option>
            </Select>
          </Field>
          <Field id="college-university" label="University">
            <Select
              id="college-university"
              value={values.university_id}
              onChange={(e) => set("university_id", e.target.value)}
            >
              {optional(values.university_id, "Not affiliated")}
              {universities.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                  {u.city ? ` — ${u.city}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-gray-900">Location</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="college-state"
            label="State"
            hint="Changing this clears the district, which must belong to the chosen state."
          >
            <Select id="college-state" value={values.state_id} onChange={(e) => onSelectState(e.target.value)}>
              {optional(values.state_id, "Not recorded")}
              {states.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="college-district" label="District">
            <Select
              id="college-district"
              value={values.district_id}
              disabled={districtsLoading}
              onChange={(e) => set("district_id", e.target.value)}
            >
              {optional(values.district_id, districtsLoading ? "Loading districts…" : "Not recorded")}
              {districts.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="college-city" label="City">
            <Input
              id="college-city"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field id="college-pincode" label="Pincode">
            <Input
              id="college-pincode"
              value={values.pincode}
              onChange={(e) => set("pincode", e.target.value)}
              inputMode="numeric"
              maxLength={10}
            />
          </Field>
        </div>
        <Field id="college-address" label="Address">
          <Input
            id="college-address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="college-lat" label="Latitude" hint="Decimal degrees, up to 7 places.">
            <Input
              id="college-lat"
              value={values.lat}
              onChange={(e) => set("lat", e.target.value)}
              inputMode="decimal"
              placeholder="12.9925000"
            />
          </Field>
          <Field id="college-lng" label="Longitude" hint="Decimal degrees, up to 7 places.">
            <Input
              id="college-lng"
              value={values.lng}
              onChange={(e) => set("lng", e.target.value)}
              inputMode="decimal"
              placeholder="80.2345000"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-gray-900">Contact</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="college-email" label="Email">
            <Input
              id="college-email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field id="college-phone" label="Phone">
            <Input
              id="college-phone"
              type="tel"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field id="college-website" label="Website" hint="Include the scheme, for example https://.">
            <Input
              id="college-website"
              type="url"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-gray-900">Accreditation</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="college-year" label="Established year">
            <Input
              id="college-year"
              value={values.established_year}
              onChange={(e) => set("established_year", e.target.value)}
              inputMode="numeric"
              placeholder="1959"
            />
          </Field>
          <Field id="college-naac" label="NAAC grade" hint="For example A++, A+, A, B++.">
            <Input
              id="college-naac"
              value={values.accreditation_naac}
              onChange={(e) => set("accreditation_naac", e.target.value)}
            />
          </Field>
          <TriStateSelect
            id="college-nba"
            label="NBA accredited"
            value={values.accreditation_nba}
            onChange={(v) => set("accreditation_nba", v)}
          />
          <TriStateSelect
            id="college-hostel"
            label="Has hostel"
            value={values.has_hostel}
            onChange={(v) => set("has_hostel", v)}
          />
        </div>
        {mode === "update" && (
          <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={values.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Featured
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-gray-900">About</legend>
        <div>
          <Label htmlFor="college-overview">Overview</Label>
          <textarea
            id="college-overview"
            rows={4}
            value={values.overview}
            onChange={(e) => set("overview", e.target.value)}
            className={TEXTAREA}
          />
        </div>
      </fieldset>

      {mode === "create" && (
        <fieldset className="space-y-3" disabled={disabled}>
          <legend className="text-sm font-semibold text-gray-900">Courses offered</legend>
          <p className="text-xs text-slate-500">
            Optional. Courses can be added after the college exists, from its own
            courses endpoint — this list cannot be edited from here.
          </p>
          {values.courses.map((row, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Course {index + 1}</p>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    onChange({ ...values, courses: values.courses.filter((_, i) => i !== index) })
                  }
                  aria-label={`Remove course ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`college-course-${index}`} label="Course">
                  <Select
                    id={`college-course-${index}`}
                    value={row.course_id}
                    onChange={(e) => setCourse(index, "course_id", e.target.value)}
                  >
                    {optional(row.course_id, "Choose a course")}
                    {courses.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.degree ? ` — ${c.degree}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={`college-course-exam-${index}`} label="Entrance exam">
                  <Input
                    id={`college-course-exam-${index}`}
                    value={row.entrance_exam}
                    onChange={(e) => setCourse(index, "entrance_exam", e.target.value)}
                  />
                </Field>
                <Field id={`college-course-annual-${index}`} label="Annual fee">
                  <Input
                    id={`college-course-annual-${index}`}
                    value={row.annual_fee}
                    inputMode="decimal"
                    onChange={(e) => setCourse(index, "annual_fee", e.target.value)}
                  />
                </Field>
                <Field id={`college-course-total-${index}`} label="Total fee">
                  <Input
                    id={`college-course-total-${index}`}
                    value={row.total_fee}
                    inputMode="decimal"
                    onChange={(e) => setCourse(index, "total_fee", e.target.value)}
                  />
                </Field>
                <Field id={`college-course-mode-${index}`} label="Admission mode">
                  <Input
                    id={`college-course-mode-${index}`}
                    value={row.admission_mode}
                    onChange={(e) => setCourse(index, "admission_mode", e.target.value)}
                  />
                </Field>
                <Field id={`college-course-seats-${index}`} label="Intake seats">
                  <Input
                    id={`college-course-seats-${index}`}
                    value={row.intake_seats}
                    inputMode="numeric"
                    onChange={(e) => setCourse(index, "intake_seats", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onChange({ ...values, courses: [...values.courses, { ...EMPTY_COLLEGE_COURSE }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add course
          </Button>
        </fieldset>
      )}
    </div>
  );
}
