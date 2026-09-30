"use client";

import { Input } from "@/components/ui/FormField";
import { Field, FieldSet, Textarea } from "@/components/admin/fields";
import { EXAM_TYPE_MAX, type ExamFormValues } from "@/lib/exam-form";

/**
 * The field set for creating and editing an exam.
 *
 * ## `syllabus` and `faqs` are not here
 *
 * `ExamCreate` declares them as `syllabus: dict | None` and `faqs: list | None` —
 * JSON columns, not text. A textarea bound to them would post a *string* and take
 * a 422 on a field the admin was not looking at, which reads as a backend fault.
 * They need a structured editor, so this form does not pretend to offer one: an
 * edit leaves both columns exactly as the server holds them, because the payload
 * omits them.
 *
 * ## `is_active` is not here either
 *
 * `list_exams` and `get_exam` both filter `where(Exam.is_active)`, so switching a
 * row off removes it from the table and makes it unopenable for editing — while
 * it stays deletable by id, through a path no screen exposes. A one-way door with
 * a hidden back door is worse than no control.
 *
 * ## The dates are five `date` columns, checked component-wise
 *
 * A date input produces a well-formed `YYYY-MM-DD`, but `new Date("2026-02-31")`
 * is not invalid — JavaScript rolls it to 2 March — so a paste can store the
 * wrong day silently. `optionalDate` in `lib/form-parts.ts` parses the parts.
 * The deadline-after-exam-date check is in the payload builder, because both
 * columns are independent in the schema and nothing on the page puts them side by
 * side.
 */
export function ExamFormFields({
  values,
  onChange,
  disabled,
}: {
  values: ExamFormValues;
  onChange: (next: ExamFormValues) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof ExamFormValues>(key: K, value: ExamFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-6">
      <FieldSet legend="Exam" disabled={disabled}>
        <Field
          id="exam-name"
          label="Name"
          hint="Shown in listings and used to build the public URL. 2–255 characters."
        >
          <Input
            id="exam-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Joint Entrance Examination Main"
            required
            aria-required="true"
            maxLength={255}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="exam-authority"
            label="Conducting authority"
            hint="The body that runs the exam. 2–255 characters."
          >
            <Input
              id="exam-authority"
              value={values.conducting_authority}
              onChange={(e) => set("conducting_authority", e.target.value)}
              placeholder="National Testing Agency"
              required
              aria-required="true"
              maxLength={255}
            />
          </Field>
          <Field
            id="exam-type"
            label="Exam type"
            hint={`For example national, state, university. Defaults to national. Up to ${EXAM_TYPE_MAX} characters.`}
          >
            <Input
              id="exam-type"
              value={values.exam_type}
              onChange={(e) => set("exam_type", e.target.value)}
              placeholder="national"
              maxLength={EXAM_TYPE_MAX}
            />
          </Field>
        </div>
        <div>
          <label htmlFor="exam-eligibility" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Eligibility
          </label>
          <Textarea
            id="exam-eligibility"
            rows={3}
            value={values.eligibility}
            onChange={(v) => set("eligibility", v)}
            placeholder="Passed or appearing for Class 12 with the required subject combination."
          />
        </div>
      </FieldSet>

      <FieldSet
        legend="Dates"
        disabled={disabled}
        note="The application deadline cannot be after the exam date — the form checks this on save, because the two are independent columns and nothing on this page puts them side by side."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="exam-app-start" label="Applications open">
            <Input
              id="exam-app-start"
              type="date"
              value={values.application_start_date}
              onChange={(e) => set("application_start_date", e.target.value)}
            />
          </Field>
          <Field id="exam-app-deadline" label="Applications close">
            <Input
              id="exam-app-deadline"
              type="date"
              value={values.application_deadline}
              onChange={(e) => set("application_deadline", e.target.value)}
            />
          </Field>
          <Field id="exam-date" label="Exam date">
            <Input
              id="exam-date"
              type="date"
              value={values.exam_date}
              onChange={(e) => set("exam_date", e.target.value)}
            />
          </Field>
          <Field id="exam-admit-card" label="Admit card date">
            <Input
              id="exam-admit-card"
              type="date"
              value={values.admit_card_date}
              onChange={(e) => set("admit_card_date", e.target.value)}
            />
          </Field>
          <Field id="exam-result" label="Result date">
            <Input
              id="exam-result"
              type="date"
              value={values.result_date}
              onChange={(e) => set("result_date", e.target.value)}
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet
        legend="Official links"
        disabled={disabled}
        note="Syllabus and FAQs are JSON columns on this record and are not editable from this form. An edit leaves them untouched."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="exam-website" label="Official website">
            <Input
              id="exam-website"
              type="url"
              value={values.official_website}
              onChange={(e) => set("official_website", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field id="exam-notification" label="Official notification" hint="A link to the notification document.">
            <Input
              id="exam-notification"
              value={values.official_notification}
              onChange={(e) => set("official_notification", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>
      </FieldSet>
    </div>
  );
}
