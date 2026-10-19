/**
 * @vitest-environment jsdom
 *
 * Abandoned admin requests are *cancelled*, not merely ignored.
 *
 * `useAdminResource` always had an `ignore` flag, so a stale response could not
 * write state — but the request itself still ran to completion. Two panels fire
 * a request per query change rather than per mount:
 *
 * - `StudentsSection` re-queries on every debounced keystroke in the search box
 *   and on every page/role/status control (`reloadKey` is four fields wide).
 * - `CollegeSubmissionsSection` re-walks the whole paginated queue when the
 *   status chip changes.
 *
 * Without an abort, each superseded request kept a connection and a set of
 * server queries alive for a result nobody would read, and the queue walk ran
 * to its last page after the chip had already moved on.
 *
 * Nothing else would notice the abort going away: every existing assertion about
 * this hook is about the *rendered* state, which the `ignore` flag alone keeps
 * correct. So it is pinned from both ends — the hook aborts what it supersedes,
 * and the API wrappers those panels call actually forward the signal.
 *
 * The second half of the file is the same kind of guard for a request that was
 * simply made twice: see the `GET /leads` contract at the bottom.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminApi, CATALOG_PAGE_SIZE } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";

declare global {
  // React's own flag: without it `act()` warns that it is being called outside
  // a React-rendered environment.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let rootIsMounted: boolean;

/** Every signal the hook's loader has been handed, oldest first. */
let signals: AbortSignal[];

/**
 * A loader that behaves the way `fetch` does under an abort: it never settles on
 * its own, and rejects with an `AbortError` the moment the signal fires.
 *
 * A loader that just resolved would not distinguish "the response was discarded"
 * from "the request never happened" — and that distinction is exactly what the
 * cleanup's `ignore`-then-`abort` ordering is for.
 */
function abortableLoader(signal: AbortSignal): Promise<string[]> {
  signals.push(signal);
  return new Promise<string[]>((_resolve, reject) => {
    signal.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")),
    );
  });
}

function Harness({ reloadKey }: { reloadKey: string }) {
  const { error } = useAdminResource<string[]>(abortableLoader, { reloadKey });
  return <span data-testid="error">{error ?? ""}</span>;
}

const errorText = (): string =>
  container.querySelector("[data-testid='error']")?.textContent ?? "";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  signals = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  rootIsMounted = true;
});

afterEach(async () => {
  // The unmount test tears the root down itself; unmounting twice is not
  // something this suite should be depending on.
  if (rootIsMounted) await act(async () => root.unmount());
  container.remove();
});

describe("useAdminResource", () => {
  it("hands the loader a live signal, then aborts it when the query is superseded", async () => {
    await act(async () => root.render(<Harness reloadKey="a" />));
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => root.render(<Harness reloadKey="b" />));
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("does not render a cancelled request as an unreachable API", async () => {
    await act(async () => root.render(<Harness reloadKey="a" />));
    await act(async () => root.render(<Harness reloadKey="b" />));
    // Let the abort's rejection land. It has to be swallowed: the panel did the
    // cancelling, so surfacing it would read "Could not reach the API." for a
    // request that was never expected to answer.
    await act(async () => {
      await Promise.resolve();
    });
    expect(errorText()).toBe("");
  });

  it("aborts the in-flight request when the panel unmounts", async () => {
    await act(async () => root.render(<Harness reloadKey="a" />));
    expect(signals[0].aborted).toBe(false);

    await act(async () => root.unmount());
    rootIsMounted = false;

    expect(signals[0].aborted).toBe(true);
  });
});

/**
 * The hook can only cancel what the loader lets it: the signal has to survive
 * the trip through `adminApi` into `fetch`'s `init`. A wrapper that accepted the
 * argument and dropped it on the floor would leave every test above green while
 * changing nothing at the call site.
 */
describe("the admin API forwards a signal into fetch", () => {
  /** Stub `fetch` and return every `init` it was called with, in order. */
  function captureFetch(body: unknown): RequestInit[] {
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
        seen.push(init);
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return seen;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards it through adminApi.users", async () => {
    const seen = captureFetch({ items: [], total: 0 });
    const controller = new AbortController();

    await adminApi.users({ search: "ada" }, controller.signal);

    expect(seen).toHaveLength(1);
    expect(seen[0].signal).toBe(controller.signal);
  });

  it("forwards it through every page of the college-submission walk", async () => {
    const seen = captureFetch([]);
    const controller = new AbortController();

    await adminApi.collegeSubmissions("pending", controller.signal);

    expect(seen.length).toBeGreaterThan(0);
    for (const init of seen) expect(init.signal).toBe(controller.signal);
  });

  it("stops the college-submission walk when the caller aborts", async () => {
    const controller = new AbortController();
    // A full page is what makes `fetchAllPages` ask for a second one. The stub
    // rejects on an already-aborted signal the way a real `fetch` does, so the
    // walk's *second* request is the one the abort has to prevent.
    const fullPage = Array.from({ length: CATALOG_PAGE_SIZE }, (_, id) => ({ id }));
    let pagesServed = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
        if (init.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        pagesServed += 1;
        // Abort as the first page lands, simulating the status chip changing
        // while the walk is in flight.
        if (pagesServed === 1) controller.abort();
        return new Response(JSON.stringify(fullPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await expect(
      adminApi.collegeSubmissions("pending", controller.signal),
    ).rejects.toThrow();

    expect(pagesServed).toBe(1);
  });
});

/**
 * One `GET /leads` per admin page load.
 *
 * The console shell has to own that fetch: its nav badge shows the lead count on
 * *every* section, not just the dashboard. `DashboardSection` also fetched the
 * same endpoint for the same rows, so opening the console issued two identical
 * requests for data already in hand. The rows now arrive as a prop.
 *
 * Nothing counts requests, so a second call could be reintroduced without a
 * single test changing colour. This reads the two sources and holds them to
 * their halves of the contract.
 */
describe("the dashboard's lead list", () => {
  const read = (relativePath: string): string =>
    readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");

  const SHELL = "frontend/components/admin/AdminDashboard.tsx";
  const SECTION = "frontend/components/admin/sections/DashboardSection.tsx";

  it("is fetched by the console shell", () => {
    const shell = read(SHELL);
    // Not vacuous: the file has to be the one under test and still fetch it.
    expect(shell).toContain("export function AdminDashboard");
    expect(shell).toContain("adminApi.leads()");
  });

  it("is not fetched a second time by the dashboard section", () => {
    const section = read(SECTION);
    // Not vacuous: the read has to have landed on the section, not on an empty
    // string or a stray path.
    expect(section).toContain("export function DashboardSection");
    expect(section).not.toContain("adminApi.leads(");
  });
});
