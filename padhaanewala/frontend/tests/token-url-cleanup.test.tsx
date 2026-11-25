/**
 * @vitest-environment jsdom
 *
 * One-time links must not leave their token in the address bar: it ends up in
 * history, screenshots, support pastes and the Referer of the next click.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanedUrlWithoutToken,
  TokenUrlCleanup,
} from "@/components/auth/TokenUrlCleanup";

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
  vi.restoreAllMocks();
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
});

describe("cleanedUrlWithoutToken", () => {
  it("removes every token value while keeping other params and the hash", () => {
    expect(
      cleanedUrlWithoutToken(
        "https://padhaanewala.test/reset-password?token=a&utm_source=mail&token=b&next=%2Fdashboard#form",
      ),
    ).toBe("/reset-password?utm_source=mail&next=%2Fdashboard#form");
  });

  it("is a no-op when no token is present", () => {
    expect(cleanedUrlWithoutToken("https://padhaanewala.test/login?mode=otp")).toBeNull();
  });
});

describe("TokenUrlCleanup", () => {
  it("rewrites the current entry with history.replaceState, preserving state", () => {
    window.history.replaceState({ marker: "keep" }, "", "/verify-email?token=one-time&mode=signup");
    const replace = vi.spyOn(window.history, "replaceState");

    act(() => root.render(<TokenUrlCleanup />));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      { marker: "keep" },
      "",
      "/verify-email?mode=signup",
    );
    expect(window.location.pathname).toBe("/verify-email");
    expect(window.location.search).toBe("?mode=signup");
    expect(window.history.state).toEqual({ marker: "keep" });
  });

  it("does not touch the URL when there is no token", () => {
    window.history.replaceState(null, "", "/login?mode=signup");
    const replace = vi.spyOn(window.history, "replaceState");

    act(() => root.render(<TokenUrlCleanup />));

    expect(replace).not.toHaveBeenCalled();
  });
});
