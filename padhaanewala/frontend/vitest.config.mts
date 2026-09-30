import { defineConfig } from "vitest/config";

/**
 * Vitest, added in Phase 7.5.
 *
 * ## Why this exists at all
 *
 * The frontend had **zero** tests of any kind — no runner, no config, no script
 * — while `.gitignore` already ignored `/coverage` for a suite that did not
 * exist. That is not a neutral gap. Two of the project's worst defects were
 * invisible to every check that ran:
 *
 *  - BUG-01, sessions that could never be ended: 225 backend tests passed while
 *    `POST /auth/logout` returned `{"success": true}` and revoked nothing,
 *    because no test ever logged out.
 *  - BUG-05, `lib/api-server.ts` collapsing every non-2xx into an empty result,
 *    so a page-parameter bug presented as a page that renders correctly with
 *    nothing in it.
 *
 * Neither is the kind of thing a build or a linter can see.
 *
 * ## Why jsdom, and what that costs
 *
 * `lib/api.ts` is the layer worth testing and it is browser code: `localStorage`,
 * `BroadcastChannel`, `navigator.locks`, `AbortSignal.timeout`, `fetch`. jsdom
 * gives the first and the last; the other two are stubbed per test, and the
 * stubs are asserted on rather than trusted — see `tests/setup.ts`.
 *
 * The alternative, Playwright against a running app, would test more but cannot
 * gate a pull request in a reasonable time and cannot assert on things like
 * "this module never writes a credential to storage" as directly.
 *
 * ## `environment: "jsdom"` is per-file, not global
 *
 * Most of this codebase is server components and plain data modules that would
 * only get slower under jsdom. The suites that need a DOM opt in with a
 * `@vitest-environment jsdom` docblock, so the default stays `node`.
 *
 * ## Why `resolve.tsconfigPaths` and not a hand-written alias
 *
 * `tsconfig.json` maps `"@/*": ["./frontend/*", "./*"]` — **two** entries, tried
 * in order. `@/components/ui/Button` resolves through the first; `@/lib/nav`
 * through the second, because `frontend/frontend/lib/` does not exist. A Vite
 * `resolve.alias` is a prefix substitution with no notion of "try the next one
 * if that is not a file on disk", so the obvious one-line version of this config
 * silently breaks every `@/lib/*` import. `vite-tsconfig-paths` was the fix
 * first; Vite now supports `resolve.tsconfigPaths` natively, so the plugin and
 * the dependency are gone.
 *
 * That doubled path is load-bearing for roughly 200 imports and is documented
 * in no README, which is worth remembering the next time this config breaks.
 *
 * `.mts`, not `.ts`: loaded as CommonJS, `import.meta.url` in this file is
 * meaningless.
 */
export default defineConfig({
  // See the note above. Do not replace this with `resolve.alias`.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // The default. Suites that need a DOM opt in per file.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      // Only the pure logic layers. Coverage is a tool for finding what is
      // untested, and including 200 components in the denominator makes the
      // number useless for that.
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
      exclude: ["lib/types.ts", "lib/utils.ts", "**/*.d.ts"],
      thresholds: {
        // Deliberately low and deliberate about it. These are floors to catch a
        // new file arriving untested, not a quality score — the suite is small
        // and pretending otherwise would be theatre.
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
  },
});
