/**
 * @vitest-environment jsdom
 *
 * Redirect guards and the native form fallback on /login.
 *
 * The validator is exported from the page so the exact algorithm used by the
 * client flow can be exercised without standing up a router. The hidden input
 * assertion covers the progressive-enhancement path: when hydration completes,
 * that field carries the same validated value into POST /api/auth/login.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage, { nextPathFromLocation } from "@/app/login/page";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({
    setProfile: vi.fn(),
    setAuthenticated: vi.fn(),
    showToast: vi.fn(),
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

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
});

const at = (search: string) => window.history.replaceState(null, "", `/login${search}`);

describe("nextPathFromLocation", () => {
  it("accepts a local absolute path only", () => {
    at("?next=%2Fexams%2Fmains%3Fpage%3D2");
    expect(nextPathFromLocation()).toBe("/exams/mains?page=2");
  });

  it.each([
    ["absolute URL", "https%3A%2F%2Fevil.test%2Fsteal"],
    ["protocol-relative", "%2F%2Fevil.test%2Fsteal"],
    ["backslash", "%2F%5Cevil.test%2Fsteal"],
    ["encoded protocol-relative", "%252F%252Fevil.test"],
    ["encoded backslash", "%2F%5C%5Cevil.test"],
    ["encoded newline", "%2F%0ASet-Cookie%3A%20x"],
  ])("rejects an %s", (_label, value) => {
    at(`?next=${value}`);
    expect(nextPathFromLocation()).toBe("/");
  });
});

describe("native fallback hidden input", () => {
  it("echoes the validated next instead of an empty hard-coded value", () => {
    at("?next=%2Fscholarships%3Ftag%3Dmerit&mode=login");

    act(() => root.render(<LoginPage />));

    const hidden = container.querySelector<HTMLInputElement>('input[name="next"]');
    expect(hidden?.type).toBe("hidden");
    expect(hidden?.value).toBe("/scholarships?tag=merit");
    // The visible form is unchanged: only the hidden field carries the value.
    expect(container.querySelector('label[for="email"]')).not.toBeNull();
  });

  it("falls back to / for an unsafe next", () => {
    at("?next=%2F%2Fevil.test");

    act(() => root.render(<LoginPage />));

    expect(container.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe("/");
  });
});
