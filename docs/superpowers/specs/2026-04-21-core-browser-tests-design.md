# Core Package: Browser-Mode Tests

**Date:** 2026-04-21
**Status:** Approved

## Problem

The `@markput/core` package has 28 `*.spec.ts` files that currently run in plain Node.js with no DOM polyfill. Every test touching DOM APIs (Selection, Range, TreeWalker, `document`, `window`, `HTMLElement`) sets up its own inline stubs via `vi.stubGlobal`, `Object.defineProperty(global, ...)`, or `vi.mock`. There is no shared DOM infrastructure.

Concrete problems:

- **Fragile tests** — inline mocks diverge from real browser behavior (Selection edge cases, Range collapse semantics, TreeWalker filter rules).
- **High maintenance** — the six spec files that mock DOM globals carry hundreds of lines of duplicated setup. `Caret.spec.ts` is the largest at ~426 lines, mostly mock scaffolding.
- **False confidence** — tests pass against mocks, not against the real APIs the feature ships with.

## Decision

Move **all** core spec files to Vitest Browser Mode with Playwright (Chromium). Delete inline DOM mocks. Every `*.spec.ts` runs against real browser DOM APIs.

**Tacit win:** any module (including transitive imports) that reads `window` / `document` at import time runs in a real browser context, so you avoid Node-only failures that plain `stubGlobal` cannot fix for load-time side effects.

## Configuration

### Extend `packages/core/vite.config.ts`

