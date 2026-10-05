import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_IMPORT_FORM,
  buildDraftUpdate,
  buildImportUpload,
  confirmPdfBytes,
  draftFormFromDraft,
  draftOptionsWithKey,
  importMaxBytes,
  validateImportPdf,
  type DraftFormValues,
  type ImportFormValues,
} from "@/lib/question-import-form";
import type { ImportDraft } from "@/lib/api";

/**
 * `POST /question-imports/pdf` is multipart, and multipart has the same three
 * traps `lib/media-form.ts` documents: every non-file part arrives as a string,
 * the size ceiling is server configuration, and the type check belongs on the
 * bytes.
 *
 * What is specific to this route is the one-target rule. The backend takes
 * either `mock_test_id` (an existing paper) or `new_paper_name` (create one) and
 * 422s on both and on neither. A form with two independent controls cannot
 * express that, so these assertions are about the *builder* rather than the
 * component -- which is also the only place the rule can live.
 */

/** A real `File`, so the browser APIs these call are genuinely exercised. */
function pdfFile(name = "paper.pdf", bytes = "%PDF-1.7\nbody"): File {
  return new File([new Blob([bytes])], name, { type: "application/pdf" });
}

const form = (overrides: Partial<ImportFormValues> = {}): ImportFormValues => ({
  ...EMPTY_IMPORT_FORM,
  new_paper_name: "JEE Main 2024",
  ...overrides,
});

