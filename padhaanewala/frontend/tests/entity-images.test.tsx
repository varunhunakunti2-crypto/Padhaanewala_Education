/**
 * @vitest-environment jsdom
 *
 * Admin-uploaded images, from the form box to the rendered page.
 *
 * Three things have to hold for this feature to be real, and each is a place
 * where it could look finished and do nothing:
 *
 *  1. **The URL the admin types is checked before the server sees it.** The
 *     value lands in an `<img src>`, so `javascript:` and `data:` are stored XSS,
 *     and `//evil.example` leaves the origin while reading like a path. The
 *     backend refuses all three; this pins that the form does too, so the admin
 *     gets a sentence instead of a 422.
 *
 *  2. **Blank means "no image", not "an image pointing at nothing".** The
 *     column is nullable and the gradient fallback is what renders when it is
 *     null. A blank box must therefore produce `null`, and the mapper must
 *     produce `undefined` — not `""`, which a component would treat as an
 *     image whose `src` is the current page.
 *
 *  3. **The render fallback actually falls back.** `EntityImage` must draw an
 *     `<img>` when there is a URL and the gradient when there is not. A
 *     component that always rendered the `<img>` would show a broken image on
 *     every row the migration did not backfill — which is all of them.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EntityImage } from "@/components/entity/EntityImage";
import { checkImageUrl, isRenderableImageUrl, IMAGE_URL_MAX } from "@/lib/image-field";
import { mapCollegeListItem, mapExam, mapScholarship } from "@/lib/mappers";
import type { ApiCollegeListItem, ApiExam, ApiScholarship } from "@/lib/api-server";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/* ------------------------------------------------------------------ *
 * 1. URL validation
 * ------------------------------------------------------------------ */

describe("checkImageUrl", () => {
  it("accepts an internal media path", () => {
    expect(checkImageUrl("/media/files/12")).toEqual({ ok: true, value: "/media/files/12" });
  });

  it("accepts an absolute http(s) URL", () => {
    expect(checkImageUrl("https://cdn.example.com/a.png")).toEqual({
      ok: true,
      value: "https://cdn.example.com/a.png",
    });
    expect(checkImageUrl("http://cdn.example.com/a.png")).toEqual({
      ok: true,
      value: "http://cdn.example.com/a.png",
    });
  });

  it("trims before storing, so a stray space is not stored as part of the URL", () => {
    expect(checkImageUrl("  /media/files/12  ")).toEqual({ ok: true, value: "/media/files/12" });
  });

  it("treats blank as no image rather than an empty string", () => {
    expect(checkImageUrl("")).toEqual({ ok: true, value: null });
    expect(checkImageUrl("   ")).toEqual({ ok: true, value: null });
  });

  it("refuses the schemes that would be stored XSS in an <img src>", () => {
    // `data:` is the subtle one: an `<img src="data:image/svg+xml,...">` renders,
    // and SVG can carry script. The backend refuses it; this must too.
    expect(checkImageUrl("javascript:alert(1)").ok).toBe(false);
    expect(checkImageUrl("data:image/svg+xml;base64,PHN2Zz4=").ok).toBe(false);
  });

  it("refuses a protocol-relative URL, which reads like a path but leaves the site", () => {
    expect(checkImageUrl("//evil.example/logo.png").ok).toBe(false);
  });

  it("refuses a bare host with no scheme", () => {
    expect(checkImageUrl("example.com/logo.png").ok).toBe(false);
  });

  it("refuses a value longer than the column", () => {
    expect(checkImageUrl(`/${"a".repeat(IMAGE_URL_MAX)}`).ok).toBe(false);
  });

  it("explains the refusal rather than returning a bare false", () => {
    const result = checkImageUrl("javascript:alert(1)");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/image/i);
  });
});

