/**
 * @vitest-environment jsdom
 *
 * The header bell.
 *
 * The bell is the only place a student sees that a message arrived without
 * visiting `/dashboard`, so the things worth pinning are the ones that make it
 * either useful or infuriating:
 *
 *  - the badge counts *unread* rows, and stays off the bell entirely at zero
 *    (a permanent "0" is noise that trains people to ignore it);
 *  - clicking a row marks that row, not "everything";
 *  - Escape closes the panel and puts focus back on the bell, because a panel
 *    that strands focus is worse for keyboard users than no panel;
 *  - an outside click closes it, so it does not sit over the page.
 *
 * `useApp` is mocked rather than wrapped in the real provider: the provider
 * fetches the inbox on mount, and this suite is about the panel, not the fetch.
 * `AppContext`'s own fetch/merge behaviour is covered by
 * `tests/notification-inbox.test.ts`.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  state: {
    notifications: [] as Array<{
      id: string;
      title: string;
      message: string;
      date: string;
      read: boolean;
    }>,
  },
}));

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({
    notifications: mocks.state.notifications,
    markNotificationRead: mocks.markNotificationRead,
    markAllNotificationsRead: mocks.markAllNotificationsRead,
  }),
}));

// The panel's footer link. Rendering the real App Router `Link` needs a router
// in context; a plain anchor keeps this suite about the bell.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NotificationBell } from "@/components/layout/NotificationBell";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

const inbox = [
  {
    id: "api-3",
    title: "New scholarship added",
    message: "A new scholarship is open for applications.",
    date: "2026-10-26T12:00:00Z",
    read: false,
  },
  {
    id: "api-2",
    title: "Mock test result",
    message: "Your result is ready.",
    date: "2026-10-25T12:00:00Z",
    read: false,
  },
  {
    id: "api-1",
    title: "Welcome",
    message: "Your account is ready.",
    date: "2026-10-20T12:00:00Z",
    read: true,
  },
];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.state.notifications = inbox.map((item) => ({ ...item }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(<NotificationBell />);
  });
}

function bell(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>("button[aria-label^='Notifications']");
  if (!button) throw new Error("bell button not rendered");
  return button;
}

async function openPanel() {
  await act(async () => {
    bell().click();
  });
}

function badge(): string | null {
  return container.querySelector("button[aria-label^='Notifications'] span[aria-hidden='true']")
    ?.textContent ?? null;
}

describe("unread badge", () => {
  it("counts unread rows only", async () => {
    await render();
    expect(badge()).toBe("2");
    expect(bell().getAttribute("aria-label")).toBe("Notifications, 2 unread");
  });

  it("caps the count so a long badge cannot distort the header", async () => {
    mocks.state.notifications = Array.from({ length: 14 }, (_, index) => ({
      id: `api-${index}`,
      title: `Update ${index}`,
      message: "",
      date: "2026-10-26T12:00:00Z",
      read: false,
    }));
    await render();
    expect(badge()).toBe("9+");
  });

  it("shows no badge at all when everything is read", async () => {
    mocks.state.notifications = inbox.map((item) => ({ ...item, read: true }));
    await render();
    expect(badge()).toBeNull();
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
  });
});

describe("panel", () => {
  it("is closed until the bell is clicked, then lists the messages", async () => {
    await render();
    expect(container.querySelector("#site-notifications")).toBeNull();

    await openPanel();

    const panel = container.querySelector("#site-notifications");
    expect(panel).not.toBeNull();
    expect(bell().getAttribute("aria-expanded")).toBe("true");
    expect(panel?.textContent).toContain("New scholarship added");
    expect(panel?.textContent).toContain("A new scholarship is open for applications.");
  });

  it("marks the clicked row, and only that row", async () => {
    await render();
    await openPanel();

    const rows = Array.from(
      container.querySelectorAll<HTMLButtonElement>("#site-notifications li button"),
    );
    await act(async () => {
      rows[0].click();
    });

    expect(mocks.markNotificationRead).toHaveBeenCalledTimes(1);
    expect(mocks.markNotificationRead).toHaveBeenCalledWith("api-3");
  });

  it("marks everything from the header action", async () => {
    await render();
    await openPanel();

    const markAll = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Mark all read"),
    );
    expect(markAll).toBeDefined();
    await act(async () => {
      markAll?.click();
    });

    expect(mocks.markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it("hides the mark-all action when there is nothing unread", async () => {
    mocks.state.notifications = inbox.map((item) => ({ ...item, read: true }));
    await render();
    await openPanel();

    expect(container.textContent).not.toContain("Mark all read");
  });

  it("explains the empty state instead of rendering a blank box", async () => {
    mocks.state.notifications = [];
    await render();
    expect(badge()).toBeNull();
    await openPanel();

    expect(container.querySelector("#site-notifications")?.textContent).toContain(
      "No notifications yet.",
    );
  });

  it("closes on Escape and returns focus to the bell", async () => {
    await render();
    await openPanel();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector("#site-notifications")).toBeNull();
    expect(document.activeElement).toBe(bell());
  });

  it("closes on a click outside the panel", async () => {
    await render();
    await openPanel();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(container.querySelector("#site-notifications")).toBeNull();
  });

  it("stays open when the click lands inside it", async () => {
    await render();
    await openPanel();

    const panel = container.querySelector("#site-notifications");
    await act(async () => {
      panel?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(container.querySelector("#site-notifications")).not.toBeNull();
  });
});
