import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Request-shape contract between the TypeScript client and the Pydantic models.
 *
 * ## What went wrong, and why this file exists
 *
 * Commit `f765369` (Phase 9.1) added `age_band` to `RegisterRequest` and to
 * `EnquiryCreate` with **no default**, and did not touch the frontend. The
 * consequences were two completely broken forms:
 *
 * - every signup from the UI answered **422**
 * - every admission enquiry answered **422**
 *
 * Type checking passed. Lint passed. A full production build passed. The whole
 * backend suite passed. Nothing noticed, because a property the client omits is
 * not a type error when the type is the thing that is wrong — `RegisterPayload`
 * simply did not mention `age_band`, so TypeScript had nothing to complain
 * about and Pydantic was never asked.
 *
 * The page-size suite already demonstrated the fix for this class of bug: read
 * the backend's own source and hold the frontend against it. This does the same
 * for required request fields.
 *
 * ## What it can and cannot catch
 *
 * It catches *omission* — a required server field the client type does not
 * declare. It cannot catch a field declared but never sent (the type system
 * covers that) nor a mismatched value domain (that needs the server tests).
 */

const SCHEMAS = resolve(import.meta.dirname, "../../backend/app/schemas");

function readSchema(file: string): string {
  return readFileSync(resolve(SCHEMAS, file), "utf8");
}

/**
 * Drop docstrings and `#` comments, in that order.
 *
 * Docstrings first: they routinely contain `#` and colons, and stripping them
 * last would leave their prose behind as parseable text — which is how a
 * sentence in a class docstring gets read as a required field.
 */
function stripComments(source: string): string {
  return source
    .replace(/"""[\s\S]*?"""/g, "")
    .replace(/'''[\s\S]*?'''/g, "")
    .replace(/#[^\n]*/g, "");
}

/**
 * Pull one `class X(BaseModel):` body out of a schema module.
 *
 * Body lines are indented four spaces; a class ends at the next line with
 * indentation <= 4 that is not blank.
 */
function classBody(source: string, className: string): string {
  const clean = stripComments(source);
  const start = clean.indexOf(`class ${className}(`);
  if (start === -1) throw new Error(`class ${className} not found`);

  const rest = clean.slice(start);
  const lines = rest.split("\n").slice(1);

  const body: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      body.push(line);
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= 4 && body.length > 0 && !/^\s/.test(line)) break;
    body.push(line);
  }
  return body.join("\n");
}

/**
 * Join a field whose `Field(...)` continues onto later lines.
 *
 * Without this a multi-line annotation would be read as a single short line and
 * its default silently dropped, turning a required field into an optional one —
 * which is the failure mode this whole test is here to prevent.
 */
function joinContinuations(body: string): string[] {
  const out: string[] = [];
  let pending = "";
  let depth = 0;

  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    const candidate = pending ? `${pending} ${line}` : line;
    depth += (candidate.match(/\(/g) ?? []).length - (candidate.match(/\)/g) ?? []).length;

    if (depth > 0) {
      pending = candidate;
      continue;
    }
    out.push(candidate);
    pending = "";
  }
  if (pending) out.push(pending);
  return out;
}

/** A default that means "this field is not required". */
const OPTIONAL_DEFAULT =
  /^(None\b|True\b|False\b|-?\d|"|'|\[|\{)/;

function requiredFields(body: string): string[] {
  const required: string[] = [];
  for (const line of joinContinuations(body)) {
    const m = /^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/.exec(line);
    if (!m) continue;
    const [, name, , defaultValue] = m;
    if (defaultValue === undefined) {
      required.push(name);
      continue;
    }
    // `Field(default=None, …)` is optional; `Field(...)` and `Field(min_length=2)`
    // are both required — Pydantic only makes a field optional when it is given
    // an actual default value.
    const hasDefault =
      OPTIONAL_DEFAULT.test(defaultValue.trim()) || /\bdefault\s*=/.test(defaultValue);
    if (!hasDefault) required.push(name);
  }
  return required;
}

/** Property names declared in a TS interface, split by optionality. */
function interfaceProps(source: string, name: string): {
  required: string[];
  optional: string[];
} {
  const start = source.indexOf(`interface ${name} {`);
  if (start === -1) throw new Error(`interface ${name} not found`);

  const end = source.indexOf("\n}", start);
  if (end === -1) throw new Error(`interface ${name} is not terminated`);

  const body = source.slice(start, end);
  const required: string[] = [];
  const optional: string[] = [];

  for (const raw of body.split("\n")) {
    const line = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "").trim();
    const m = /^(\w+)(\??)\s*:/.exec(line);
    if (!m) continue;
    (m[2] === "?" ? optional : required).push(m[1]);
  }
  return { required, optional };
}

