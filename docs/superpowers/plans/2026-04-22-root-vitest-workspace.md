# Root Vitest Workspace Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root `vite.config.ts` with a `test.workspace` block so that Vitest (and the VSCode Vitest extension) treat `@markput/core` and `@markput/storybook` as isolated workspaces, fixing the duplicate `"vue (chromium)"` project name collision.

**Architecture:** Single new file at the monorepo root: `vite.config.ts`. It uses `defineConfig` from `vitest/config` and lists the two existing package configs in `test.workspace`. No changes to any existing files.

**Tech Stack:** Vitest 4, vite 8, pnpm workspaces.

---

## File Structure

**Create:**
- `vite.config.ts` — root vitest workspace config

**Verify only (no edits expected):**
- `packages/core/vite.config.ts`
- `packages/storybook/vite.config.ts`

---

## Task 1: Create root vite.config.ts and verify

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create the root workspace config**

Create `vite.config.ts` at the monorepo root with the exact content below (tabs, single quotes, no semicolons):

```ts
import {defineConfig} from 'vitest/config'

export default defineConfig({
	test: {
		workspace: ['packages/core/vite.config.ts', 'packages/storybook/vite.config.ts'],
	},
})
```

- [ ] **Step 2: Run core tests via the workspace config**

Run:

```bash
pnpm --filter @markput/core test
```

Expected: exit code 0. All 490 tests pass. The workspace config does not change how `pnpm --filter` resolves individual package test scripts — each package still reads its own `vite.config.ts`.

- [ ] **Step 3: Run storybook tests via the workspace config**

Run:

```bash
pnpm --filter @markput/storybook test
```

Expected: exit code 0. Both react and vue test projects pass.

- [ ] **Step 4: Run root-level `pnpm test`**

Run:

```bash
pnpm test
```

Expected: exit code 0. All packages pass. The root `vite.config.ts` is not executed by `pnpm -r run test` (which runs each package's own `test` script), but it is available for the VSCode Vitest extension to discover.

- [ ] **Step 5: Typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: exit code 0. The root `vite.config.ts` is not inside any package's `tsconfig.json` include glob, so it is not typechecked by `pnpm run typecheck`. Verify it manually:

```bash
pnpm exec tsc --noEmit --project vite.config.ts 2>&1 || echo "Not a tsconfig project — expected. Verify manually:"
pnpm exec tsc --noEmit --esModuleInterop --moduleResolution node --target esnext --module esnext vite.config.ts
```

If the standalone tsc check produces type errors, fix them inline. The `test.workspace` field is typed by `vitest/config`'s `defineConfig`.

- [ ] **Step 6: Verify the VSCode Vitest extension loads without the duplicate project error**

Open the Vitest panel in VSCode and confirm:
1. No `"vue (chromium)" was already defined` error appears.
2. Both `core` and `storybook` test projects are listed as separate workspaces.
3. Individual tests can be run from the extension.

- [ ] **Step 7: Lint and format**

Run:

```bash
pnpm run lint
pnpm run format
```

Expected: both exit 0. If `oxfmt` reports format issues, run `pnpm run format:fix` and re-verify.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add root vitest workspace config for vscode extension"
```
