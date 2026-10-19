import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `motion/react` is deliberately not a dependency of this project.
 *
 * The hero and the scroll-reveal components used to animate through it, which
 * put the whole animation runtime in the client bundle for a handful of
 * opacity/transform transitions. They are plain CSS now (`app/globals.css`) and
 * the package is removed.
 *
 * Nothing else here would notice the runtime coming back: `npm i motion` makes
 * an import compile again, and a bundle that is quietly tens of kB heavier is
 * exactly the kind of regression that never fails a test. So it is pinned from
 * both ends — no source file may import it, and it may not reappear in
 * `package.json`.
 */

const ROOT = resolve(import.meta.dirname, "..");
const SEARCH_DIRS = ["frontend", "app", "lib"];
const SOURCE = /\.(ts|tsx|mts|cts)$/;
const IMPORT = /from\s+["'](?:motion\/react|framer-motion)["']/;

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (SOURCE.test(entry)) found.push(full);
  }
  return found;
}

describe("the motion/react dependency", () => {
  it("is not imported by any source file", () => {
    const files = SEARCH_DIRS.flatMap((dir) => walk(join(ROOT, dir)));

    // Guard against a vacuous pass: a walker that returned nothing would also
    // have no offenders. The three roots hold well over a hundred modules.
    expect(files.length).toBeGreaterThan(100);

    const offenders = files.filter((file) => IMPORT.test(readFileSync(file, "utf8")));

    // Comments mention the package by name to explain the removal; only a real
    // `from "motion/react"` import is a failure.
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it("is not declared in package.json", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(declared).not.toContain("motion");
    expect(declared).not.toContain("framer-motion");
  });
});
