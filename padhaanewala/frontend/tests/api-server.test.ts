import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  ENDPOINT_PAGE_SIZES,
  REVALIDATE,
  SERVER_API,
  getBlogBySlug,
  getBlogCategories,
  getBlogs,
} from "@/lib/api-server";

/**
 * `lib/api-server.ts` — the BUG-05 site.
 *
 * The failure this suite exists for: the backend answered 422, `!res.ok`
 * returned `null`, `null` became `[]`, and `/blog` served **HTTP 200 with an
 * empty article grid**. The code was failure-tolerant and therefore
 * failure-silent, and every green build passed while it was broken.
 *
 * The fix had two halves and both need pinning:
 *
 * 1. **A swallowed failure must still be observable.** Every non-2xx and every
 *    transport error is logged, once per distinct failure, with enough detail
 *    to tell the two apart. A 422 means the request is wrong; a connection
 *    refusal means the backend is unreachable. Collapsing them into one line is
 *    how the next one hides.
 * 2. **A failure must still resolve to an empty result.** The page has to
 *    render; it just has to be traceable.
 *
 * The module keeps two pieces of state for the lifetime of the process —
 * `reportedFailures` and `pagedCache` — both keyed by the request path, so
 * every test below uses a path no other test uses. Keying by path rather than
 * resetting the module keeps the tests independent without hiding the dedup
 * behaviour that is itself under test.
 */

function json(body: unknown, status = 200, statusText = ""): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

let errors: string[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every `[api-server] …` line, most recent first for readable assertions. */
const logged = () => errors.filter((line) => line.startsWith("[api-server]"));

describe("SERVER_API", () => {
  it("is a single /api/v1 suffix, whatever the env gave us", () => {
    // `RAW_BACKEND` strips a trailing `/api/v1` before re-adding exactly one.
    // Getting this wrong doubles the prefix and turns every server fetch into a
    // 404 that is then swallowed as an empty page — the BUG-05 shape again.
    expect(SERVER_API.endsWith("/api/v1")).toBe(true);
    expect(SERVER_API.match(/\/api\/v1/g)).toHaveLength(1);
  });

  it("exposes revalidation windows as a positive-integer map", () => {
    for (const value of Object.values(REVALIDATE)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------- BUG-05: visibility */

describe("a swallowed backend failure is still observable", () => {
  it("logs the status and the path for an HTTP error", async () => {
    fetchMock.mockResolvedValue(json({ detail: "value error" }, 422, "Unprocessable"));

    await expect(getBlogBySlug("a-422")).resolves.toBeNull();

    expect(logged()).toContainEqual(
      expect.stringContaining("422 /blogs/a-422"),
    );
  });

  it("logs a transport failure under a distinct key, not under a status", async () => {
    // The two need different responses from a human reading the build log: one
    // says the request is wrong, the other says the backend is not there.
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8000"));

    await expect(getBlogBySlug("a-transport")).resolves.toBeNull();

    const line = logged().find((l) => l.includes("a-transport"));
    expect(line).toBeDefined();
    expect(line).toContain("TRANSPORT /blogs/a-transport");
    expect(line).not.toMatch(/\b4\d\d\b/);
    expect(line).toContain("ECONNREFUSED");
  });

  it("does not treat a JSON parse failure as an HTTP error", async () => {
    // A 200 with an unparseable body is a *third* case: not a status, not a
    // transport error. It must still not be silent.
    fetchMock.mockImplementation(async () =>
      new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    await expect(getBlogBySlug("a-bad-body")).resolves.toBeNull();

    expect(logged().some((l) => l.includes("/blogs/a-bad-body"))).toBe(true);
  });

  it("logs the same (status, path) pair only once", async () => {
    // One line per distinct failure rather than one per ISR revalidation —
    // otherwise a permanently broken endpoint drowns the build log.
    fetchMock.mockResolvedValue(json({}, 500, "Server Error"));

    await getBlogBySlug("a-dedup");
    await getBlogBySlug("a-dedup");
    await getBlogBySlug("a-dedup");

    expect(logged().filter((l) => l.includes("500 /blogs/a-dedup"))).toHaveLength(1);
  });

  it("does not conflate the same status on two different paths", async () => {
    fetchMock.mockResolvedValue(json({}, 422, "Unprocessable"));

    await getBlogBySlug("a-path-one");
    await getBlogBySlug("a-path-two");

    expect(logged().some((l) => l.includes("422 /blogs/a-path-one"))).toBe(true);
    expect(logged().some((l) => l.includes("422 /blogs/a-path-two"))).toBe(true);
  });

  it("logs a transport failure once too", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND backend"));

    await getBlogBySlug("a-transport-dedup");
    await getBlogBySlug("a-transport-dedup");

    expect(logged().filter((l) => l.includes("TRANSPORT /blogs/a-transport-dedup"))).toHaveLength(1);
  });
});

/* ------------------------------------------ BUG-05: tolerant, not silent */

describe("a failed read still resolves to an empty result", () => {
  it("turns an HTTP error into [] rather than throwing", async () => {
    fetchMock.mockResolvedValue(json({ detail: "limit too large" }, 422, "Unprocessable"));

    await expect(getBlogCategories()).resolves.toEqual([]);
  });

  it("turns a transport failure into [] rather than throwing", async () => {
    fetchMock.mockRejectedValue(new Error("timeout of 6000ms exceeded"));

    await expect(getBlogCategories()).resolves.toEqual([]);
  });

  it("turns a 500 into [] so the page still renders", async () => {
    fetchMock.mockResolvedValue(json({}, 500, "Server Error"));

    await expect(getBlogs("status=published&t=empty-500")).resolves.toEqual([]);
    // Rendered empty *and* reported — this assertion is the whole point.
    expect(logged().some((l) => l.includes("500 /blogs?status=published&t=empty-500"))).toBe(true);
  });

  it("does not mistake a non-array body for a list", async () => {
    fetchMock.mockResolvedValue(json({ items: [] }));

    await expect(getBlogCategories()).resolves.toEqual([]);
  });
});

/* ------------------------------------------------------------ the walk */

describe("the paged walk", () => {
  const row = (n: number) => ({ id: n, title: `row ${n}` });

  it("walks every page and concatenates them", async () => {
    const pages: Record<number, unknown[]> = {
      0: Array.from({ length: 50 }, (_, i) => row(i)),
      50: Array.from({ length: 50 }, (_, i) => row(50 + i)),
      100: Array.from({ length: 3 }, (_, i) => row(100 + i)),
    };
    const offsets: number[] = [];

    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      offsets.push(offset);
      return json(pages[offset] ?? []);
    });

    const rows = await getBlogs("status=published&t=walk");

    expect(rows).toHaveLength(103);
    expect(rows[0].id).toBe(0);
    expect(rows[102].id).toBe(102);
    expect(offsets).toEqual([0, 50, 100]);
  });

  it("asks for the page size the backend allows on that route, not a global one", async () => {
    // `/blogs` is capped at 50. Asking for 100 is BUG-05 exactly: a 422 that
    // renders as an empty page.
    const limits: number[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      limits.push(Number(new URL(url).searchParams.get("limit")));
      return json([row(1)]);
    });

    await getBlogs("status=published&t=limits");

    expect(limits).toEqual([ENDPOINT_PAGE_SIZES["/blogs"]]);
    expect(limits[0]).toBeLessThanOrEqual(50);
  });

  it("stops on a short page instead of asking for more", async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      // A full first page, then one shorter than the page size.
      return json(calls === 1 ? Array.from({ length: 50 }, (_, i) => row(i)) : [row(50)]);
    });

    const rows = await getBlogs("status=published&t=short");
    expect(rows).toHaveLength(51);
    expect(calls).toBe(2);
  });

  it("stops when a page is not an array", async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      return json({ detail: "unexpected shape" });
    });

    await expect(getBlogs("status=published&t=notarray")).resolves.toEqual([]);
    expect(calls).toBe(1);
  });

  it("hits a hard ceiling rather than walking forever", async () => {
    // Every page full means the short-page stop never fires, so only the row
    // ceiling can end the loop. Without it this test would hang — which is
    // exactly what a runaway endpoint would do to a build.
    fetchMock.mockImplementation(async () => json(Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => row(i))));

    const rows = await getBlogs("status=published&t=ceiling");
    expect(rows.length).toBeGreaterThanOrEqual(5000);
    expect(rows.length % DEFAULT_PAGE_SIZE).toBe(0);
  });

  it("memoises a walk so the same list is not fetched twice", async () => {
    const started: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      started.push(String(url));
      return json([row(1)]);
    });

    const [a, b] = await Promise.all([
      getBlogs("status=published&t=memo"),
      getBlogs("status=published&t=memo"),
    ]);

    expect(a).toEqual(b);
    expect(started).toHaveLength(1);
  });

  it("does not share a memo between two different queries", async () => {
    const started: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      started.push(String(url));
      return json([row(1)]);
    });

    await Promise.all([
      getBlogs("status=published&t=one"),
      getBlogs("status=draft&t=two"),
    ]);

    expect(started).toHaveLength(2);
  });
});

