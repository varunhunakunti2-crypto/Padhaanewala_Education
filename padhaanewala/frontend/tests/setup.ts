import { beforeEach, vi } from "vitest";

/**
 * Global test setup. Phase 7.5.
 *
 * Everything here is a *default* that individual tests may override. The rule is
 * that a test which depends on a stub must say so, and the auth-token suite
 * does — the stubs below are asserted against, not taken on trust, because a
 * silently-unstubbed `navigator.locks` would make the cross-tab test pass
 * vacuously.
 */

// `lib/api.ts` reads `window.localStorage` and writes to it. jsdom provides
// localStorage, but it is per-test-file state, so it is cleared between tests to
// stop one leaking a credential into the next.
beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

/**
 * `AbortSignal.timeout` is used by the refresh path's 10-second bound. Node has
 * had it since 17.3 and jsdom does not always expose it, so it is defined here
 * rather than stubbed — a real timer is more faithful than a fake one and the
 * tests never wait for it to fire.
 */
if (typeof globalThis.AbortSignal?.timeout !== "function") {
  Object.defineProperty(globalThis, "AbortSignal", {
    value: class extends AbortSignal {
      static timeout(ms: number): AbortSignal {
        // `ms` is named in the message rather than discarded: a test that trips
        // this shim then reports the bound it was waiting on, instead of a bare
        // "timed out" with nothing to act on.
        return AbortSignal.abort(
          new DOMException(`The operation timed out after ${ms}ms.`, "TimeoutError"),
        );
      }
    },
    writable: true,
  });
}

/**
 * `fetch` is stubbed by default so that a test which forgets to stub it fails
 * loudly with a clear message instead of reaching the network and hanging.
 * Suites that exercise request behaviour replace this.
 */
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn(() => {
    throw new Error("fetch was called with no stub installed. See tests/setup.ts.");
  }) as typeof fetch;
}