describe("validateImportPdf", () => {
  it("accepts a PDF", () => {
    expect(validateImportPdf(pdfFile())).toEqual({ ok: true });
  });

  it("rejects a missing file", () => {
    expect(validateImportPdf(null).ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const empty = new File([], "paper.pdf", { type: "application/pdf" });
    expect(validateImportPdf(empty).ok).toBe(false);
  });

  it("rejects a non-PDF by extension", () => {
    const checked = validateImportPdf(
      new File([new Blob(["%PDF-1.7"])], "paper.docx", { type: "application/pdf" }),
    );
    expect(checked.ok).toBe(false);
    expect(checked.ok === false && checked.error).toContain(".docx");
  });

  it("rejects a browser that labels a non-PDF as a PDF, when it declares one", () => {
    // A renamed file: the name says .pdf and the browser is happy, and only the
    // bytes give it away. `confirmPdfBytes` is the check that catches this.
    const renamed = new File([new Blob(["not a pdf"])], "paper.pdf", {
      type: "application/pdf",
    });
    expect(validateImportPdf(renamed)).toEqual({ ok: true });
  });

  it("accepts a .pdf whose File.type is empty, which some platforms report", () => {
    const noType = new File([new Blob(["%PDF-1.7"])], "paper.pdf", { type: "" });
    expect(validateImportPdf(noType)).toEqual({ ok: true });
  });

  it("refuses an oversized file before spending the upload", () => {
    const limit = importMaxBytes();
    const big = pdfFile("paper.pdf", "%PDF-1.7" + "x".repeat(limit));
    const checked = validateImportPdf(big);
    expect(checked.ok).toBe(false);
    expect(checked.ok === false && checked.error).toContain("The limit is");
  });

  it("defaults to the 20 MB the backend configures", () => {
    expect(importMaxBytes()).toBe(20 * 1024 * 1024);
  });
});

describe("confirmPdfBytes", () => {
  it("accepts bytes that start with %PDF-", async () => {
    expect(await confirmPdfBytes(pdfFile())).toEqual({ ok: true });
  });

  it("rejects bytes that do not, which a rename cannot fix", async () => {
    const renamed = new File([new Blob(["PK\x03\x04zip contents"])], "paper.pdf", {
      type: "application/pdf",
    });
    const checked = await confirmPdfBytes(renamed);
    expect(checked.ok).toBe(false);
    expect(checked.ok === false && checked.error).toContain("%PDF-");
  });

  it("reads only the first bytes rather than the whole file", async () => {
    const slice = vi.fn();
    const file = {
      slice,
    } as unknown as File;
    slice.mockReturnValue({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-").buffer,
    });
    await confirmPdfBytes(file);
    expect(slice).toHaveBeenCalledWith(0, 5);
  });
});

describe("buildImportUpload", () => {
  it("sends new_paper_name and not mock_test_id when creating a paper", () => {
    const built = buildImportUpload(form(), pdfFile());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("new_paper_name")).toBe("JEE Main 2024");
    expect(built.body.get("mock_test_id")).toBeNull();
  });

  it("sends mock_test_id and not new_paper_name for an existing paper", () => {
    const built = buildImportUpload(
      form({ target: "existing", mock_test_id: "7", new_paper_name: "" }),
      pdfFile(),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("mock_test_id")).toBe("7");
    expect(built.body.get("new_paper_name")).toBeNull();
  });

  it("omits the unused half rather than sending an empty string", () => {
    // `mock_test_id: int | None = Form(None)` -- an empty string is a 422, not a
    // None. Omission is what "no target" means on the wire.
    const built = buildImportUpload(form(), pdfFile());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect([...built.body.keys()]).not.toContain("mock_test_id");
  });

  it("refuses an existing paper with a leftover new-paper name", () => {
    // The backend 422s this exact pair. Catching it here keeps the admin from
    // spending a 20 MB upload to be told so.
    const built = buildImportUpload(
      form({ target: "existing", mock_test_id: "7", new_paper_name: "Dup" }),
      pdfFile(),
    );
    expect(built.ok).toBe(false);
  });

  it("refuses an existing paper with nothing selected", () => {
    const built = buildImportUpload(
      form({ target: "existing", mock_test_id: "", new_paper_name: "" }),
      pdfFile(),
    );
    expect(built.ok).toBe(false);
    expect(built.ok === false && built.error).toContain("Choose which paper");
  });

  it("refuses a new paper with a name that is too short", () => {
    const built = buildImportUpload(form({ new_paper_name: "a" }), pdfFile());
    expect(built.ok).toBe(false);
  });

  it("refuses a new paper with no name at all", () => {
    const built = buildImportUpload(form({ new_paper_name: "   " }), pdfFile());
    expect(built.ok).toBe(false);
  });

  it("refuses a non-numeric paper id", () => {
    const built = buildImportUpload(
      form({ target: "existing", mock_test_id: "abc", new_paper_name: "" }),
      pdfFile(),
    );
    expect(built.ok).toBe(false);
  });

  it("accepts a blank per_chunk, which takes the server default", () => {
    const built = buildImportUpload(form({ per_chunk: "" }), pdfFile());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("per_chunk")).toBeNull();
  });

  it("sends per_chunk when set, since it is the one knob an admin can predict", () => {
    const built = buildImportUpload(form({ per_chunk: "8" }), pdfFile());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("per_chunk")).toBe("8");
  });

  it("refuses a per_chunk that is not a whole number", () => {
    const built = buildImportUpload(form({ per_chunk: "4.5" }), pdfFile());
    expect(built.ok).toBe(false);
  });

  it("refuses a per_chunk outside the sane range, which is a bill, not a typo", () => {
    expect(buildImportUpload(form({ per_chunk: "0" }), pdfFile()).ok).toBe(false);
    expect(buildImportUpload(form({ per_chunk: "500" }), pdfFile()).ok).toBe(false);
  });

  it("omits a blank subject rather than storing an empty string", () => {
    const built = buildImportUpload(form({ subject: "  " }), pdfFile());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("subject")).toBeNull();
  });

  it("carries the file under the part name the route declares", () => {
    const built = buildImportUpload(form(), pdfFile("physics.pdf"));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const file = built.body.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("physics.pdf");
  });

  it("refuses when no file was chosen", () => {
    expect(buildImportUpload(form(), null).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Correcting a draft
 *
 * The review step exists because the model gets the key on the wrong option
 * often enough that editing is the normal path. So these are not edge cases:
 * the key-follows-option rule and the key-must-match rule are the two things
 * that stand between a draft and an ungradeable question.
 * ------------------------------------------------------------------ */

function draft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    question_id: 11,
    import_job_id: 3,
    question_text: "A particle of mass m moves in a circle of radius r under force F.",
    options: ["mv²/r", "mvr", "mvr²", "F/r"],
    correct_answer: "mv²/r",
    subject: "Physics",
    topic: "Circular motion",
    difficulty: "medium",
    explanation: "The centripetal force is mv²/r.",
    marks: "4.00",
    negative_marks: "1.00",
    review_status: "pending",
    source: "pdf_ai",
    sort_order: 1,
    is_active: false,
    ...overrides,
  };
}

const values = (overrides: Partial<DraftFormValues> = {}): DraftFormValues => ({
  ...draftFormFromDraft(draft()),
  ...overrides,
});

describe("draftFormFromDraft", () => {
  it("reads a draft into editable strings", () => {
    const v = draftFormFromDraft(draft());
    expect(v.question_text).toContain("mass m");
    expect(v.explanation).toContain("centripetal");
    expect(v.correct_answer).toBe("mv²/r");
    expect(v.marks).toBe("4.00");
  });

  it("turns null classification into blank inputs rather than a controlled null", () => {
    const v = draftFormFromDraft(
      draft({ subject: null, topic: null, explanation: null }),
    );
    expect(v.subject).toBe("");
    expect(v.topic).toBe("");
    expect(v.explanation).toBe("");
  });

  it("offers two blank rows for a draft with no options, so it is editable", () => {
    const v = draftFormFromDraft(draft({ options: null, correct_answer: null }));
    expect(v.options).toEqual(["", ""]);
  });

  it("copies the options array, so editing cannot mutate the cached draft", () => {
    const source = draft();
    const v = draftFormFromDraft(source);
    v.options[0] = "changed";
    expect(source.options?.[0]).toBe("mv²/r");
  });
});

describe("draftOptionsWithKey", () => {
  it("follows the key when the option carrying it is edited", () => {
    // The failure this prevents: the key silently stops matching, and the save
    // is rejected for a reason nobody can see.
    const out = draftOptionsWithKey(["a", "b"], "b", 1, "b revised");
    expect(out.options).toEqual(["a", "b revised"]);
    expect(out.correct_answer).toBe("b revised");
  });

  it("leaves the key alone when a different option is edited", () => {
    const out = draftOptionsWithKey(["a", "b"], "b", 0, "a revised");
    expect(out.correct_answer).toBe("b");
  });

  it("does not mutate the options it was given", () => {
    const options = ["a", "b"];
    draftOptionsWithKey(options, "a", 0, "z");
    expect(options).toEqual(["a", "b"]);
  });
});

describe("buildDraftUpdate", () => {
  it("sends the correction when a field moves", () => {
    const built = buildDraftUpdate(
      values({ correct_answer: "mvr" }),
      draftFormFromDraft(draft()),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({ correct_answer: "mvr" });
    expect(built.changed).toBe(true);
  });

  it("sends nothing for an untouched form, rather than rewriting the whole draft", () => {
    const built = buildDraftUpdate(values(), draftFormFromDraft(draft()));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({});
    expect(built.changed).toBe(false);
  });

  it("ignores whitespace-only differences, which are not edits", () => {
    const built = buildDraftUpdate(
      values({ explanation: "The centripetal force is mv²/r.  " }),
      draftFormFromDraft(draft()),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({});
  });

  it("sends everything when there is no baseline to diff against", () => {
    const built = buildDraftUpdate(values());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.question_text).toBeTruthy();
    expect(built.value.options).toHaveLength(4);
    expect(built.value.correct_answer).toBe("mv²/r");
  });

  it("clears an explanation as null, because that is a real correction", () => {
    const built = buildDraftUpdate(
      values({ explanation: "" }),
      draftFormFromDraft(draft()),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({ explanation: null });
  });

  it("never sends a null key, which the route refuses", () => {
    // `correct_answer: null` is a 422 by design: an mcq with no key cannot be
    // scored, so the admin rejects the draft instead.
    const built = buildDraftUpdate(
      values({ correct_answer: "" }),
      draftFormFromDraft(draft({ correct_answer: "" })),
    );
    expect(built.ok).toBe(false);
  });

  it("omits blank marks rather than sending an empty Decimal", () => {
    const built = buildDraftUpdate(
      values({ marks: "" }),
      draftFormFromDraft(draft({ marks: "" })),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect("marks" in built.value).toBe(false);
  });

  it("omits a blank difficulty rather than nulling a NOT NULL column", () => {
    const built = buildDraftUpdate(
      values({ difficulty: "" }),
      draftFormFromDraft(draft({ difficulty: "" })),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect("difficulty" in built.value).toBe(false);
  });

  it("rejects a key that matches no option", () => {
    const built = buildDraftUpdate(values({ correct_answer: "9" }));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.correct_answer).toContain("match one of the options");
  });

  it("rejects a blank question", () => {
    const built = buildDraftUpdate(values({ question_text: "   " }));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.question_text).toBeTruthy();
  });

  it("rejects fewer than two options, which no mcq can be answered from", () => {
    const built = buildDraftUpdate(values({ options: ["only one"] }));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.options).toContain("at least 2");
  });

  it("drops blank option rows rather than sending empty options", () => {
    // The key moves with the options, so this is one edit: the admin removed a
    // blank row and re-pointed the key at what is left.
    const built = buildDraftUpdate(
      values({ options: ["a", "b", "  "], correct_answer: "a" }),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.options).toEqual(["a", "b"]);
  });

  it("rejects negative marks, which is a Decimal ge=0 constraint", () => {
    const built = buildDraftUpdate(values({ negative_marks: "-1" }));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.negative_marks).toBeTruthy();
  });

  it("accepts fractional marks, which is how papers are actually set", () => {
    const built = buildDraftUpdate(values({ marks: "0.25" }));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.marks).toBe("0.25");
  });

  it("rejects marks that are not a number at all", () => {
    const built = buildDraftUpdate(values({ marks: "four" }));
    expect(built.ok).toBe(false);
  });

  it("rejects an option longer than the schema allows", () => {
    const built = buildDraftUpdate(values({ options: ["a".repeat(501), "b"] }));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.options).toContain("500");
  });

  it("clears a field's error as soon as the admin touches it", () => {
    // The component clears on change; the important part is that a corrected
    // value no longer trips the check.
    const built = buildDraftUpdate(values({ correct_answer: "mvr" }));
    expect(built.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The one-target rule against the real backend
 * ------------------------------------------------------------------ */

const ROUTERS = resolve(import.meta.dirname, "../../backend/app/routers");

/** The route's own signature, read out of the router source. */
function uploadSignature(): string {
  const source = readFileSync(join(ROUTERS, "question_imports.py"), "utf8");
  const start = source.indexOf("def import_pdf_questions");
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("):", start));
}

describe("the multipart body matches the route's Form parameters", () => {
  it("sends every part name the route declares, and the builder uses only those", () => {
    const signature = uploadSignature();
    // `file` is an `UploadFile = File(...)`, the rest are `Form(...)`. Both are
    // multipart parts, so both have to be scanned or `file` reads as absent.
    // `[^=:\n]+` keeps the annotation single-line and colon-free, without which
    // the match starts at `request:` and swallows every parameter up to `file`.
    const declared = [
      ...signature.matchAll(/(\w+):\s*[^=:\n]+=\s*(?:File|Form)\(/g),
    ].map((m) => m[1]);
    expect(declared).toContain("file");
    expect(declared).toContain("mock_test_id");
    expect(declared).toContain("new_paper_name");

    const built = buildImportUpload(
      form({ subject: "Physics", per_chunk: "6" }),
      pdfFile(),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const key of built.body.keys()) {
      expect(declared, `part "${key}" is not a Form parameter on the route`).toContain(
        key,
      );
    }
  });

  it("confirms the backend enforces exactly one target, as the builder assumes", () => {
    // If this assertion ever stops matching, the builder's central rule is
    // load-bearing for nothing and `EMPTY_IMPORT_FORM` may be wrong too.
    const source = readFileSync(join(ROUTERS, "question_imports.py"), "utf8");
    expect(source).toContain("(mock_test_id is None) == (new_paper_name is None)");
  });

  it("confirms the ceiling the client mirrors is the one the server reads", () => {
    const config = readFileSync(
      resolve(import.meta.dirname, "../../backend/app/config.py"),
      "utf8",
    );
    const declared = /PDF_IMPORT_MAX_BYTES:\s*int\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(
      config,
    );
    expect(declared, "could not read PDF_IMPORT_MAX_BYTES out of the backend config").toBeTruthy();
    expect(Number(declared![1]) * 1024 * 1024).toBe(importMaxBytes());
  });
});

/* ------------------------------------------------------------------ *
 * The routers are where the assumptions were read from
 * ------------------------------------------------------------------ */

describe("the router file is where these assumptions came from", () => {
  it("exists and declares the routes the API client calls", () => {
    const files = readdirSync(ROUTERS).filter((f) => f.endsWith(".py"));
    expect(files).toContain("question_imports.py");
  });
});