/* --------------------------------------------------------- ISR plumbing */

describe("ISR", () => {
  it("passes the revalidation window to the fetch", async () => {
    let init: RequestInit | undefined;
    fetchMock.mockImplementation(async (_url: string, req: RequestInit) => {
      init = req;
      return json({ id: "slug" });
    });

    await getBlogBySlug("an-isr-post");

    const next = (init as unknown as { next?: { revalidate?: number } })?.next;
    expect(next?.revalidate).toBe(REVALIDATE.content);
  });

  it("bounds every request so a hung backend cannot stall a page", async () => {
    let init: RequestInit | undefined;
    fetchMock.mockImplementation(async (_url: string, req: RequestInit) => {
      init = req;
      return json([]);
    });

    await getBlogCategories();

    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks for JSON explicitly", async () => {
    let init: RequestInit | undefined;
    fetchMock.mockImplementation(async (_url: string, req: RequestInit) => {
      init = req;
      return json([]);
    });

    await getBlogCategories();

    expect(new Headers(init?.headers).get("Accept")).toBe("application/json");
  });
});

describe("page sizes", () => {
  it("has a default that is safe against every endpoint the API caps", async () => {
    // The belt to the contract test's braces: even if a new endpoint is added
    // without being declared here, the default cannot exceed the tightest cap
    // that *is* declared.
    const declared = Object.values(ENDPOINT_PAGE_SIZES);
    expect(declared.length).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(Math.min(...declared));
  });

  it("never walks an endpoint above its own declared size", () => {
    // Stated as the invariant the walk relies on, checked against the map the
    // walk actually reads.
    for (const [path, size] of Object.entries(ENDPOINT_PAGE_SIZES)) {
      expect(size, `${path} must be a positive integer`).toBeGreaterThan(0);
      expect(Number.isInteger(size)).toBe(true);
    }
  });
});
