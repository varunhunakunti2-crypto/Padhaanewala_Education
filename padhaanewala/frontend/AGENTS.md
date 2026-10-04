Always Use:
- tailwind-4-docs, web-design-guidelines these 2 skills for this project

## The doubled `frontend/frontend/` path is load-bearing

Components live at `frontend/frontend/components/`, **not** `frontend/components/`.
The nesting looks like a mistake and is not one.

`tsconfig.json` maps `@/` to two roots, tried in order:

```json
"paths": { "@/*": ["./frontend/*", "./*"] }
```

- `@/components/...` resolves through the **first** entry. The only directory
  inside `frontend/frontend/` is `components/`, so **255** imports have no
  counterpart under the second entry.
- `@/lib/*`, `@/app/*` and similar fall through to the second, because
  `frontend/frontend/lib/` does not exist. 504 `@/` imports in total.
- Simplifying the array to the conventional `"@/*": ["./*"]` does not tidy
  anything — it moves the single root up one level and **breaks the build**,
  with 255 unresolved imports.
- `vitest.config.mts` uses `resolve.tsconfigPaths: true` instead of a
  `resolve.alias` for exactly this reason: an alias is a prefix substitution
  with no "try the next entry if that is not a file" behaviour, so the obvious
  one-liner silently breaks every `@/lib/*` import.
- `.dockerignore` keeps `frontend/frontend/` inside the build context for the
  same reason, and says so in a comment there.

Converting to the conventional single-root layout is a real refactor, not a
one-line change: move `frontend/frontend/components/` to `frontend/components/`,
rewrite all 255 imports, then simplify the array. Do not take the shortcut of
editing only the array.



<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
