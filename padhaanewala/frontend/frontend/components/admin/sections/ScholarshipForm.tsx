"use client";

import { Input, Select } from "@/components/ui/FormField";
import { Field, FieldSet, NoneOption, Textarea } from "@/components/admin/fields";
import type { AdminState } from "@/lib/api";
import {
  SCHOLARSHIP_OWNERSHIPS,
  SCHOLARSHIP_VERIFICATION_STATUSES,
  type ScholarshipFormValues,
} from "@/lib/scholarship-form";

/**
 * The field set for creating and editing a scholarship.
 *
 * ## `amount` is a text box on purpose
 *
 * A scheme's amount is not a number. It is "₹50,000 per year", "up to ₹2,00,000",
 * "50% of tuition fee" — which is why the column is `String(255)`. An
 * `inputMode="decimal"` field would refuse most real values and, where it did
 * accept one, write a rounded integer over the text that was there. The hint says
 * so, because a text box on a money column otherwise reads as a mistake.
 *
 * ## `ownership` and `verification_status` are datalists, not selects
 *
 * Both are `String(20)` columns with a default and **no enum anywhere in the
 * schema**, so seeded data may already hold values this build has never seen. A
 * `<select>` of values invented from the column name would silently fail to open
 * a record carrying anything else — the admin would see a blank field on a row
 * that has one, and saving would then write the invented default over it. The
 * datalist prevents typos *and* round-trips every existing value.
 *
 * ## `state_id` is a real foreign key, so it is a real list
 *
 * `ScholarshipResponse` resolves it to `state_name`, and the column is a genuine
 * FK to `state`. Loaded from `GET /locations/states` when the dialog opens.
 *
 * ## `documents_required` and `is_active` are absent
 *
 * `list_scholarships` and `get_scholarship` filter `where(Scholarship.is_active)`,
 * so a toggle-off row leaves the table and cannot be reopened — and
 * `documents_required` is a `list` column that a textarea would 422 on. Both are
 * omitted in both modes, which leaves them as the server holds them. See
 * `lib/scholarship-form.ts`.
 */
export function ScholarshipFormFields({
  values,
  onChange,
  states,
  statesLoading,
  disabled,
}: {
  values: ScholarshipFormValues;
  onChange: (next: ScholarshipFormValues) => void;
  states: AdminState[];
  statesLoading?: boolean;
  disabled?: boolean;
}) {
  const set = <K extends keyof ScholarshipFormValues>(key: K, value: ScholarshipFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-6">
      <FieldSet legend="Scheme" disabled={disabled}>
        <Field
          id="scholarship-name"
          label="Name"
          hint="Shown in listings and used to build the public URL. 2–255 characters."
        >
          <Input
            id="scholarship-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="National Merit Scholarship"
            required
            aria-required="true"
            maxLength={255}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="scholarship-provider" label="Provider" hint="The body running the scheme. 2–255 characters.">
            <Input
              id="scholarship-provider"
              value={values.provider}
              onChange={(e) => set("provider", e.target.value)}
              placeholder="Ministry of Education"
              required
              aria-required="true"
              maxLength={255}
            />
          </Field>
          <Field id="scholarship-state" label="State">
            <Select
              id="scholarship-state"
              value={values.state_id}
              disabled={statesLoading}
              onChange={(e) => set("state_id", e.target.value)}
            >
              <NoneOption label={statesLoading ? "Loading states…" : "All states"} />
              {states.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="scholarship-ownership"
            label="Ownership"
            hint="Suggestions only — the column has no fixed list, so an unusual value is kept as typed."
          >
            <Input
              id="scholarship-ownership"
              list="scholarship-ownership-options"
              value={values.ownership}
              onChange={(e) => set("ownership", e.target.value)}
              maxLength={20}
            />
            <datalist id="scholarship-ownership-options">
              {SCHOLARSHIP_OWNERSHIPS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
          <Field
            id="scholarship-verification"
            label="Verification status"
            hint="Suggestions only, for the same reason as ownership."
          >
            <Input
              id="scholarship-verification"
              list="scholarship-verification-options"
              value={values.verification_status}
              onChange={(e) => set("verification_status", e.target.value)}
              maxLength={20}
            />
            <datalist id="scholarship-verification-options">
              {SCHOLARSHIP_VERIFICATION_STATUSES.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field
          id="scholarship-amount"
          label="Amount"
          hint="Text, not a number — a scheme's amount is often a range or a percentage of fees. Up to 255 characters."
        >
          <Input
            id="scholarship-amount"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="₹50,000 per year"
            maxLength={255}
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Who can apply" disabled={disabled}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="scholarship-eligibility" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
              Eligibility
            </label>
            <Textarea
              id="scholarship-eligibility"
              rows={4}
              value={values.eligibility}
              onChange={(v) => set("eligibility", v)}
              placeholder="Class 12 pass with 80% or above."
            />
          </div>
          <div>
            <label htmlFor="scholarship-income" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
              Income criteria
            </label>
            <Textarea
              id="scholarship-income"
              rows={4}
              value={values.income_criteria}
              onChange={(v) => set("income_criteria", v)}
              placeholder="Family income below ₹8,00,000 per year."
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="scholarship-course" label="Course" hint="Free text, up to 255 characters.">
            <Input
              id="scholarship-course"
              value={values.course}
              onChange={(e) => set("course", e.target.value)}
              placeholder="Undergraduate"
              maxLength={255}
            />
          </Field>
          <Field id="scholarship-category" label="Category" hint="Free text, up to 100 characters.">
            <Input
              id="scholarship-category"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Merit"
              maxLength={100}
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet legend="Application" disabled={disabled}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="scholarship-deadline" label="Application deadline">
            <Input
              id="scholarship-deadline"
              type="date"
              value={values.application_deadline}
              onChange={(e) => set("application_deadline", e.target.value)}
            />
          </Field>
          <Field id="scholarship-website" label="Official website">
            <Input
              id="scholarship-website"
              type="url"
              value={values.official_website}
              onChange={(e) => set("official_website", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>
        <div>
          <label htmlFor="scholarship-procedure" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Application procedure
          </label>
          <Textarea
            id="scholarship-procedure"
            rows={3}
            value={values.application_procedure}
            onChange={(v) => set("application_procedure", v)}
            placeholder="Apply on the portal, then submit the documents at the institution."
          />
        </div>
      </FieldSet>

      <FieldSet
        legend="Verification"
        disabled={disabled}
        note="Documents required is a list column and is not editable from this form; Status cannot be switched off here, because a deactivated scheme disappears from this list with no way back through the UI."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="scholarship-last-verified" label="Last verified date">
            <Input
              id="scholarship-last-verified"
              type="date"
              value={values.last_verified_date}
              onChange={(e) => set("last_verified_date", e.target.value)}
            />
          </Field>
          <Field
            id="scholarship-next-verification"
            label="Next verification date"
            hint="Must be after the last verified date."
          >
            <Input
              id="scholarship-next-verification"
              type="date"
              value={values.next_verification_date}
              onChange={(e) => set("next_verification_date", e.target.value)}
            />
          </Field>
        </div>
      </FieldSet>
    </div>
  );
}
