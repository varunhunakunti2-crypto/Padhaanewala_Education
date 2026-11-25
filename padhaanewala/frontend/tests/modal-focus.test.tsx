/**
 * @vitest-environment jsdom
 *
 * Focus must survive a re-render of the dialog's contents.
 *
 * The symptom this pins: typing a single character into any admin form moved
 * focus out of the input and onto the dialog panel, so the next keystroke went
 * nowhere and you had to click the field again — one letter per click, across
 * every modal in the application.
 *
 * The mechanism was `Modal`'s effect being keyed on `[open, onClose]`.
 * `onClose` is an inline arrow (`() => setOpen(false)`) or a `closeDialog`
 * declared in the parent's body, so it is a new function identity on every
 * render of that parent — and the effect's last statement is
 * `panelRef.current?.focus()`. Editing a field re-renders the parent, so the
 * effect re-ran on every keystroke and reclaimed focus.
 *
 * A component test is the only thing that catches this. Type checking, lint and
 * the production build all passed while it was live, and the 413 existing tests
 * are all pure functions that never mount a component.
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Modal } from "@/components/ui/Modal";

declare global {
  // React's own flag: without it `act()` warns that it is being called outside
  // a React-rendered environment.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** A dialog whose contents re-render (and whose `onClose` is a new function
 *  each time) whenever the button inside it is pressed. */
function Harness() {
  const [count, setCount] = useState(0);
  return (
    <Modal open onClose={() => setCount((c) => c + 1)} title="Dialog">
      <input id="field" />
      <button id="rerender" type="button" onClick={() => setCount((c) => c + 1)}>
        renders {count}
      </button>
    </Modal>
  );
}

/** Two focusable ends plus a field in between, to pin Tab cycling. */
function TrapHarness() {
  return (
    // No title: the header's Close button would otherwise be the first
    // focusable element and would shift the cycle being asserted here.
    <Modal open onClose={() => {}}>
      <button id="first" type="button">First</button>
      <input id="middle" />
      <button id="last" type="button">Last</button>
    </Modal>
  );
}

/** A trigger outside the dialog, used to assert focus restoration on close. */
function ClosingHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button id="trigger" type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Dialog">
        <input id="field" />
      </Modal>
    </>
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.style.overflow = "";
});

describe("Modal focus", () => {
  it("takes focus when it opens", async () => {
    await act(async () => root.render(<Harness />));
    const panel = container.querySelector("[tabindex='-1']") as HTMLElement;
    expect(document.activeElement).toBe(panel);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does not steal focus back when its contents re-render", async () => {
    await act(async () => root.render(<Harness />));
    const field = document.getElementById("field") as HTMLInputElement;

    field.focus();
    expect(document.activeElement).toBe(field);

    // The parent re-renders, which is what gives it a new `onClose`. Before the
    // fix this alone was enough to yank focus out of the field.
    await act(async () => {
      (document.getElementById("rerender") as HTMLButtonElement).click();
    });

    expect(document.activeElement).toBe(field);
  });

  it("still closes on Escape after a re-render", async () => {
    // The `onClose` is read through a ref precisely so the effect can stop
    // depending on it — this asserts that trade did not break the binding.
    let closed = 0;
    function WithEscape() {
      const [, setCount] = useState(0);
      return (
        <Modal open onClose={() => { closed += 1; setCount((c) => c + 1); }} title="Dialog">
          <input id="field" />
        </Modal>
      );
    }
    await act(async () => root.render(<WithEscape />));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(closed).toBe(1);
  });

  it("wraps Tab focus at both ends of the dialog", async () => {
    await act(async () => root.render(<TrapHarness />));
    const first = document.getElementById("first") as HTMLButtonElement;
    const last = document.getElementById("last") as HTMLButtonElement;

    last.focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    });
    expect(document.activeElement).toBe(first);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
    });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the previously focused element when it closes", async () => {
    await act(async () => root.render(<ClosingHarness />));
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    const panel = container.querySelector("[tabindex='-1']") as HTMLElement;
    expect(document.activeElement).toBe(panel);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.activeElement).toBe(trigger);
  });
});
