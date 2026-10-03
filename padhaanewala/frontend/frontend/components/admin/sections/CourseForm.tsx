"use client";

import { Input } from "@/components/ui/FormField";
import { Field, FieldSet, Textarea } from "@/components/admin/fields";
import {
  COURSE_CATEGORY_MAX,
  COURSE_DEGREE_MAX,
  COURSE_DURATION_MAX,
  COURSE_NAME_MAX,
  COURSE_NAME_MIN,
  type CourseFormValues,
} from "@/lib/course-form";

/**
 * The field set for creating and editing a course.
 *
 * One component for both modes because `CourseCreate` and `CourseUpdate` declare
 * exactly the same keys — see `lib/course-form.ts`, which is where that is
 * asserted rather than assumed.
 *
 * ## There is deliberately no Status control
 *
 * `is_active` exists on both schemas, so a toggle here would type-check, post
 * successfully and remove the course from every listing — `list_courses` and
 * `get_course` both filter `where(Course.is_active)` — with no route back, since
 * the row becomes unfetchable. It is omitted from both modes; creating a course
 * inactive produces a record that has never existed as far as any screen is
 * concerned.
 */
export function CourseFormFields({
  values,
  onChange,
  disabled,
}: {
  values: CourseFormValues;
  onChange: (next: CourseFormValues) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-6">
      <FieldSet legend="Identity" disabled={disabled}>
        <Field
          id="course-name"
          label="Name"
          hint={`Shown in listings and used to build the public URL. ${COURSE_NAME_MIN}–${COURSE_NAME_MAX} characters.`}
        >
          <Input
            id="course-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="B.Tech in Computer Science"
            required
            aria-required="true"
            maxLength={COURSE_NAME_MAX}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="course-degree" label="Level" hint={`For example Undergraduate. Up to ${COURSE_DEGREE_MAX} characters.`}>
            <Input
              id="course-degree"
              value={values.degree}
              onChange={(e) => set("degree", e.target.value)}
              placeholder="Undergraduate"
              maxLength={COURSE_DEGREE_MAX}
            />
          </Field>
          <Field id="course-duration" label="Duration" hint={`For example 4 years. Up to ${COURSE_DURATION_MAX} characters.`}>
            <Input
              id="course-duration"
              value={values.duration}
              onChange={(e) => set("duration", e.target.value)}
              placeholder="4 years"
              maxLength={COURSE_DURATION_MAX}
            />
          </Field>
          <Field id="course-category" label="Category" hint={`For example Engineering. Up to ${COURSE_CATEGORY_MAX} characters.`}>
            <Input
              id="course-category"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Engineering"
              maxLength={COURSE_CATEGORY_MAX}
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet
        legend="Details"
        disabled={disabled}
        note="These three are not on the course list row — they come from the course detail endpoint, so an edit loads them before it can be saved."
      >
        <div>
          <label htmlFor="course-overview" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Overview
          </label>
          <Textarea
            id="course-overview"
            rows={4}
            value={values.overview}
            onChange={(v) => set("overview", v)}
            placeholder="What the course covers and who it is for."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="course-eligibility" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
              Eligibility
            </label>
            <Textarea
              id="course-eligibility"
              rows={4}
              value={values.eligibility}
              onChange={(v) => set("eligibility", v)}
              placeholder="Entrance exam or qualification required."
            />
          </div>
          <div>
            <label htmlFor="course-career" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
              Career information
            </label>
            <Textarea
              id="course-career"
              rows={4}
              value={values.career_information}
              onChange={(v) => set("career_information", v)}
              placeholder="Typical roles and sectors after the course."
            />
          </div>
        </div>
      </FieldSet>
    </div>
  );
}
