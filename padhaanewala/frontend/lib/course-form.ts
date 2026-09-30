import {
  optionalText,
  requiredText,
  rowRefFor,
  type FormResult,
} from "@/lib/form-parts";

/**
 * The course admin form.
 *
 * ## The one thing that is not a rendering decision
 *
 * `is_active` is **deliberately absent**, and it is absent from both modes.
 *
 * `CourseCreate` and `CourseUpdate` both declare it, so a form that offered it
 * would type-check, build, and post successfully. It would also be a one-way
 * door: `list_courses` filters `where(Course.is_active)`, and so does
 * `get_course` and `_find_course`. So the row leaves the table, cannot be
 * reopened for editing, and cannot be fetched to be deleted either — the only way
 * back is a `PUT` against an id nobody can see.
 *
 * This is the same trap as `is_active` on `CollegeUpdate`, documented in
 * `lib/college-form.ts`, and it is why the create form does not offer it either:
 * creating a course inactive produces a record that has never existed as far as
 * any screen is concerned.
 *
 * ## Why the edit form is prefilled from a second request
 *
 * `CourseResponse` (the list row) carries `id, name, slug, degree, duration,
 * category` and **no** `overview`, `eligibility` or `career_information` — the
 * three long-text fields this form edits. `GET /courses/{ref}` returns
 * `CourseDetailResponse`, which adds them. Prefilling from the list row would
 * therefore render three empty boxes over a record that has content in it, and
 * saving would null all three.
 *
 * `CourseResponse` also has no `is_active` at all, which is why the old table
 * rendered every course as "Inactive": the column read a field the response does
 * not carry, so it was always falsy. The column is gone rather than left to lie.
 */
export interface CourseFormValues {
  name: string;
  degree: string;
  duration: string;
  category: string;
  overview: string;
  eligibility: string;
  career_information: string;
}

export const EMPTY_COURSE_FORM: CourseFormValues = {
  name: "",
  degree: "",
  duration: "",
  category: "",
  overview: "",
  eligibility: "",
  career_information: "",
};

export const COURSE_NAME_MIN = 2;
export const COURSE_NAME_MAX = 255;
/** `Field(max_length=…)` on `CourseCreate`. */
export const COURSE_DEGREE_MAX = 100;
export const COURSE_DURATION_MAX = 50;
export const COURSE_CATEGORY_MAX = 100;

/** The subset of `CourseDetailResponse` this form reads. */
export interface CourseDetail {
  id: number;
  name: string;
  degree: string | null;
  duration: string | null;
  category: string | null;
  overview: string | null;
  eligibility: string | null;
  career_information: string | null;
}

function asString(value: string | null | undefined): string {
  return value ?? "";
}

/** Prefill the edit form from the record the server actually holds. */
export function courseFormFromDetail(detail: CourseDetail): CourseFormValues {
  return {
    name: detail.name,
    degree: asString(detail.degree),
    duration: asString(detail.duration),
    category: asString(detail.category),
    overview: asString(detail.overview),
    eligibility: asString(detail.eligibility),
    career_information: asString(detail.career_information),
  };
}

/** The `PUT`/`DELETE` key. See `rowRefFor` — slugs are derived from the name. */
export function courseRefFor(row: { id: number }): string {
  return rowRefFor(row);
}

export type CoursePayload = Record<string, unknown>;

/**
 * Build the body for `POST /courses` or `PUT /courses/{ref}`.
 *
 * `mode` is accepted and deliberately does not change the field set: unlike
 * colleges, `CourseCreate` and `CourseUpdate` declare exactly the same keys. The
 * parameter stays so a future divergence is a one-line change in a place the
 * tests already reach, rather than a silent behavioural difference between two
 * call sites that look interchangeable.
 */
export function buildCoursePayload(
  values: CourseFormValues,
  mode: "create" | "update",
): FormResult<CoursePayload> {
  void mode;

  const name = requiredText(values.name, "The course name", {
    min: COURSE_NAME_MIN,
    max: COURSE_NAME_MAX,
  });
  if (!name.ok) return name;

  const degree = optionalText(values.degree, "Level", COURSE_DEGREE_MAX);
  if (!degree.ok) return degree;

  const duration = optionalText(values.duration, "Duration", COURSE_DURATION_MAX);
  if (!duration.ok) return duration;

  const category = optionalText(values.category, "Category", COURSE_CATEGORY_MAX);
  if (!category.ok) return category;

  const overview = optionalText(values.overview, "Overview");
  if (!overview.ok) return overview;

  const eligibility = optionalText(values.eligibility, "Eligibility");
  if (!eligibility.ok) return eligibility;

  const career = optionalText(values.career_information, "Career information");
  if (!career.ok) return career;

  return {
    ok: true,
    value: {
      name: name.value,
      degree: degree.value,
      duration: duration.value,
      category: category.value,
      overview: overview.value,
      eligibility: eligibility.value,
      career_information: career.value,
      // `is_active` omitted on purpose — see the note at the top of this file.
    },
  };
}
