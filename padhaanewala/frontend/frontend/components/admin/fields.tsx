"use client";

/**
 * Field chrome shared by every admin form dialog.
 *
 * These three exist as a module rather than being copied into each of the six
 * form components because the copying is what made them drift: five identical
 * `Field` wrappers with three different hint styles and a `Textarea` that three
 * forms styled `className` and two re-declared. The `TEXTAREA` class string was
 * duplicated verbatim four times, so a change to the input's focus ring had four
 * places to be missed.
 *
 * A field that has no label is not rendered here — every one of these is
 * uncontrolled-free and wired to a controlled string, so the `id` passed here is
 * the same `id` on the input and the `htmlFor` on the label.
 */

import { Label } from "@/components/ui/FormField";

/**
 * The long-text input.
 *
 * `Input` in `ui/FormField.tsx` is fixed at `h-10`, which is correct for a
 * single-line field and wrong for a paragraph. Every form in this directory that
 * needs more than one line needs this instead, and sharing the class string is
 * the point of the module.
 */
export const TEXTAREA_CLASS =
  "w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none";

export function Textarea({
  id,
  rows = 4,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={TEXTAREA_CLASS}
    />
  );
}

/**
 * A labelled control, with an optional hint.
 *
 * The hint is not decoration. Several of the omissions and asymmetries the
 * catalogue forms encode are ones an admin would otherwise read as a bug in the
 * form — "why is there no Status toggle", "why can't I change which college this
 * FAQ belongs to" — and the hint line is where that gets said in the place the
 * admin is already looking.
 */
export function Field({
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

/**
 * The "nothing chosen" option for a select.
 *
 * Every optional foreign key in these forms is nullable, and the payload builder
 * turns an empty string into `null` — so the empty option has to be a real
 * selectable value rather than a disabled placeholder, or there is no way to
 * clear a field that already holds something.
 */
export function NoneOption({ label }: { label: string }) {
  return <option value="">{label}</option>;
}

/**
 * A section wrapper for a group of fields.
 *
 * `disabled` is on the `fieldset` rather than on each control so a submit in
 * flight locks the whole form — including every later fieldset — without each
 * form having to thread a prop into fifteen inputs.
 */
export function FieldSet({
  legend,
  children,
  disabled,
  note,
}: {
  legend: string;
  children: React.ReactNode;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{legend}</legend>
      {note && <p className="text-xs text-slate-500">{note}</p>}
      {children}
    </fieldset>
  );
}
