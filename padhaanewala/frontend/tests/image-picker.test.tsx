/**
 * @vitest-environment jsdom
 *
 * The Media-library image picker.
 *
 * This control replaces every per-form upload and URL box, so the flow it has to
 * get right is: show the current value, open the library, choose a file, and
 * write that file's path into the form. The interesting cases are the ones that
 * are not the happy path:
 *
 *  - a value saved before the library existed must not be silently blanked;
 *  - an empty library must say where to upload, not look broken;
 *  - a failed list request must offer a retry and keep the current value usable.
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMedia } from "@/lib/api";

const mocks = vi.hoisted(() => ({ media: vi.fn() }));

vi.mock("@/lib/api", () => ({
  adminApi: { media: mocks.media },
  isForbidden: () => false,
}));

import { ImageField } from "@/components/admin/ImageField";

const rows: AdminMedia[] = [
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
  {
    id: 2,
    url: "/api/v1/media/files/2",
    file_name: "logo.png",
    file_type: "image/png",
    file_size: 1024,
    alt_text: null,
    entity_type: "college",
    entity_id: 7,
    image_type: "logo",
    display_order: 0,
    is_active: true,
    created_at: "2026-01-02T00:00:00Z",
  },
];

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.media.mockResolvedValue(rows);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ImageField id="test-image" label="Cover image" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </>
  );
}

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

/** Let the list request's promise chain settle inside `act`. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openPicker() {
  act(() => container.querySelector<HTMLButtonElement>("#test-image")?.click());
  await flush();
}

function buttonByTitle(title: string): HTMLButtonElement | undefined {
  return container.querySelector<HTMLButtonElement>(`button[title="${title}"]`) ?? undefined;
}

describe("ImageField — picking from the Media library", () => {
  it("writes the chosen file's URL into the form and closes the dialog", async () => {
    render(<Harness />);
    expect(container.textContent).toContain("No image selected");

    await openPicker();
    expect(mocks.media).toHaveBeenCalledTimes(1);
    // Newest first, because the asset just uploaded is the one being looked for.
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>("button[title]"));
    expect(cards.map((c) => c.getAttribute("title"))).toEqual(["logo.png", "campus.png"]);

    act(() => buttonByTitle("campus.png")?.click());

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      "/api/v1/media/files/1",
    );
    expect(container.querySelector("#test-image")?.textContent).toContain("Replace image");
    // `Modal` renders nothing when closed, so the grid is gone.
    expect(buttonByTitle("campus.png")).toBeUndefined();
  });

  it("shows the current library file and marks it as selected", async () => {
    render(<Harness initial="/api/v1/media/files/2" />);
    // The file name comes from the library, so it appears once the list has
    // loaded; until then the stored path is what the field can honestly show.
    expect(container.textContent).toContain("/api/v1/media/files/2");
    expect(container.textContent).not.toContain("not in the Media library");

    await openPicker();
    expect(container.textContent).toContain("logo.png");
    expect(buttonByTitle("logo.png")?.getAttribute("aria-pressed")).toBe("true");
    expect(buttonByTitle("campus.png")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps a value that is not in the library instead of blanking it", async () => {
    render(<Harness initial="https://cdn.example.com/legacy.jpg" />);
    expect(container.textContent).toContain("https://cdn.example.com/legacy.jpg");

    await openPicker();
    expect(container.textContent).toContain("not in the Media library");
    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      "https://cdn.example.com/legacy.jpg",
    );
  });

  it("removes the value only when Remove is pressed", async () => {
    render(<Harness initial="/api/v1/media/files/2" />);

    act(() => {
      const remove = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Remove",
      );
      remove?.click();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe("");
    expect(container.querySelector("#test-image")?.textContent).toContain("Choose from Media");
    // Removing from a form must not delete the asset from the library.
    expect(mocks.media).not.toHaveBeenCalled();
  });

  it("says where to upload when the library is empty", async () => {
    mocks.media.mockResolvedValue([]);
    render(<Harness />);
    await openPicker();

    expect(container.textContent).toContain("The Media library is empty.");
    expect(container.textContent).toContain("Admin → Media");
  });

  it("offers a retry when the list cannot be loaded", async () => {
    mocks.media.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(rows);
    render(<Harness />);
    await openPicker();

    expect(container.textContent).toContain("The Media library could not be loaded.");

    act(() => {
      const retry = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Try again",
      );
      retry?.click();
    });
    await flush();

    expect(mocks.media).toHaveBeenCalledTimes(2);
    expect(buttonByTitle("campus.png")).toBeDefined();
  });
});
