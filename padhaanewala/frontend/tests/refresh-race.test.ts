/**
 * @vitest-environment jsdom
 *
 * Regressions for the refresh single-flight slot. The old code wrapped the
 * rotation in `withDeadline(..., 4_000, null)` and cleared `refreshPromise` in a
 * `finally`. Once the 4s fallback won, that `finally` ran while the POST was
 * still in flight: a second caller could start another rotation with the same
 * single-use refresh cookie and revoke the whole session family.
 *
 * These tests use fake timers so a >4s fetch is instant to run, and a fake
 * BroadcastChannel so sibling-tab messages are delivered deterministically
 * rather than on jsdom's real task queue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NEXT = "header.eyJzdWIiOiIxIn0.rotated-signature";

/** Synchronous BroadcastChannel, including the "never deliver to self" rule. */
class FakeBroadcastChannel {
  static channels = new Set<FakeBroadcastChannel>();
  private listeners = new Set<(event: { data: unknown }) => void>();

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.add(this);
  }

  addEventListener(_type: string, handler: (event: { data: unknown }) => void) {
    this.listeners.add(handler);
  }

  removeEventListener(_type: string, handler: (event: { data: unknown }) => void) {
    this.listeners.delete(handler);
  }

  postMessage(data: unknown) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;
      for (const handler of [...channel.listeners]) handler({ data });
    }
  }

  close() {
    FakeBroadcastChannel.channels.delete(this);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let api: typeof import("@/lib/api");

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  FakeBroadcastChannel.channels.clear();
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  // No Web Locks unless a test installs one explicitly.
  vi.stubGlobal("navigator", { locks: undefined });
  api = await import("@/lib/api");
  api.clearAuth();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("refresh single-flight under a slow rotation", () => {
  it("keeps one in-flight rotation past the 4s deadline and tells siblings it failed", async () => {
    let resolveFirst!: (value: Response) => void;
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return calls === 1
        ? new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(jsonResponse({ access_token: NEXT }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const sibling = new FakeBroadcastChannel("cp-access-token");
    const messages: unknown[] = [];
    sibling.addEventListener("message", (event) => messages.push(event.data));

    const first = api.refreshAccessToken({ force: true });
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(first).resolves.toBeNull();
    expect(messages).toContainEqual({ type: "refresh-failed" });

    // The POST has not settled. Joining it must not start a second one.
    const second = api.refreshAccessToken({ force: true });
    await expect(second).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Only after the underlying chain settles is the slot released.
    resolveFirst(jsonResponse({ access_token: NEXT }));
    await vi.advanceTimersByTimeAsync(0);
    await expect(api.refreshAccessToken({ force: true })).resolves.toBe(NEXT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    sibling.close();
  });

  it("does not start a second rotation while a sibling holds the Web Lock past 1.5s", async () => {
    let heldBySibling = true;
    const requestLock = vi.fn(
      async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<string | null>) =>
        callback(heldBySibling ? null : { mode: "exclusive" }),
    );
    vi.stubGlobal("navigator", { locks: { request: requestLock } });

    let posts = 0;
    const fetchMock = vi.fn(async () => {
      posts += 1;
      return jsonResponse({ access_token: NEXT });
    });
    vi.stubGlobal("fetch", fetchMock);
    const sibling = new FakeBroadcastChannel("cp-access-token");

    const result = api.refreshAccessToken({ force: true });

    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetchMock).not.toHaveBeenCalled();

    // The sibling finishes at 2s: one POST total, announced by its own tab.
    await vi.advanceTimersByTimeAsync(500);
    heldBySibling = false;
    posts += 1;
    sibling.postMessage({ type: "access-token", token: NEXT });

    await expect(result).resolves.toBe(NEXT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(posts).toBe(1);
    sibling.close();
  });

  it("does not self-refresh when the sibling still holds the lock at the deadline", async () => {
    const requestLock = vi.fn(
      async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<string | null>) =>
        callback(null),
    );
    vi.stubGlobal("navigator", { locks: { request: requestLock } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = api.refreshAccessToken({ force: true });
    await vi.advanceTimersByTimeAsync(4_001);

    await expect(result).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(api.getAccessToken()).toBeNull();
  });

  it("waits for the deadline instead of self-refreshing without BroadcastChannel", async () => {
    // No channel means no token/failure announcements from a sibling. The held
    // Web Lock still forbids a second rotation; only the shared abort ends it.
    vi.stubGlobal("BroadcastChannel", undefined);
    const requestLock = vi.fn(
      async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<string | null>) =>
        callback(null),
    );
    vi.stubGlobal("navigator", { locks: { request: requestLock } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = api.refreshAccessToken({ force: true });
    await vi.advanceTimersByTimeAsync(4_001);

    await expect(result).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
