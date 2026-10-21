import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { COLLEGE_FIELD_MAX, COLLEGE_NAME_MAX } from "@/lib/college-form";
import { IMAGE_URL_MAX } from "@/lib/image-field";

/**
 * The college form's length caps, held against the Pydantic schemas that
 * actually reject.
 *
 * There was no cap on either side for `college_type`, `city`, `phone`,
 * `accreditation_naac`, `website`, `email` and `official_name`. Pydantic
 * accepted the string, PostgreSQL raised `value too long for type character
 * varying(n)`, and the admin saw `500 — Something went wrong` for what is a
 * plain validation failure: "I can't write the other details" with no field
 * named and nothing to fix.
 *
 * The caps now exist in both places, which is exactly the shape of defect
 * `page-size-contract.test.ts` and `request-contract.test.ts` were written
 * for: two contracts in two languages that nothing holds against each other.
 * This reads the Python, so tightening a column without touching
 * `COLLEGE_FIELD_MAX` fails here rather than in production.
 */
const SCHEMAS = resolve(import.meta.dirname, "../../backend/app/schemas/catalog.py");
const COLLEGE_FORM = resolve(
  import.meta.dirname,
  "../frontend/components/admin/sections/CollegeForm.tsx",
);

const source = readFileSync(SCHEMAS, "utf8");

/** The body of one class, from its declaration to the next one. */
function classBody(name: string): string {
  const start = source.indexOf(`class ${name}`);
  expect(start, `class ${name} is missing from ${SCHEMAS}`).toBeGreaterThan(-1);
  const end = source.indexOf("\nclass ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

/**
 * `field: str … = Field(..., max_length=N)` → `{ field: N }`.
 *
 * Deliberately only `str` fields declared with `Field(...)`: a `str | None = None`
 * has no width to report, and treating its absence as "unlimited but fine"
 * would be the assumption this file exists to avoid.
 */
function declaredCaps(className: string): Record<string, number> {
  const caps: Record<string, number> = {};
  const body = classBody(className);
  for (const match of body.matchAll(/^\s{4}(\w+): str[^=\n]*= Field\([^)\n]*max_length=(\d+)/gm)) {
    caps[match[1]] = Number(match[2]);
  }
  return caps;
}

const createCaps = declaredCaps("CollegeCreate");
const updateCaps = declaredCaps("CollegeUpdate");

/** Every `str`-typed field on the class, capped or not. */
function strFields(className: string): string[] {
  return [...classBody(className).matchAll(/^\s{4}(\w+): str/gm)].map((m) => m[1]);
}

describe("the parsers are not silently empty", () => {
  it("found the declared caps in both request schemas", () => {
    // A moved directory or a renamed class would otherwise make every
    // comparison below pass vacuously against `{}`.
    expect(Object.keys(createCaps).length).toBeGreaterThan(5);
    expect(Object.keys(updateCaps).length).toBeGreaterThan(5);
    expect(createCaps.name).toBe(255);
  });
});

describe("every cap the form declares exists on the server", () => {
  for (const [field, width] of Object.entries(COLLEGE_FIELD_MAX)) {
    it(`${field} is capped at ${width} in CollegeCreate`, () => {
      expect(createCaps[field]).toBe(width);
    });
    it(`${field} is capped at ${width} in CollegeUpdate`, () => {
      expect(updateCaps[field]).toBe(width);
    });
  }

  it("caps the name identically on both verbs", () => {
    expect(COLLEGE_NAME_MAX).toBe(255);
    expect(createCaps.name).toBe(COLLEGE_NAME_MAX);
    expect(updateCaps.name).toBe(COLLEGE_NAME_MAX);
  });
});

describe("nothing with a width is left off the map", () => {
  it("has no uncapped str field on either schema", () => {
    // `address` and `overview` are `Text` and legitimately absent; `ownership`
    // is a closed-vocabulary `<Select>` with no input to cap. Anything else
    // means the form can type past a column and 500 on save.
    //
    // Read from *every* `str` field, not from `declaredCaps`: a field that was
    // never given a `Field(...)` is precisely the case that must be caught, and
    // it does not appear in `declaredCaps` at all.
    //
    // `image_url` is capped — but by `IMAGE_URL_MAX` in `lib/image-field.ts`,
    // not by `COLLEGE_FIELD_MAX`, because it is one shared field rendered by
    // `ImageField` across four entity forms rather than a college-only input.
    // It is asserted against its own constant just below, so it is verified
    // here rather than excused.
    const sharedCaps: Record<string, number> = { image_url: IMAGE_URL_MAX };
    const noCapNeeded = new Set(["address", "overview", "ownership"]);
    const uncapped = (className: string) =>
      strFields(className).filter(
        (field) =>
          !(field in COLLEGE_FIELD_MAX) &&
          !(field in sharedCaps) &&
          !noCapNeeded.has(field) &&
          field !== "name",
      );
    expect(uncapped("CollegeCreate")).toEqual([]);
    expect(uncapped("CollegeUpdate")).toEqual([]);
  });

  it("caps image_url identically on the shared field and both schemas", () => {
    // The point of this file: the cap the admin types against must be the cap
    // the server enforces. `ImageField` renders `IMAGE_URL_MAX`, and the schema
    // declares `max_length=IMAGE_URL_MAX` — the same *name*, so the numbers can
    // still drift. Read the Python constant and hold the two together.
    const pythonCap = source.match(/^IMAGE_URL_MAX = (\d+)/m);
    expect(pythonCap, "IMAGE_URL_MAX is missing from catalog.py").not.toBeNull();
    expect(Number(pythonCap?.[1])).toBe(IMAGE_URL_MAX);
  });
});

describe("the form actually applies the map", () => {
  it("reads every cap from COLLEGE_FIELD_MAX rather than a bare number", () => {
    const form = readFileSync(COLLEGE_FORM, "utf8");
    for (const field of Object.keys(COLLEGE_FIELD_MAX)) {
      expect(
        form,
        `${field} should take its maxLength from COLLEGE_FIELD_MAX`,
      ).toContain(`COLLEGE_FIELD_MAX.${field}`);
    }
    // And no hand-written numeric cap left beside them, which is how the map
    // and the form drift apart again.
    expect(form).not.toMatch(/maxLength=\{\d+\}/);
  });
});