describe("isRenderableImageUrl", () => {
  it("is true for a value the server would accept", () => {
    expect(isRenderableImageUrl("/media/files/12")).toBe(true);
  });

  it("is false for blank, so the preview does not flash an empty frame", () => {
    expect(isRenderableImageUrl("")).toBe(false);
    expect(isRenderableImageUrl("   ")).toBe(false);
  });

  it("is false for a value the server would refuse", () => {
    // Previewing a value that cannot be saved promises a change that will not
    // happen.
    expect(isRenderableImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isRenderableImageUrl("javascript:alert(1)")).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * 2. The mappers
 * ------------------------------------------------------------------ */

describe("image_url mapping", () => {
  const college = (image_url: string | null) =>
    ({
      id: 7,
      college_id: "C7",
      name: "Example Institute",
      slug: "example-institute",
      image_url,
      college_type: "University",
      ownership: "Private",
      state: "Kerala",
      city: "Kochi",
      average_rating: 4.2,
      total_reviews: 0,
      is_featured: false,
      has_hostel: true,
    }) as unknown as ApiCollegeListItem;

  it("carries the college image through to the view model", () => {
    expect(mapCollegeListItem(college("/media/files/7")).imageUrl).toBe("/media/files/7");
  });

  it("maps a null college image to undefined, not an empty string", () => {
    // `undefined` is what the render layer checks for the fallback. `""` would
    // be an <img src=""> — the current page — and the component would draw it.
    expect(mapCollegeListItem(college(null)).imageUrl).toBeUndefined();
  });

  it("carries a whitespace-only value as absent", () => {
    expect(mapCollegeListItem(college("   ")).imageUrl).toBeUndefined();
  });

  it("carries the exam image through", () => {
    const exam = {
      id: 1,
      name: "JEE Main",
      slug: "jee-main",
      conducting_authority: "NTA",
      exam_type: "national",
      eligibility: null,
      application_start_date: null,
      application_deadline: null,
      exam_date: null,
      admit_card_date: null,
      result_date: null,
      official_website: null,
      official_notification: null,
      syllabus: null,
      faqs: null,
      image_url: "/media/files/13",
      is_active: true,
    } as unknown as ApiExam;
    expect(mapExam(exam).imageUrl).toBe("/media/files/13");
  });

  it("carries the scholarship image through", () => {
    const scholarship = {
      id: 3,
      name: "Merit Scholarship",
      slug: "merit-scholarship",
      provider: "Govt",
      ownership: "government",
      eligibility: null,
      state_id: null,
      state_name: null,
      course: null,
      category: null,
      income_criteria: null,
      amount: null,
      application_deadline: null,
      documents_required: null,
      application_procedure: null,
      official_website: null,
      verification_status: "verified",
      last_verified_date: null,
      next_verification_date: null,
      image_url: "/media/files/11",
      is_active: true,
    } as unknown as ApiScholarship;
    expect(mapScholarship(scholarship).imageUrl).toBe("/media/files/11");
  });
});

/* ------------------------------------------------------------------ *
 * 3. The render fallback
 * ------------------------------------------------------------------ */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: React.ReactNode) {
  act(() => {
    root.render(node);
  });
}

describe("EntityImage", () => {
  it("draws an <img> when there is a URL", () => {
    render(<EntityImage src="/media/files/12" alt="Campus" gradientId="g3" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/media/files/12");
  });

  it("draws no <img> when the URL is absent, leaving the gradient", () => {
    // This is the case every pre-migration row takes. An <img> here would be a
    // broken-image icon over the artwork on every card in the catalog.
    render(<EntityImage src={null} alt="" gradientId="g3" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("treats a blank string as absent rather than rendering src=\"\"", () => {
    render(<EntityImage src="   " alt="" gradientId="g0" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders whatever children the caller passes on top of either background", () => {
    render(
      <EntityImage src={null} alt="" gradientId="g0">
        <span data-testid="overlay">II</span>
      </EntityImage>,
    );
    expect(container.querySelector('[data-testid="overlay"]')?.textContent).toBe("II");
  });

  it("keeps the gradient class on the wrapper even with an image, so decode is not a white box", () => {
    render(<EntityImage src="/media/files/12" alt="" gradientId="g3" />);
    expect(container.firstElementChild?.className).toMatch(/from-/);
  });
});