Merge the Browser Mode block into the existing Vite config — same pattern as `packages/storybook/vite.config.ts`. Import `defineConfig` from `vitest/config` (a superset of `vite`'s `defineConfig` that also types the `test` field), add a `test.browser` block, and keep the existing `build.lib` entry for `vite build`. No separate `vitest.config.ts` is added; both `vite build` and `vitest run` read this single file.

```ts
import path from 'path'
import {fileURLToPath} from 'url'

import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	build: {
		lib: {
			entry: path.resolve(__dirname, './index.ts'),
			name: 'MarkputCore',
			formats: ['es'],
			fileName: 'index',
		},
	},
	test: {
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{browser: 'chromium' as const}],
			viewport: {width: 1280, height: 720},
			headless: true,
			screenshotFailures: false,
		},
	},
})
```

Notes:

- `vitest/config`'s `defineConfig` is used instead of `vite`'s so the `test` field is typed; the existing `build` block is untouched and `vite build` continues to work unchanged.
- **Default `test.include`:** Vitest 4 uses `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` ([Vitest config](https://vitest.dev/config/)), so `src/test-utils/dom.ts` is never collected as a test file. Add an explicit `include: ['src/**/*.spec.ts']` only if you want to narrow the glob beyond the default. `.bench.ts` files are outside that pattern and stay on the `vitest bench` path.
- `pnpm test:ui` / `pnpm test:related` still spin up the browser provider like `vitest run`; expect the same cold-start cost until the process is warm.
- No `setupFiles` needed yet; add later if a shared before/after hook emerges.

### Dependencies

Add to `packages/core/package.json` devDependencies (both already pinned in `pnpm-workspace.yaml`):

- `@vitest/browser-playwright: "catalog:"`
- `playwright: "catalog:"`

### Test scripts

No changes needed — `"test": "vitest run"` already works.

### CI

`.github/workflows/CI.yml` already runs `pnpm exec playwright install --with-deps chromium` in the `tests` job before `pnpm test`. No pipeline change required.

## Migration Scope

All 28 spec files are listed explicitly. Each falls into one of three buckets based on whether it currently mocks DOM globals at runtime.

### Bucket A — Remove inline DOM mocks (6 files)

These files fake DOM globals via `vi.stubGlobal`, `Object.defineProperty(global, ...)` / `Object.defineProperty(globalThis, ...)`, or hand-rolled objects installed on `global`. `TriggerFinder.spec.ts` also uses `vi.mock('./Caret')` for dependency isolation (not browser DOM); step 1 covers how to handle that alongside DOM stub removal.

| File | Mocks currently used |
|---|---|
| `features/caret/Caret.spec.ts` | Selection, Range, TreeWalker, `document`, `window` |
| `features/caret/TriggerFinder.spec.ts` | `document`, `Text` constructor, `vi.mock('./Caret')` |
| `features/selection/TextSelectionFeature.spec.ts` | `document.addEventListener` / `removeEventListener` |
| `features/focus/FocusFeature.spec.ts` | `document`, `HTMLElement` constructor |
| `features/overlay/OverlayFeature.spec.ts` | `window`, `document` |
| `features/editing/utils/deleteMark.spec.ts` | `HTMLElement` |

### Bucket B — Uses type-cast identity stubs, works as-is (5 files)

These files cast plain objects to DOM types (`{} as HTMLDivElement`, `{firstChild: null} as unknown as HTMLDivElement`, `{} as HTMLElement`) purely for reference-identity or shape checks. No runtime DOM methods are called, so they pass in browser mode without changes. Rewriting to use real elements is optional cleanup, not a blocker.

- `store/Store.spec.ts`
- `features/input/InputFeature.spec.ts`
- `features/editable/ContentEditableFeature.spec.ts`
- `features/drag/DragFeature.spec.ts`
- `shared/classes/NodeProxy.spec.ts`

### Bucket C — No DOM interaction, works as-is (17 files)

Pure logic tests or tests using in-memory custom node classes. No edits required for browser mode; verify in the migration PR.

- `features/parsing/ParseFeature.spec.ts`
- `features/parsing/parser/Parser.spec.ts`
- `features/parsing/parser/core/SegmentMatcher.spec.ts`
- `features/parsing/parser/utils/annotate.spec.ts`
- `features/parsing/parser/utils/denote.spec.ts`
- `features/parsing/parser/utils/toString.spec.ts`
- `features/parsing/preparsing/utils/preparcer.spec.ts`
- `features/events/SystemListenerFeature.spec.ts`
- `features/mark/MarkHandler.spec.ts`
- `features/clipboard/selectionToTokens.spec.ts` (custom `MockNode` class, not DOM)
- `features/clipboard/pasteMarkup.spec.ts` (plain object stubs)
- `shared/escape.spec.ts`
- `shared/checkers/assertNonNullable.spec.ts`
- `shared/classes/KeyGenerator.spec.ts`
- `shared/signals/signals.spec.ts`
- `shared/signals/computed.spec.ts`
- `shared/utils/shallow.spec.ts`

Total: 6 + 5 + 17 = 28.

## Test Infrastructure

### DOM test helpers: `packages/core/src/test-utils/dom.ts`

Shared helpers for Bucket A rewrites. Placed under `src/test-utils/` so it’s reachable by `tsconfig` without implying Jest-style magic. `packages/core/tsconfig.json` includes all `**/*.ts` under the package, so `pnpm typecheck` typechecks this file even though consumers never import it. `vite build` uses the sole lib entry `index.ts`; the helper stays out of `dist/` unless the entry graph imports it.

```ts
export function createEditableDiv(): HTMLDivElement
export function cleanup(): void
```

- `createEditableDiv()` — creates a `<div contenteditable="true">`, appends to `document.body`, returns it. Tracks the element for `cleanup()` to remove.
- `cleanup()` — removes every element created by the helpers from the DOM. Call from `afterEach`. Keep the helper **idempotent** (e.g. clear an internal list after removal) so nested `describe` blocks can each register `afterEach(cleanup)` without assuming a fixed teardown order beyond Vitest’s normal `afterEach` LIFO behavior.

Only add more helpers when a second spec file genuinely needs them; avoid speculative API surface.

**Import convention:**

```ts
import {cleanup, createEditableDiv} from '../../test-utils/dom'
```

## Migration Strategy

For each file in Bucket A:

1. Delete every `vi.stubGlobal`, `Object.defineProperty(global|globalThis, ...)`, and DOM-faking `vi.mock(...)` call. Leave dependency mocks as their own decision (e.g. keep `vi.mock('./Caret')` in `TriggerFinder.spec.ts`, swap in a real `Caret`, or rewrite assertions)—do not remove them while stripping DOM stubs.
2. Delete the corresponding `beforeEach` / `afterEach` setup and teardown blocks.
3. Replace faked elements with real ones via `createEditableDiv()` or direct `document.createElement(...)`.
4. Call real `document.createRange()`, `window.getSelection()`, `document.createTreeWalker(...)` directly — drop the stub layer.
5. Add a single `afterEach(cleanup)` per `describe` block that attaches elements to the body.
6. Drop assertions that only verified mock plumbing (e.g. `expect(createRangeMock).toHaveBeenCalled()`). Keep assertions that verify observable behavior.

For files in Bucket B: no edits required. A follow-up cleanup PR can swap the type-cast stubs for real elements where it improves readability.

For files in Bucket C: no edits required. Confirm they still pass in browser mode.

### Example transformation (`Caret.spec.ts`)

**Before (Node + mocks):** *Illustrative excerpt—the real `Caret.spec.ts` also mocks `createTreeWalker`, `Range` geometry, `document.createElement`, etc.; the point is replacing global `Object.defineProperty` / `vi.fn` DOM shims.*

```ts
beforeEach(() => {
	Object.defineProperty(global, 'document', {
		value: {createRange: vi.fn(() => ({setStart: vi.fn(), setEnd: vi.fn()}))},
		writable: true,
	})
	Object.defineProperty(global, 'window', {
		value: {getSelection: vi.fn(() => ({removeAllRanges: vi.fn(), addRange: vi.fn()}))},
		writable: true,
	})
})
```

**After (browser):**

```ts
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {cleanup, createEditableDiv} from '../../test-utils/dom'

describe('Caret', () => {
	let host: HTMLDivElement

	beforeEach(() => {
		host = createEditableDiv()
		host.append(document.createTextNode('hello world'))
	})

	afterEach(cleanup)

	it('collapses the selection to the start of the text node', () => {
		const range = document.createRange()
		range.setStart(host.firstChild!, 0)
		range.collapse(true)
		const selection = window.getSelection()!
		selection.removeAllRanges()
		selection.addRange(range)

		// … exercise Caret and assert against selection.anchorOffset ===0
	})
})
```

The mock `beforeEach` above maps to six lines in the browser example: `let host`, a `beforeEach` with `createEditableDiv()` and a text node, and `afterEach(cleanup)`—the same production code paths without global shims.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Slower local runs (~5–10s cold Playwright startup on first spawn) | Use `pnpm test:watch`; the browser process is reused between runs. |
| Tests that relied on mock behavior may fail | Bucket A rewrites already redesign those tests against real behavior. |
| Flaky layout-dependent assertions | Pin viewport to 1280×720 (matches `packages/storybook`); core specs today do not assert on pixel layout, but a fixed viewport still reduces cross-machine variance. Prefer semantic assertions (selection offsets, tokens). |
| Playwright browser install required on CI | Already handled in the monorepo `tests` job. |
| Coverage tooling differs in browser mode | Vitest documents V8 coverage for browser projects; treat “works unchanged” as **unverified** until you run `pnpm --filter @markput/core test:coverage` on the branch and compare reports to the Node baseline. |

## Success Criteria

- All 28 spec files pass under `pnpm --filter @markput/core test`.
- Zero `vi.stubGlobal`, `Object.defineProperty(global|globalThis, ...)`, or DOM-faking `vi.mock(...)` calls remain in `packages/core/src/**/*.spec.ts`.
- `pnpm test` (monorepo root) passes.
- `pnpm run typecheck` passes.
- `pnpm --filter @markput/core build` (`vite build`) succeeds. `dist/` is gitignored and not compared across branches; `@markput/core` currently exposes source via `exports` and `index.ts` is the only Vite lib entry, so `src/test-utils/dom.ts` must remain absent from that entry graph (no new imports from `index.ts`).
