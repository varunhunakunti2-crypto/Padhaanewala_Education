/**
 * @vitest-environment jsdom
 *
 * The Media library hands out links, not just thumbnails.
 *
 * An image is uploaded once and then referenced from several places. The panel
 * therefore shows each asset's stored path and offers a Copy button that puts the
 * absolute URL on the clipboard, so the same file can be reused without a second
 * upload. Copy must work for readers too — listing the library needs no content
 * role, and copying a link is a read-only action — while delete stays behind
 * `canWrite`.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  writeText: vi.fn(async () => undefined),
  reload: vi.fn(),
  empty: false,
  rows: [
    {
      id: 1,
      url: "/api/v1/media/files/1",
      file_name: "campus.png",
      file_type: "image/png",
      file_size: 2048,
      alt_text: "Campus gate",
      entity_type: "library",
      entity_id: 0,
      image_type: "cover",
      display_order: 0,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
}));

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({ showToast: mocks.showToast, roles: ["super_admin"] }),
}));

vi.mock("@/components/admin/useAdminResource", () => ({
  useAdminResource: () => ({
    data: mocks.empty ? [] : mocks.rows,
    error: null,
    loading: false,
    reload: mocks.reload,
  }),
}));

vi.mock("@/lib/api", () => ({
  adminApi: { media: vi.fn(), uploadMedia: vi.fn(), deleteMedia: vi.fn() },
  CONTENT_ROLES: ["super_admin", "admin", "content_manager"],
  isForbidden: () => false,
  ApiError: class ApiError extends Error {},
}));

import { MediaSection } from "@/components/admin/sections/MediaSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.empty = false;
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("MediaSection — reusable links", () => {
  it("shows the stored path and copies the absolute link", async () => {
    act(() => root.render(<MediaSection />));

    expect(container.textContent).toContain("/api/v1/media/files/1");

    const copy = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy link to campus.png"]',
    );
    expect(copy).not.toBeNull();

    await act(async () => {
      copy?.click();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(`${window.location.origin}/api/v1/media/files/1`);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Link copied",
        description: `${window.location.origin}/api/v1/media/files/1`,
      }),
    );
  });

  it("still says there is nowhere to upload when the library is empty", async () => {
    mocks.empty = true;
    act(() => root.render(<MediaSection />));

    expect(container.textContent).toContain("No files uploaded yet.");
    // The empty state points at this screen, which is now the only upload point.
    expect(container.textContent).toContain("Every form picks from this library.");
  });
});
