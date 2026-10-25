/**
 * @vitest-environment jsdom
 *
 * Searching the audit trail by the person's name.
 *
 * The panel used to fetch the default fifty rows and filter them in the
 * browser, which is not a search of the audit trail: a login history outgrows
 * one page, and the entry an admin is looking for is usually the older one. The
 * search therefore has to reach the API as `q`, and "Logins only" has to be
 * `action=login` rather than a predicate over whatever happened to load.
 *
 * These tests drive the real `useAdminResource` hook with a mocked
 * `adminApi.auditLogs`, so they assert the request the panel issues — not just
 * that the panel renders a filtered array it was handed.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const logs = [
    {
      id: 1,
      user_id: 5,
      username: "Riya Sharma",
      action: "login",
      entity_type: "user",
      entity_id: 5,
      old_value: null,
      new_value: { method: "password" },
      ip_address: "203.0.113.5",
      created_at: "2026-10-01T10:00:00Z",
    },
    {
      id: 2,
      user_id: 5,
      username: "Riya Sharma",
      action: "login",
      entity_type: "user",
      entity_id: 5,
      old_value: null,
      new_value: { method: "otp" },
      ip_address: "203.0.113.6",
      created_at: "2026-10-02T10:00:00Z",
    },
    {
      id: 3,
      user_id: 1,
      username: "Admin",
      action: "update_blog",
      entity_type: "blog",
      entity_id: 9,
      old_value: null,
      new_value: null,
      ip_address: "198.51.100.1",
      created_at: "2026-10-03T10:00:00Z",
    },
  ];

  /** Mirrors the server-side filter closely enough to assert the panel's query. */
  const filter = (query: { q?: string; action?: string; limit?: number } = {}) => {
    const q = (query.q ?? "").toLowerCase();
    const limit = query.limit ?? 50;
    return logs
      .filter((log) => {
        if (query.action && log.action !== query.action) return false;
        if (!q) return true;
        return [log.username, log.action, log.entity_type, log.ip_address].some((value) =>
          (value ?? "").toLowerCase().includes(q),
        );
      })
      .slice(0, limit);
  };

  return { logs, filter, auditLogs: vi.fn(async (query = {}) => filter(query)), showToast: vi.fn() };
});

vi.mock("@/lib/context/AppContext", () => ({
  useApp: () => ({ showToast: mocks.showToast }),
}));

vi.mock("@/lib/api", () => ({
  AUDIT_PAGE_SIZE: 50,
  AUDIT_MAX_ROWS: 200,
  isForbidden: () => false,
  adminApi: { auditLogs: mocks.auditLogs },
}));

import { AuditSection } from "@/components/admin/sections/AuditSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.auditLogs.mockImplementation(async (query = {}) => mocks.filter(query));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/** Let the fetch effect's promise resolve and React commit the result. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function render() {
  await act(async () => {
    root.render(<AuditSection />);
  });
  await settle();
  await settle();
}

/** React tracks `input.value` separately, so set it through the native setter. */
function type(value: string) {
  const input = container.querySelector<HTMLInputElement>("#audit-search");
  if (!input) throw new Error("search input not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submitSearch() {
  const form = container.querySelector("form");
  if (!form) throw new Error("search form not found");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
  await settle();
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label),
  );
  if (!button) throw new Error(`button "${label}" not found`);
  await act(async () => {
    button.click();
  });
  await settle();
  await settle();
}

describe("AuditSection search", () => {
  it("renders sign-ins with the method, not the raw `login` action", async () => {
    await render();

    expect(container.textContent).toContain("Riya Sharma");
    expect(container.textContent).toContain("Signed in");
    expect(container.textContent).toContain("password");
    expect(container.textContent).toContain("one-time code");
    // The first request uses the endpoint's default window.
    expect(mocks.auditLogs).toHaveBeenCalledWith({
      q: undefined,
      action: undefined,
      limit: 50,
    });
  });

  it("sends the typed name to the API instead of filtering the loaded page", async () => {
    await render();

    await act(async () => type("Riya"));
    await submitSearch();

    expect(mocks.auditLogs).toHaveBeenLastCalledWith({
      q: "Riya",
      action: undefined,
      limit: 50,
    });
    expect(container.textContent).toContain("Riya Sharma");
    expect(container.textContent).not.toContain("update_blog");
  });

  it("narrows the same search to sign-ins with `action=login`", async () => {
    await render();

    await act(async () => type("Riya"));
    await submitSearch();
    await clickButton("Logins only");

    expect(mocks.auditLogs).toHaveBeenLastCalledWith({
      q: "Riya",
      action: "login",
      limit: 50,
    });
    expect(container.textContent).toContain("Signed in");
    expect(container.textContent).not.toContain("update_blog");
  });

  it("reports an empty result as an empty search, not as an empty audit trail", async () => {
    await render();

    await act(async () => type("nobody-by-that-name"));
    await submitSearch();

    expect(container.textContent).toContain("No audit entries match this search.");
    expect(container.textContent).not.toContain("No audit entries recorded yet.");
  });

  it("grows the window before asking the admin to refine the search", async () => {
    // A full page is indistinguishable from "more exists" without a total, so
    // the panel must offer the next window rather than stopping at fifty.
    mocks.auditLogs.mockImplementation(async (query: { limit?: number } = {}) =>
      Array.from({ length: query.limit ?? 50 }, (_, index) => ({
        ...mocks.logs[0],
        id: 1000 + index,
      })),
    );

    await render();
    expect(container.textContent).toContain("Show more");

    await clickButton("Show more");

    expect(mocks.auditLogs).toHaveBeenLastCalledWith({
      q: undefined,
      action: undefined,
      limit: 100,
    });
  });

  it("clears the search and returns to the first window", async () => {
    await render();

    await act(async () => type("Riya"));
    await submitSearch();
    await clickButton("Clear");

    expect(mocks.auditLogs).toHaveBeenLastCalledWith({
      q: undefined,
      action: undefined,
      limit: 50,
    });
    expect(container.textContent).toContain("update_blog");
  });
});
