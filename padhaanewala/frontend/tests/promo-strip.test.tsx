/**
 * @vitest-environment jsdom
 *
 * The homepage strip, which is now the only public renderer of
 * `position='home_top'` banners.
 *
 * The slot existed in the admin panel for a long time with no consumer: an
 * operator could create a promo, see it listed, and never find it on the site.
 * These tests pin the parts that make it safe to turn on — every authored
 * banner renders, an unsafe or absent link still shows the message, a broken
 * image degrades to the gradient, and a dismissal hides one banner rather than
 * the whole slot.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PromoStrip } from "@/components/home/PromoStrip";
import type { StripBanner } from "@/lib/content";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const DISMISS_KEY = "padhaanewala:home-strip:dismissed:v1";

let container: HTMLDivElement;
let root: Root;

const banner = (overrides: Partial<StripBanner> & { id: number; title: string }): StripBanner => ({
  subtitle: null,
  href: null,
  image: null,
  ...overrides,
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe("PromoStrip", () => {
  it("renders every authored banner with its supporting line", () => {
    act(() => {
      root.render(
        <PromoStrip
          banners={[
            banner({ id: 1, title: "Admissions open", subtitle: "Apply by 30 June" }),
            banner({ id: 2, title: "Scholarship deadline", subtitle: "Last date 15 July" }),
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Admissions open");
    expect(container.textContent).toContain("Apply by 30 June");
    expect(container.textContent).toContain("Scholarship deadline");
    expect(container.textContent).toContain("Last date 15 July");
  });

  it("renders nothing for an empty slot", () => {
    act(() => {
      root.render(<PromoStrip banners={[]} />);
    });

    expect(container.querySelector("section")).toBeNull();
  });

  it("opens an external link in a new tab and leaves internal ones in-tab", () => {
    act(() => {
      root.render(
        <PromoStrip
          banners={[
            banner({ id: 1, title: "External", href: "https://example.com/x" }),
            banner({ id: 2, title: "Internal", href: "/exams" }),
          ]}
        />,
      );
    });

    const links = Array.from(container.querySelectorAll("a"));
    const external = links.find((a) => a.textContent?.includes("External"));
    const internal = links.find((a) => a.textContent?.includes("Internal"));

    expect(external?.getAttribute("target")).toBe("_blank");
    expect(external?.getAttribute("rel")).toContain("noopener");
    expect(internal?.getAttribute("target")).toBeNull();
  });

  it("shows a banner with no link without turning it into an anchor", () => {
    act(() => {
      root.render(<PromoStrip banners={[banner({ id: 1, title: "Heads up" })]} />);
    });

    expect(container.textContent).toContain("Heads up");
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders an admin-typed image as a plain <img> with no referrer", () => {
    act(() => {
      root.render(
        <PromoStrip
          banners={[
            banner({ id: 1, title: "Stock", image: "https://t4.ftcdn.net/a.jpg" }),
          ]}
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://t4.ftcdn.net/a.jpg");
    expect(img?.getAttribute("src")).not.toContain("/_next/image");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("survives a broken image by falling back to the gradient", () => {
    act(() => {
      root.render(
        <PromoStrip banners={[banner({ id: 1, title: "Stock", image: "https://example.com/x.png" })]} />,
      );
    });

    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Stock");
  });

  it("dismisses one banner, remembers it, and keeps the rest", () => {
    act(() => {
      root.render(
        <PromoStrip
          banners={[
            banner({ id: 11, title: "First promo" }),
            banner({ id: 12, title: "Second promo" }),
          ]}
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Dismiss First promo"]')
        ?.click();
    });

    expect(container.textContent).not.toContain("First promo");
    expect(container.textContent).toContain("Second promo");
    // Per-banner persistence: a finished campaign must not hide the next one.
    expect(JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? "[]")).toEqual([11]);
  });

  it("honours a stored dismissal on the next visit", () => {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([11]));

    act(() => {
      root.render(
        <PromoStrip
          banners={[
            banner({ id: 11, title: "Dismissed promo" }),
            banner({ id: 12, title: "Live promo" }),
          ]}
        />,
      );
    });

    expect(container.textContent).not.toContain("Dismissed promo");
    expect(container.textContent).toContain("Live promo");
  });

  it("renders nothing when every banner has been dismissed", () => {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([1, 2]));

    act(() => {
      root.render(
        <PromoStrip
          banners={[banner({ id: 1, title: "A" }), banner({ id: 2, title: "B" })]}
        />,
      );
    });

    expect(container.querySelector("section")).toBeNull();
  });
});
