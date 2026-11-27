/**
 * @vitest-environment jsdom
 *
 * Admin-authored website fields reach three anchors in the UI. The backend
 * validates them on write, but a row can predate that rule or be inserted
 * directly, so the render path re-checks with `isRenderableHref`. These tests
 * mount the real components for the three schemes that must never become an
 * anchor: `javascript:`, `data:` and `//protocol-relative`.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamOfficialLink } from "@/components/exams/ExamComponents";
import ScholarshipsExplorer from "@/components/scholarships/ScholarshipsExplorer";
import { CollegeSubmissionsSection } from "@/components/admin/sections/CollegeSubmissionsSection";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import type { Exam, Scholarship } from "@/lib/types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const DANGEROUS = [
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "//evil.test/college",
];

const submissionState = vi.hoisted(() => ({
  website: "",
  row: {
    id: 7,
    submitted_by: null,
    submitter_name: "A Student",
    proposed_name: "Example College",
    proposed_official_name: null,
    proposed_college_type: null,
    proposed_ownership: null,
    proposed_university_name: null,
    proposed_state_id: null,
    proposed_state_name: null,
    proposed_city: null,
    proposed_address: null,
    proposed_website: "",
    proposed_email: null,
    proposed_phone: null,
    proposed_overview: null,
    submitter_notes: null,
    status: "pending",
    reviewer_id: null,
    reviewer_name: null,
    reviewer_notes: null,
    reviewed_at: null,
    college_id: null,
    college_name: null,
    college_slug: null,
    college_is_active: null,
    possible_duplicate_college_id: null,
    possible_duplicate_college_name: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
}));

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({
    showToast: vi.fn(),
    roles: ["admin"],
    isScholarshipSaved: () => false,
    toggleScholarshipSave: () => {},
  }),
}));

vi.mock("@/components/admin/useAdminResource", () => ({
  useAdminResource: () => ({
    data: [{ ...submissionState.row, proposed_website: submissionState.website }],
    error: null,
    loading: false,
    reload: vi.fn(),
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(element: ReactElement) {
  await act(async () => {
    root.render(element);
  });
}

function examWith(website: string): Exam {
  return {
    id: "exam-1",
    slug: "exam-1",
    name: "Example Exam",
    shortName: "EX",
    level: "UG",
    conductingBody: "Example Board",
    type: "Entrance",
    overview: "Overview",
    eligibility: "Eligibility",
    fees: "₹100",
    pattern: [],
    questionCount: 10,
    duration: "1 hour",
    marking: "+1",
    negativeMarking: "0",
    dates: [],
    stage: "Registration Open",
    website,
    coursesAccepted: [],
    collegesAccepting: [],
    faqs: [],
  };
}

function scholarshipWith(website?: string): Scholarship {
  return {
    id: "sch-1",
    name: "Example Scholarship",
    provider: "Example Trust",
    amount: "₹10,000",
    eligibility: "Merit",
    deadline: "2027-01-01",
    renewable: false,
    tags: ["merit"],
    color: "from-purple-500 to-blue-500",
    documents: [],
    applicationProcess: [],
    website,
  };
}

const anchors = () => Array.from(container.querySelectorAll("a"));

/**
 * A scholarship card also carries a safe internal link to its detail route, so
 * "no anchors at all" is no longer the right assertion. What matters is that
 * none of the admin-authored destinations can become a dangerous href.
 */
const unsafeAnchors = () =>
  anchors().filter((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    return (
      DANGEROUS.includes(href) ||
      href.startsWith("javascript:") ||
      href.startsWith("data:") ||
      href.startsWith("//")
    );
  });

describe("SafeExternalLink", () => {
  it("renders a safe http(s) destination with the expected attributes", async () => {
    await render(
      <SafeExternalLink href="https://example.test/apply" className="cta">
        Apply
      </SafeExternalLink>,
    );

    const link = anchors()[0];
    expect(link.getAttribute("href")).toBe("https://example.test/apply");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it.each(DANGEROUS)("refuses %s", async (href) => {
    await render(<SafeExternalLink href={href} className="cta">Apply</SafeExternalLink>);
    expect(anchors()).toHaveLength(0);
    expect(container.querySelector("span[aria-disabled='true']")?.className).toBe("cta");
  });
});

describe("admin-authored links in the UI", () => {
  it.each(DANGEROUS)("ExamOfficialLink refuses %s", async (website) => {
    await render(<ExamOfficialLink exam={examWith(website)} />);
    expect(anchors()).toHaveLength(0);
  });

  it.each(DANGEROUS)("ScholarshipsExplorer refuses %s", async (website) => {
    await render(<ScholarshipsExplorer scholarships={[scholarshipWith(website)]} />);
    expect(unsafeAnchors()).toHaveLength(0);

    // The scholarship card now links to its own detail route; the detail view
    // still has a second anchor for the same website field.
    const view = Array.from(container.querySelectorAll("a, button")).find(
      (b) => b.textContent === "View details",
    );
    expect(view, "expected the View details control").toBeDefined();
    await act(async () => {
      (view as HTMLButtonElement).click();
    });
    expect(unsafeAnchors()).toHaveLength(0);
  });

  it.each(DANGEROUS)("CollegeSubmissionsSection refuses %s", async (website) => {
    submissionState.website = website;
    await render(<CollegeSubmissionsSection />);

    await act(async () => {
      (container.querySelector('[title="Review submission"]') as HTMLButtonElement).click();
    });

    // The internal /colleges/<slug> link is absent because this submission has
    // not been linked yet, so any anchor here would be the unsafe website.
    expect(anchors()).toHaveLength(0);
  });
});
