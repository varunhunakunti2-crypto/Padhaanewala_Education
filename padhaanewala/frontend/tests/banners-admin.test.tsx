/**
 * @vitest-environment jsdom
 *
 * Editing an existing hero card, from the admin list.
 *
 * The panel has always had an edit form, but two things made it useless in
 * practice: the control was an unlabelled pencil buried in the card footer, and
 * the form renders above the grid — so on a list taller than the screen,
 * clicking it looked like nothing happened. This pins the flow the admin
 * actually needs: open the editor on a card, find it prefilled with that card's
 * values, change one field, save, and have the change reach the API *and* purge
 * the public cache.
 *
 * The cache purge is asserted here too, because pause/resume changing a card's
 * visibility without purging is exactly how "I added 2 cards but only 1 shows"
 * happened before.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rows = [
    {
      id: 11,
      title: "hsrgh",
      subtitle: "hgjfg",
      image_url: "https://t4.ftcdn.net/a.jpg",
      link_url: "/exams",
      position: "hero_card",
      display_order: 0,
      is_active: true,
      start_date: null,
      end_date: null,
    },
  ];

  return {
    rows,
    banners: vi.fn(async () => rows),
    updateBanner: vi.fn(async (id: number, payload: Record<string, unknown>) => ({
      ...rows[0],
      ...payload,
      id,
    })),
    createBanner: vi.fn(),
    deleteBanner: vi.fn(),
    revalidate: vi.fn(async () => ({ revalidated: ["banners"] })),
    showToast: vi.fn(),
    reload: vi.fn(),
  };
});

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({ showToast: mocks.showToast }),
}));

vi.mock("@/lib/api", () => ({
  adminApi: {
    banners: mocks.banners,
    updateBanner: mocks.updateBanner,
    createBanner: mocks.createBanner,
    deleteBanner: mocks.deleteBanner,
    revalidate: mocks.revalidate,
  },
  isForbidden: () => false,
}));

vi.mock("@/components/admin/useAdminResource", () => ({
  useAdminResource: () => ({
    data: mocks.rows,
    error: null,
    loading: false,
    reload: mocks.reload,
  }),
}));

import { BannersSection } from "@/components/admin/sections/BannersSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The slot switcher defaults to the homepage strip; the cards live next door. */
function showHeroCards() {
  const tab = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Hero cards",
  );
  expect(tab).toBeDefined();
  act(() => tab?.click());
}

/** Type into a controlled React input the way a keystroke does. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  expect(setter).toBeDefined();
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
}

describe("BannersSection — editing an existing card", () => {
  it("opens an editor prefilled with that card's content", () => {
    act(() => root.render(<BannersSection />));
    showHeroCards();

    const edit = container.querySelector<HTMLButtonElement>('button[aria-label="Edit hsrgh"]');
    expect(edit).not.toBeNull();
    // A labelled control, not just an icon: the pencil alone was missed.
    expect(edit?.textContent).toContain("Edit");

    act(() => edit?.click());

    expect(container.querySelector<HTMLInputElement>("#banner-title")?.value).toBe("hsrgh");
    expect(container.querySelector<HTMLInputElement>("#banner-subtitle")?.value).toBe("hgjfg");
    expect(container.querySelector<HTMLInputElement>("#banner-image")?.value).toBe(
      "https://t4.ftcdn.net/a.jpg",
    );
    expect(container.querySelector<HTMLInputElement>("#banner-link")?.value).toBe("/exams");
    expect(container.textContent).toContain("Editing “hsrgh”");
  });

  it("saves the edited content and purges the public cache", async () => {
    act(() => root.render(<BannersSection />));
    showHeroCards();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Edit hsrgh"]')?.click());

    const title = container.querySelector<HTMLInputElement>("#banner-title");
    expect(title).not.toBeNull();
    if (title) type(title, "Updated card");

    await act(async () => {
      buttonByText("Save changes")?.click();
    });

    expect(mocks.updateBanner).toHaveBeenCalledTimes(1);
    const [id, payload] = mocks.updateBanner.mock.calls[0] as [number, Record<string, unknown>];
    expect(id).toBe(11);
    expect(payload).toMatchObject({
      title: "Updated card",
      subtitle: "hgjfg",
      image_url: "https://t4.ftcdn.net/a.jpg",
      link_url: "/exams",
    });
    // Editing content must not silently re-file the card into another slot.
    expect(payload.position).toBeUndefined();
    expect(mocks.revalidate).toHaveBeenCalledWith(["banners"]);
  });

  it("purges the public cache when a card is paused or resumed", async () => {
    act(() => root.render(<BannersSection />));
    showHeroCards();

    await act(async () => {
      buttonByText("Pause")?.click();
    });

    expect(mocks.updateBanner).toHaveBeenCalledWith(11, { is_active: false });
    // Without this the homepage keeps rendering the paused card until the ISR
    // window expires — the stale-hero bug this test exists for.
    expect(mocks.revalidate).toHaveBeenCalledWith(["banners"]);
  });
});
