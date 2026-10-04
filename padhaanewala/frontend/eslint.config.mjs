import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Coverage output. `npm run test:coverage` writes here and `npm run lint`
    // would otherwise walk the generated `lcov-report` and report on fixtures
    // it does not own. The directory is gitignored (`/coverage`); this keeps it
    // out of the lint pass too.
    "coverage/**",
  ]),
]);

export default eslintConfig;
