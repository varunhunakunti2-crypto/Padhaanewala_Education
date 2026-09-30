/**
 * @vitest-environment jsdom
 *
 * The Phase 3 auth token layer. Phase 7.5.
 *
 * ## Why this file is the first frontend test suite written
 *
 * BUG-01 was the most severe defect in the project — sessions that could never
 * be ended — and **225 backend tests passed while it was live**, because no test
 * ever logged out and no test looked at where a token was kept. The lesson was
 * not "add more backend tests"; it was that a whole layer of the system had no
 * checks at all, and the checks that did exist were looking somewhere else.
 *
 * So the first assertions here are the ones that would have caught it:
 *
 *  - the access token is never written to `localStorage`, and
 *  - signing out clears the legacy keys an earlier build left behind.
 *
 * Everything else here is supporting detail. But the two above are written as
 * *negative* assertions on the storage API specifically, because asserting that
 * `getAccessToken()` returns what `storeAuth()` was given proves only that the
 * module is internally consistent — which it was, while it was also cheerfully
 * writing the token to disk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adoptAccessToken,
  broadcastSignOut,
  clearAuth,
  getAccessToken,
  purgeLegacyTokenStorage,
  refreshAccessToken,
  storeAuth,
  storeUser,
  subscribeToAccessToken,
} from "@/lib/api";

const ACCESS = "header.eyJzdWIiOiIxIn0.access-signature";
const NEXT = "header.eyJzdWIiOiIxIn0.rotated-signature";

/** A `Response`-alike. Only the fields `lib/api.ts` actually reads. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("the access token is never persisted", () => {
  beforeEach(() => {
    clearAuth();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("storeAuth leaves localStorage untouched", () => {
    // The whole point of Phase 3.6. A snapshot of the store, not a key lookup,
    // so a future key added by mistake is caught too.
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    storeAuth({ access_token: ACCESS, refresh_token: null });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("hands the token back to the caller", () => {
    storeAuth({ access_token: ACCESS, refresh_token: null });
    expect(getAccessToken()).toBe(ACCESS);
  });

  it("accepts a token that arrived from another tab without persisting it", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    adoptAccessToken(NEXT);
    expect(getAccessToken()).toBe(NEXT);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("clearAuth wipes the in-memory token", () => {
    storeAuth({ access_token: ACCESS, refresh_token: null });
    clearAuth();
    expect(getAccessToken()).toBeNull();
  });

  it("preference data is still persisted, so the change is not a blanket one", () => {
    // Guards against over-correction: the fix is about credentials, not about
    // emptying local storage entirely.
    storeUser({ id: 1, email: "a@example.com", mobile: "9000000000", name: "A" } as never);
    expect(window.localStorage.getItem("cp_user")).toContain("a@example.com");
  });
});

describe("purgeLegacyTokenStorage", () => {
  it("removes the tokens a pre-3.6 build left on disk", () => {
    // These are the exact keys `lib/api.ts` used to write. A browser that signed
    // in before the upgrade still has them, and without this nothing would ever
    // delete them.
    window.localStorage.setItem("cp_access_token", "old-access");
    window.localStorage.setItem("cp_refresh_token", "old-refresh");
    purgeLegacyTokenStorage();
    expect(window.localStorage.getItem("cp_access_token")).toBeNull();
    expect(window.localStorage.getItem("cp_refresh_token")).toBeNull();
  });

  it("leaves preference keys alone", () => {
    window.localStorage.setItem("cp_theme", "dark");
    window.localStorage.setItem("cp_saved", "[]");
    purgeLegacyTokenStorage();
    expect(window.localStorage.getItem("cp_theme")).toBe("dark");
    expect(window.localStorage.getItem("cp_saved")).toBe("[]");
  });

  it("is safe to call when there is nothing to purge", () => {
    expect(() => purgeLegacyTokenStorage()).not.toThrow();
  });
});

describe("storeAuth removes a stale refresh token from disk", () => {
  it("does not leave an old cp_refresh_token behind after a new sign-in", () => {
    // Defensive: nothing in the current code writes it, so this asserts the
    // cleanup rather than the absence of a write.
    window.localStorage.setItem("cp_refresh_token", "stale");
    storeAuth({ access_token: ACCESS, refresh_token: null });
    expect(window.localStorage.getItem("cp_refresh_token")).toBeNull();
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    clearAuth();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges the cookie and holds the new token in memory only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshAccessToken()).resolves.toBe(NEXT);
    expect(getAccessToken()).toBe(NEXT);
    expect(window.localStorage.getItem("cp_access_token")).toBeNull();
  });

  it("sends the Origin header the backend's CSRF check requires", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT }));
    vi.stubGlobal("fetch", fetchMock);

    await refreshAccessToken();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Origin).toBe(window.location.origin);
    // Same-origin, so the HttpOnly cookie is attached without `include`.
    expect(init.credentials).toBe("same-origin");
  });

  it("returns null and does not throw when the session is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("clears a held token when the refresh is refused", async () => {
    // Regression. The first version of `broadcastSignOut` posted the message to
    // sibling tabs and did not clear the local one, so on this path
    // `getAccessToken()` kept handing back a token the server had already
    // rejected: the UI stayed signed-in-looking and every later request
    // re-sent it and re-401'd, one repair attempt at a time. The test that
    // caught it only did so by accident, so it is written out explicitly.
    storeAuth({ access_token: ACCESS, refresh_token: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));

    await refreshAccessToken({ force: true });

    expect(getAccessToken()).toBeNull();
  });

  it("reuses a token it already holds by default, for the boot path", async () => {
    // AppContext calls this with no options: "do I have a token, from anywhere?"
    // If a sibling tab is mid-rotation, taking its broadcast avoids a second
    // rotation — which would be a reuse, and reuse revokes the family.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    adoptAccessToken(ACCESS);

    await expect(refreshAccessToken()).resolves.toBe(ACCESS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces a real rotation when the held token was just rejected", async () => {
    // The other half of the pair, and the bug the regression test above
    // actually exposed: the reuse shortcut was applied to the 401-repair path
    // too, so the refresh returned the same known-bad token, the request was
    // retried with it, 401'd again, and the user got an error while a dead
    // token stayed in memory. Silent, and exactly the shape of BUG-01.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT }));
    vi.stubGlobal("fetch", fetchMock);
    adoptAccessToken(ACCESS);

    await expect(refreshAccessToken({ force: true })).resolves.toBe(NEXT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe(NEXT);
  });

  it("returns null on a transport failure rather than rejecting", async () => {
    // `authReady` in AppContext resolves on this. A rejection here would leave
    // the whole app waiting behind a promise nobody catches.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(refreshAccessToken()).resolves.toBeNull();
  });

  it("shares one request between concurrent callers", async () => {
    // The single-flight property. Without it, a page that fires five requests on
    // mount sends five rotations, and four of them present a rotated-away token
    // and trip reuse detection — signing the user out of every tab.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(results)).toEqual(new Set([NEXT]));
  });

  it("releases the single-flight slot after a failure", async () => {
    // A rejected refresh that left `refreshPromise` set would wedge the session
    // permanently: every later 401 would join a promise that never settles.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    await expect(refreshAccessToken()).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT })));
    await expect(refreshAccessToken()).resolves.toBe(NEXT);
  });
});

describe("cross-tab coordination", () => {
  beforeEach(() => {
    clearAuth();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("broadcasts a rotated token to other tabs", async () => {
    const channel = new BroadcastChannel("cp-access-token");
    const received: unknown[] = [];
    channel.addEventListener("message", (e) => received.push(e.data));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ access_token: NEXT })));
    await refreshAccessToken();

    // BroadcastChannel delivery is a task, not a synchronous call.
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toContainEqual({ type: "access-token", token: NEXT });
    channel.close();
  });

  it("tells other tabs to drop their token on an unrecoverable refresh", async () => {
    const channel = new BroadcastChannel("cp-access-token");
    const received: unknown[] = [];
    channel.addEventListener("message", (e) => received.push(e.data));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    await refreshAccessToken();

    await new Promise((r) => setTimeout(r, 10));
    expect(received).toContainEqual({ type: "signed-out" });
    channel.close();
  });

  it("broadcastSignOut clears the local token too", () => {
    storeAuth({ access_token: ACCESS, refresh_token: null });
    broadcastSignOut();
    expect(getAccessToken()).toBeNull();
  });

  it("a subscriber adopts a token announced by a sibling tab", () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeToAccessToken((t) => seen.push(t));
    const channel = new BroadcastChannel("cp-access-token");
    channel.postMessage({ type: "access-token", token: NEXT });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getAccessToken()).toBe(NEXT);
        expect(seen).toEqual([NEXT]);
        unsubscribe();
        channel.close();
        resolve();
      }, 10);
    });
  });

  it("a subscriber is told when a sibling signs out", () => {
    storeAuth({ access_token: ACCESS, refresh_token: null });
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeToAccessToken((t) => seen.push(t));
    const channel = new BroadcastChannel("cp-access-token");
    channel.postMessage({ type: "signed-out" });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getAccessToken()).toBeNull();
        expect(seen).toEqual([null]);
        unsubscribe();
        channel.close();
        resolve();
      }, 10);
    });
  });

  it("stops delivering after unsubscribe", async () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeToAccessToken((t) => seen.push(t));
    unsubscribe();
    const channel = new BroadcastChannel("cp-access-token");
    channel.postMessage({ type: "access-token", token: NEXT });

    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([]);
    channel.close();
  });
});