const registerRequest = requiredFields(classBody(readSchema("auth.py"), "RegisterRequest"));
const enquiryCreate = requiredFields(classBody(readSchema("catalog.py"), "EnquiryCreate"));
const apiSource = readFileSync(resolve(import.meta.dirname, "../lib/api.ts"), "utf8");

const registerPayload = interfaceProps(apiSource, "RegisterPayload");
const enquiryPayload = interfaceProps(apiSource, "EnquiryPayload");

describe("backend schema parsing", () => {
  it("can read the backend schemas at all, so the checks below are not vacuous", () => {
    // A moved directory or a rename would otherwise make every list empty and
    // every subset assertion pass on nothing.
    expect(registerRequest.length).toBeGreaterThanOrEqual(4);
    expect(enquiryCreate.length).toBeGreaterThanOrEqual(3);
  });

  it("finds the frontend interfaces it is checking", () => {
    expect(registerPayload.required.length).toBeGreaterThanOrEqual(4);
    expect(enquiryPayload.required.length).toBeGreaterThanOrEqual(2);
  });

  it("recovers the fields this test was written for", () => {
    // Guards the parser itself: if `classBody` or `joinContinuations` stopped
    // matching, these are the names that would go missing first.
    expect(registerRequest).toContain("age_band");
    expect(enquiryCreate).toContain("age_band");
    expect(registerPayload.required).toContain("age_band");
    expect(enquiryPayload.required).toContain("age_band");
  });

  it("reads optional server fields as optional", () => {
    // The complement of the check above: a bug that marked *everything*
    // required would still satisfy a subset assertion.
    expect(registerPayload.optional).not.toContain("age_band");
    expect(enquiryCreate).not.toContain("ip_address");
  });
});

describe("RegisterPayload against RegisterRequest", () => {
  it("declares every field the server requires", () => {
    const missing = registerRequest.filter(
      (field) =>
        !registerPayload.required.includes(field) && !registerPayload.optional.includes(field),
    );
    expect(
      missing,
      "signup will 422: the server requires these and the client type does not mention them",
    ).toEqual([]);
  });

  it("declares no required server field as optional", () => {
    // Optional in the client means "may be omitted", and omitting a required
    // field is a 422 — so a field the server demands must not have a `?`.
    const weakened = registerRequest.filter((field) => registerPayload.optional.includes(field));
    expect(
      weakened,
      "these are required on the server but optional in the client, so the form can omit them",
    ).toEqual([]);
  });

  it("specifically pins age_band as required", () => {
    // The Phase 9.1 regression, in one assertion.
    expect(registerPayload.required).toContain("age_band");
    expect(registerRequest).toContain("age_band");
  });
});

describe("EnquiryPayload against EnquiryCreate", () => {
  it("declares every field the server requires", () => {
    const missing = enquiryCreate.filter(
      (field) =>
        !enquiryPayload.required.includes(field) && !enquiryPayload.optional.includes(field),
    );
    expect(
      missing,
      "the admission form will 422: the server requires these and the client type does not mention them",
    ).toEqual([]);
  });

  it("declares no required server field as optional", () => {
    const weakened = enquiryCreate.filter((field) => enquiryPayload.optional.includes(field));
    expect(weakened).toEqual([]);
  });

  it("carries guardian_contact, which a minor's enquiry cannot omit", () => {
    // Conditionally required — `EnquiryCreate.require_guardian_for_minors`
    // refuses the request without it when `age_band` is `under_18`. It must
    // exist in the type at all, even though it is optional for an adult.
    expect(
      enquiryPayload.required.includes("guardian_contact") ||
        enquiryPayload.optional.includes("guardian_contact"),
      "guardian_contact is missing from EnquiryPayload, so a minor's enquiry is unauthorisable",
    ).toBe(true);
  });
});
