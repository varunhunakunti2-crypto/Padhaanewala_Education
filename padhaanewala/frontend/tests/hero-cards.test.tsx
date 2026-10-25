/**
 * @vitest-environment jsdom
 *
 * Hero card thumbnails, which are admin-supplied URLs.
 *
 * The bug this pins: the panel used `next/image` for the thumbnail, so any image
 * host not listed in `images.remotePatterns` threw during render and took the
 * whole homepage to the error boundary. `remotePatterns` is a build-time list
 * and the URL is typed at runtime, so the two can never agree for long. The
 * panel must therefore render a plain `<img>` — the same rule `EntityImage`
 * follows — and must fall back to the title's initial when that image does not
 * load (dead host, typo, or a host the CSP blocks).
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HeroVisualPanel } from "@/components/home/hero/HeroVisualPanel";
import type { HeroCard } from "@/lib/content";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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

const card = (overrides: Partial<HeroCard> & { title: string }): HeroCard => ({
  action: "Explore now",
  href: "/exams",
  thumb: null,
  ...overrides,
});

describe("HeroVisualPanel thumbnails", () => {
  it("renders an admin-typed URL as a plain <img>, not through /_next/image", () => {
    act(() => {
      root.render(
        <HeroVisualPanel
          cards={[card({ title: "Stock art", thumb: "https://t4.ftcdn.net/a.jpg" })]}
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://t4.ftcdn.net/a.jpg");
    // `/_next/image` is the host-checked optimiser that threw for this URL.
    expect(img?.getAttribute("src")).not.toContain("/_next/image");
    // No leaked page URL to a third-party host.
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("shows the title's initial when a card has no thumbnail", () => {
    act(() => {
      root.render(<HeroVisualPanel cards={[card({ title: "Scholarships" })]} />);
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("S");
  });

  it("swaps a broken image for the initial instead of leaving a broken frame", () => {
    act(() => {
      root.render(<HeroVisualPanel cards={[card({ title: "JEE", thumb: "https://example.com/x.png" })]} />);
    });

    const img = container.querySelector("img");
    expect(img).not.toBeNull();

    act(() => {
      img?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("J");
  });

  it("renders every card — the list is unbounded and scrolls", () => {
    const cards = Array.from({ length: 9 }, (_, i) =>
      card({ title: `Card ${i + 1}`, href: `/exams?page=${i + 1}` }),
    );

    act(() => {
      root.render(<HeroVisualPanel cards={cards} />);
    });

    for (const c of cards) expect(container.textContent).toContain(c.title);
  });
});
