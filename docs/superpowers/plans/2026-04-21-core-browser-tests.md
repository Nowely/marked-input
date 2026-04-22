# Core Browser-Mode Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 28 `packages/core/**/*.spec.ts` files off Node + inline DOM mocks onto Vitest 4 Browser Mode with Playwright Chromium, deleting every `vi.stubGlobal`, `Object.defineProperty(global|globalThis, ...)`, and DOM-faking `vi.mock(...)` call.

**Architecture:** Extend `packages/core/vite.config.ts` with a Vitest `test.browser` block (same Playwright provider and viewport as `packages/storybook`) — no separate `vitest.config.ts`, matches storybook's single-file pattern. Add one shared helper `src/test-utils/dom.ts` (`createEditableDiv` + `cleanup`). Migrate the six DOM-mocking spec files (Bucket A) one per commit. Verify the remaining 22 files (Buckets B + C) pass unchanged.

**Tech Stack:** Vitest 4, `@vitest/browser-playwright`, Playwright ≥ 1.59, TypeScript, pnpm workspaces (catalog dependencies).

**Spec:** `docs/superpowers/specs/2026-04-21-core-browser-tests-design.md`

**Conventions to follow exactly:**
- Tabs for indentation in all TS/JSON source (match existing files).
- Single quotes, no semicolons in `.ts` files.
- Import order: external packages first (alphabetical), blank line, internal relative imports (alphabetical).
- Do **not** add `// ...` narrative comments — see `<making_code_changes>` rule in the repo.
- Run every command from the monorepo root unless stated otherwise.

---

## File Structure

**Create:**
- `packages/core/src/test-utils/dom.ts` — shared DOM helpers (`createEditableDiv`, `cleanup`).

**Modify:**
- `packages/core/package.json` — add two devDependencies.
- `packages/core/vite.config.ts` — switch `defineConfig` import to `vitest/config` and add a `test.browser` block.
- `packages/core/src/features/caret/Caret.spec.ts` — full rewrite, real DOM.
- `packages/core/src/features/caret/TriggerFinder.spec.ts` — drop DOM stubs, keep `vi.mock('./Caret')`.
- `packages/core/src/features/selection/TextSelectionFeature.spec.ts` — replace stubbed `document` with spies on real `document`.
- `packages/core/src/features/focus/FocusFeature.spec.ts` — delete the Node-env guard block.
- `packages/core/src/features/overlay/OverlayFeature.spec.ts` — delete the `document` / `window` stubs.
- `packages/core/src/features/editing/utils/deleteMark.spec.ts` — swap `MockHTMLElement` for real `document.createElement`.

**Touch (verify only, no edits expected):** the other 22 spec files under `packages/core/src/**/*.spec.ts`.

---

## Task 1: Add dependencies and Vitest Browser Mode config

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/vite.config.ts`

- [ ] **Step 1: Add `@vitest/browser-playwright` and `playwright` to `packages/core/package.json`**

Open `packages/core/package.json` and extend `devDependencies`. Preserve alphabetical order (the file uses alphabetical `devDependencies`). Final file:

```json
{
  "name": "@markput/core",
  "type": "module",
  "module": "index.ts",
  "types": "./index.ts",
  "exports": {
    ".": {
      "import": "./index.ts"
    },
    "./styles.module.css": "./styles.module.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "vite build",
    "build:watch": "vite build -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:related": "vitest related",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "coverage": "vitest run --coverage",
    "bench": "vitest bench --run"
  },
  "devDependencies": {
    "@faker-js/faker": "catalog:",
    "@vitest/browser-playwright": "catalog:",
    "@vitest/coverage-v8": "catalog:",
    "@vitest/ui": "catalog:",
    "csstype": "catalog:",
    "playwright": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Run `pnpm install` from the repo root**

Run:

```bash
pnpm install
```

Expected: `+ @vitest/browser-playwright` and `+ playwright` resolved from the catalog (`^4.1.2` and `^1.59.1`). Exit code 0. Workspace lockfile updates.

- [ ] **Step 3: Extend `packages/core/vite.config.ts` with the Browser Mode block**

Overwrite `packages/core/vite.config.ts` with the exact content below (tabs, single quotes, no semicolons). The existing `build.lib` block is preserved verbatim; only the `defineConfig` import changes (from `vite` to `vitest/config`, whose `defineConfig` is a superset that types the `test` field) and a `test.browser` block is appended.

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
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			provider: playwright(),
			instances: [{browser: 'chromium' as const}],
			viewport: {width: 1280, height: 720},
			headless: true,
			screenshotFailures: false,
		},
	},
})
```

- [ ] **Step 4: Confirm Playwright's Chromium is installed locally**

Run:

```bash
pnpm exec playwright install chromium
```

Expected: either "chromium is already installed" or download completes with exit code 0. (CI already runs this in `.github/workflows/CI.yml`, so no pipeline change is needed.)

- [ ] **Step 5: Smoke-run the existing suite in browser mode and capture the baseline failures**

Run:

```bash
pnpm --filter @markput/core test 2>&1 | tee /tmp/core-browser-baseline.log
```

Expected: Playwright launches Chromium. Bucket C specs (parsing, signals, clipboard plain-object, shared/*) should already pass. The six Bucket A files will produce varied errors — the Node-only `Object.defineProperty(global, 'document', ...)` calls now clobber the live browser `document`, so downstream assertions fail. That is the expected baseline and why Tasks 3–8 exist.

Do not try to fix failures in this task. Leave the log for reference in later tasks.

- [ ] **Step 6: Typecheck still passes**

Run:

```bash
pnpm run typecheck
```

Expected: exit code 0. If TS widens `'chromium'` in `instances: [{browser: 'chromium' as const}]`, the `as const` already protects us; if you hit a type error anyway, cross-check against `packages/storybook/vite.config.ts` which uses the same pattern.

- [ ] **Step 7: Confirm `vite build` still works against the modified config**

Run:

```bash
pnpm --filter @markput/core build
```

Expected: exit code 0. The `build.lib` block was preserved; only the `defineConfig` import and the new `test` key changed. `dist/index.js` is emitted the same as before.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json packages/core/vite.config.ts pnpm-lock.yaml
git commit -m "test(core): enable vitest browser mode with playwright"
```

---

## Task 2: Add shared DOM test helpers

**Files:**
- Create: `packages/core/src/test-utils/dom.ts`
- Create: `packages/core/src/test-utils/dom.spec.ts` (self-test for the helper; deleted at the end of this task to avoid shipping speculative tests)

- [ ] **Step 1: Write the helper self-test first**

Create `packages/core/src/test-utils/dom.spec.ts`:

```ts
import {afterEach, describe, expect, it} from 'vitest'

import {cleanup, createEditableDiv} from './dom'

describe('test-utils/dom', () => {
	afterEach(cleanup)

	it('createEditableDiv attaches a contenteditable div to document.body', () => {
		const host = createEditableDiv()
		expect(host.isConnected).toBe(true)
		expect(host.contentEditable).toBe('true')
		expect(host.parentElement).toBe(document.body)
	})

	it('cleanup removes every element created by the helper', () => {
		const a = createEditableDiv()
		const b = createEditableDiv()
		expect(a.isConnected).toBe(true)
		expect(b.isConnected).toBe(true)

		cleanup()

		expect(a.isConnected).toBe(false)
		expect(b.isConnected).toBe(false)
	})

	it('cleanup is idempotent — a second call is a no-op', () => {
		createEditableDiv()
		cleanup()
		expect(() => cleanup()).not.toThrow()
	})
})
```

- [ ] **Step 2: Run the spec and confirm it fails because the module does not exist**

Run:

```bash
pnpm --filter @markput/core test -- src/test-utils/dom.spec.ts
```

Expected: FAIL with `Failed to resolve import "./dom"` or `Cannot find module './dom'`.

- [ ] **Step 3: Implement the helper**

Create `packages/core/src/test-utils/dom.ts`:

```ts
const tracked = new Set<HTMLElement>()

export function createEditableDiv(): HTMLDivElement {
	const element = document.createElement('div')
	element.contentEditable = 'true'
	document.body.appendChild(element)
	tracked.add(element)
	return element
}

export function cleanup(): void {
	for (const element of tracked) {
		element.remove()
	}
	tracked.clear()
}
```

- [ ] **Step 4: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/test-utils/dom.spec.ts
```

Expected: 3 passed. Zero failures. Chromium starts once and the three tests run inside it.

- [ ] **Step 5: Delete the self-test file**

The helper is now verified. Keeping a spec whose only job is to verify a two-function module is YAGNI — the helper is exercised by every Bucket A migration in the tasks that follow.

Run:

```bash
rm packages/core/src/test-utils/dom.spec.ts
```

- [ ] **Step 6: Typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: exit code 0. The helper file is inside the tsconfig include glob, so it is typechecked even though no production code imports it.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/test-utils/dom.ts
git commit -m "test(core): add createEditableDiv + cleanup DOM helpers"
```

---

## Task 3: Migrate `TriggerFinder.spec.ts`

Uses `Object.defineProperty(global, 'document', ...)` and `Object.defineProperty(global, 'Text', ...)` to fake a text-node factory, plus `vi.mock('./Caret')` for dependency isolation. The `vi.mock('./Caret')` is **not** a DOM stub and is kept (per spec §Migration Strategy step 1). Only the DOM fakes are removed; in Browser Mode `document.createTextNode('...')` returns a real `Text` node for free.

**Files:**
- Modify: `packages/core/src/features/caret/TriggerFinder.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/caret/TriggerFinder.spec.ts
```

Expected: FAIL. The `Object.defineProperty(global, 'document', {value: {createTextNode: mockCreateTextNode}})` call replaces the real browser `document` with a stub that lacks almost every other DOM method, so later tests explode.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/caret/TriggerFinder.spec.ts` with:

```ts
/* oxlint-disable no-unsafe-type-assertion */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {Markup} from '../parsing'
import {Caret} from './Caret'
import {TriggerFinder} from './TriggerFinder'

vi.mock('./Caret', () => ({
	Caret: {
		getCurrentPosition: vi.fn(),
		getSelectedNode: vi.fn(),
		getFocusedSpan: vi.fn(),
		isSelectedPosition: true,
	},
}))

const mockGetCurrentPosition = vi.mocked(Caret.getCurrentPosition)
const mockGetSelectedNode = vi.mocked(Caret.getSelectedNode)
const mockGetFocusedSpan = vi.mocked(Caret.getFocusedSpan)

function setIsSelectedPosition(value: boolean): void {
	Object.defineProperty(Caret, 'isSelectedPosition', {value, configurable: true})
}

describe(`Utility: ${TriggerFinder.name}`, () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setIsSelectedPosition(true)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('constructor', () => {
		it('should initialize with caret position data', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('Hello @world')
			expect(finder.node.nodeType).toBe(3)
			expect(finder.dividedText).toEqual({left: 'Hello', right: ' @world'})
			expect(Caret.getCurrentPosition).toHaveBeenCalled()
			expect(Caret.getSelectedNode).toHaveBeenCalled()
			expect(Caret.getFocusedSpan).toHaveBeenCalled()
		})

		it('should handle empty span', () => {
			mockGetCurrentPosition.mockReturnValue(0)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(''))
			mockGetFocusedSpan.mockReturnValue('')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('')
			expect(finder.dividedText).toEqual({left: '', right: ''})
		})

		it('should handle position at end of span', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(span.length)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()

			expect(finder.dividedText).toEqual({left: span, right: ''})
		})
	})

	describe('static find', () => {
		it('should return TriggerFinder instance when position is selected', () => {
			setIsSelectedPosition(true)
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeInstanceOf(Object)
			expect(result?.value).toBe('world')
			expect(result?.source).toBe('@world')
		})

		it('should return undefined when position is not selected', () => {
			setIsSelectedPosition(false)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})
	})

	describe('getDividedTextBy', () => {
		it('should correctly divide text by position', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(7)

			expect(result).toEqual({left: 'Hello @', right: 'world'})
		})

		it('should handle position 0', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(0)

			expect(result).toEqual({left: '', right: 'Hello @world'})
		})

		it('should handle position at end', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(span.length)

			expect(result).toEqual({left: span, right: ''})
		})
	})

	describe('find', () => {
		it('should find trigger match and return OverlayMatch', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toEqual({
				value: 'world',
				source: '@world',
				index: 6,
				span: 'Hello @world test',
				node: expect.objectContaining({nodeType: 3}),
				option: options[0],
			})
		})

		it('should return undefined when no trigger found', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})

		it('should prioritize first matching option', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const options = [
				{trigger: '@', markup: '@[__value__](__meta__)' as Markup},
				{trigger: '#', markup: '#[__value__](__meta__)' as Markup},
			]
			const result = finder.find(options, opt => opt.trigger)

			expect(result?.option).toBe(options[0])
		})
	})

	describe('matchInTextVia', () => {
		it('should return match object when trigger found', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toEqual({word: 'world', annotation: '@world', index: 6})
		})

		it('should return undefined when no left match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toBeUndefined()
		})

		it('should handle custom trigger', () => {
			mockGetCurrentPosition.mockReturnValue(12)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello #world test'))
			mockGetFocusedSpan.mockReturnValue('Hello #world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('#')

			expect(result).toEqual({word: 'world', annotation: '#world', index: 6})
		})
	})

	describe('matchRightPart', () => {
		it('should extract word from right part', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})

		it('should handle no word match', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world!'))
			mockGetFocusedSpan.mockReturnValue('Hello @world!')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: ''})
		})

		it('should extract only word characters', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world! test'))
			mockGetFocusedSpan.mockReturnValue('Hello world! test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})
	})

	describe('matchLeftPart', () => {
		it('should find trigger and word before cursor', () => {
			mockGetCurrentPosition.mockReturnValue(12)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: 'world', annotation: '@world', index: 6})
		})

		it('should return undefined when no match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toBeUndefined()
		})

		it('should handle trigger at start of text', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@hi test'))
			mockGetFocusedSpan.mockReturnValue('@hi test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: 'hi', annotation: '@hi', index: 0})
		})

		it('should handle empty word after trigger', () => {
			mockGetCurrentPosition.mockReturnValue(1)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@ test'))
			mockGetFocusedSpan.mockReturnValue('@ test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: '', annotation: '@', index: 0})
		})
	})

	describe('makeTriggerRegex', () => {
		it('should create regex for trigger', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@')

			expect(regex).toEqual(/@(\w*)$/)
			expect(regex.test('@world')).toBe(true)
			expect(regex.test('Hello @world')).toBe(true)
			expect(regex.test('#world')).toBe(false)
		})

		it('should escape special regex characters', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('.*')

			expect(regex.source).toBe('\\.\\*(\\w*)$')
			expect(regex.test('.*test')).toBe(true)
		})

		it('should handle multi-character triggers', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@@')

			expect(regex).toEqual(/@@(\w*)$/)
			expect(regex.test('@@world')).toBe(true)
			expect(regex.test('@world')).toBe(false)
		})
	})
})
```

Key diffs from the original:
1. Deleted `mockCreateTextNode` + the two `Object.defineProperty(global, ...)` blocks — real browser `document.createTextNode` is used instead.
2. Deleted the manual `Object.defineProperty(Caret, 'isSelectedPosition', ...)` getter/setter — replaced with a single `setIsSelectedPosition` helper that reassigns the mock module's exported value, and declared `isSelectedPosition: true` inside `vi.mock('./Caret', ...)`.
3. Dropped the unused `let mockCaret: typeof Caret` local and the `mockCaret = vi.mocked(Caret)` reassignment.
4. Kept every `it(...)` case and every assertion — no behavior changes.

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/caret/TriggerFinder.spec.ts
```

Expected: all tests pass. No warnings about `document is not defined` or `Cannot read properties of undefined`.

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis" packages/core/src/features/caret/TriggerFinder.spec.ts
```

Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/TriggerFinder.spec.ts
git commit -m "test(core): migrate TriggerFinder.spec off DOM stubs"
```

---

## Task 4: Migrate `OverlayFeature.spec.ts`

The only DOM usage is two top-level `vi.stubGlobal('document' | 'window', ...)` calls. None of the tests actually interact with event listeners on those stubs — they only invoke `controller.enable()` / `controller.disable()` and read store state. Deleting the stubs is sufficient: real browser `document` and `window` already expose `addEventListener` / `removeEventListener` / `getSelection`.

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/overlay/OverlayFeature.spec.ts
```

Expected: FAIL. The top-level `vi.stubGlobal('document', {addEventListener, removeEventListener})` replaces the real browser `document` with a plain object missing `activeElement`, `querySelector`, `body`, etc., breaking the feature's real wiring.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/overlay/OverlayFeature.spec.ts` with:

```ts
import {describe, it, expect, beforeEach} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import type {OverlayFeature} from './OverlayFeature'

const stubMatch: OverlayMatch = {
	value: 'test',
	source: '@',
	span: 'test',
	// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
	node: {} as unknown as Node,
	index: 0,
	option: {},
}

describe('OverlayFeature', () => {
	let store: Store
	let controller: OverlayFeature

	beforeEach(() => {
		store = new Store()
		controller = store.feature.overlay
	})

	describe('enable()', () => {
		it('probes overlay trigger on change when showOverlayOn includes change', () => {
			controller.enable()

			store.emit.change()

			expect(store.state.overlayMatch()).toBeUndefined()

			controller.disable()
		})

		it('should clear overlayMatch when overlayClose is emitted', () => {
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.emit.overlayClose()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should react to change event when showOverlayOn includes change', () => {
			store.setProps({showOverlayOn: 'change'})
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.emit.change()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should not react to change event when showOverlayOn does not include change', () => {
			store.setProps({showOverlayOn: 'selectionChange'})
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.emit.change()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should be idempotent — calling enable twice does not double-subscribe', () => {
			controller.enable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.emit.overlayClose()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('should stop reacting to events after disable', () => {
			controller.enable()
			controller.disable()

			store.state.overlayMatch(stubMatch)

			store.emit.overlayClose()
			store.emit.change()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should allow re-enabling after disable', () => {
			controller.enable()
			controller.disable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.emit.overlayClose()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})
})
```

Key diffs from the original:
1. Deleted `stubDocument`, `stubWindow`, and both `vi.stubGlobal(...)` calls.
2. Removed the `vi` import (no mocks left) and the now-unused `vi.clearAllMocks()` inside `beforeEach`.
3. Every test body is unchanged.

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/overlay/OverlayFeature.spec.ts
```

Expected: all 7 tests pass.

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis" packages/core/src/features/overlay/OverlayFeature.spec.ts
```

Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/overlay/OverlayFeature.spec.ts
git commit -m "test(core): migrate OverlayFeature.spec off DOM stubs"
```

---

## Task 5: Migrate `FocusFeature.spec.ts`

The only DOM mocking is a defensive guard `if (!globalThis.document) { ... }` that installs a `FakeHTMLElement`. In Browser Mode `globalThis.document` always exists, so the entire guard is dead code. Delete it. The two `document.createElement('div')` calls inside the tests already work against the real browser.

**Files:**
- Modify: `packages/core/src/features/focus/FocusFeature.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/focus/FocusFeature.spec.ts
```

Expected: likely PASS already — the guard is skipped when `globalThis.document` exists. Still run it and record the result; if it already passes, this task becomes a pure cleanup commit with no behavioral change.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/focus/FocusFeature.spec.ts` with:

```ts
import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

// oxlint-disable-next-line no-unsafe-type-assertion -- test stub for container ref
const stubContainer = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
} as unknown as HTMLDivElement

describe('FocusFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.state.container(stubContainer)
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'focus') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('rendered handler', () => {
		it('always emits sync', () => {
			store.feature.focus.enable()

			const syncSpy = vi.spyOn(store.emit, 'sync')
			store.emit.rendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.feature.focus.disable()
		})

		it('runs caret recovery and clears recovery state when Mark is set', () => {
			store.setProps({Mark: () => null})
			store.feature.focus.enable()

			const target = document.createElement('div')
			Object.defineProperty(target, 'isConnected', {value: true, configurable: true})
			store.nodes.focus.target = target
			store.state.recovery({anchor: store.nodes.focus, caret: 0})

			store.emit.rendered()

			expect(store.state.recovery()).toBeUndefined()

			store.feature.focus.disable()
		})

		it('does not run recovery when Mark is not set', () => {
			store.feature.focus.enable()

			store.state.recovery({anchor: store.nodes.focus, caret: 0})

			store.emit.rendered()

			expect(store.state.recovery()).toBeDefined()

			store.feature.focus.disable()
		})
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			store.feature.focus.enable()
			store.feature.focus.disable()

			const syncSpy = vi.spyOn(store.emit, 'sync')
			store.emit.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears nodes.focus.target', () => {
			store.feature.focus.enable()

			store.nodes.focus.target = document.createElement('div')
			expect(store.nodes.focus.target).toBeDefined()

			store.feature.focus.disable()

			expect(store.nodes.focus.target).toBeUndefined()
		})
	})
})
```

Key diffs from the original:
1. Deleted the entire `if (!globalThis.document) { … }` block (lines 11–30 of the original).
2. Deleted the "Mock document.createElement if not available" comment.
3. Every test body is unchanged.

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/focus/FocusFeature.spec.ts
```

Expected: all tests pass.

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis|FakeHTMLElement" packages/core/src/features/focus/FocusFeature.spec.ts
```

Expected: empty output. (The remaining `Object.defineProperty(target, 'isConnected', ...)` is scoped to a test-local element, not a global.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/focus/FocusFeature.spec.ts
git commit -m "test(core): drop Node-env guard in FocusFeature.spec"
```

---

## Task 6: Migrate `TextSelectionFeature.spec.ts`

Replaces the whole-cloth `document` stub with a narrower spy on `addEventListener` / `removeEventListener` on the real browser `document`. This preserves the behavior the tests actually observe (listener call count, idempotency of `enable`) without substituting the entire global.

**Files:**
- Modify: `packages/core/src/features/selection/TextSelectionFeature.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/selection/TextSelectionFeature.spec.ts
```

Expected: FAIL. `vi.stubGlobal('document', mockDocument)` replaces the real `document` with a two-method object; the feature's real `effect` wiring depends on a richer `document`.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/selection/TextSelectionFeature.spec.ts` with:

```ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('TextSelectionFeature', () => {
	let store: Store
	let addSpy: ReturnType<typeof vi.spyOn>
	let removeSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		addSpy = vi.spyOn(document, 'addEventListener')
		removeSpy = vi.spyOn(document, 'removeEventListener')
		store = new Store()
	})

	afterEach(() => {
		addSpy.mockRestore()
		removeSpy.mockRestore()
	})

	it('enable() sets up the selecting subscription via effect', () => {
		const controller = store.feature.textSelection
		controller.enable()
		expect(addSpy).toHaveBeenCalledTimes(4)
	})

	it('enable() is idempotent — calling twice does not double-subscribe', () => {
		const controller = store.feature.textSelection
		controller.enable()
		const callCount = addSpy.mock.calls.length
		controller.enable()
		expect(addSpy).toHaveBeenCalledTimes(callCount)
	})

	it('disable() removes the reactive subscription', () => {
		const controller = store.feature.textSelection
		controller.enable()
		controller.disable()
		expect(() => store.state.selecting('drag')).not.toThrow()
	})

	it('disable() resets selecting from drag to undefined', () => {
		const controller = store.feature.textSelection
		controller.enable()
		store.state.selecting('drag')
		controller.disable()
		expect(store.state.selecting()).toBe(undefined)
	})

	it('selecting set to "drag" disables contenteditable on container elements', () => {
		const container = document.createElement('div')
		const span = document.createElement('span')
		span.contentEditable = 'true'
		container.appendChild(span)
		document.body.appendChild(container)

		store.state.container(container)

		const controller = store.feature.textSelection
		controller.enable()
		store.state.selecting('drag')

		expect(span.contentEditable).toBe('false')

		container.remove()
	})
})
```

Key diffs from the original:
1. Replaced the `listeners` map + `mockDocument` + `vi.stubGlobal('document', ...)` pattern with two `vi.spyOn` calls on the real `document`. The spies let us assert listener counts without intercepting behavior.
2. Dropped `vi.clearAllMocks()` and the per-test `for (const key of Object.keys(listeners))` reset — spies are re-created per test.
3. In the last test, replaced the plain object `container` / `span` stubs with real DOM elements via `document.createElement`. The assertion that `querySelectorAll('[contenteditable="true"]')` was called is removed — the real behavior we care about is that `span.contentEditable` flips to `'false'`.
4. Append the container to `document.body` so `querySelectorAll` runs against an attached tree, and remove it at the end of the test (this single-use cleanup is cheaper than adopting the shared `cleanup()` helper).

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/selection/TextSelectionFeature.spec.ts
```

Expected: all 5 tests pass.

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis" packages/core/src/features/selection/TextSelectionFeature.spec.ts
```

Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/selection/TextSelectionFeature.spec.ts
git commit -m "test(core): migrate TextSelectionFeature.spec off DOM stubs"
```

---

## Task 7: Migrate `deleteMark.spec.ts`

Replaces the `MockHTMLElement` class (and the top-level `vi.stubGlobal('HTMLElement', ...)` that made it pass `instanceof` checks) with real `document.createElement` calls. The DOM layout the original `setupDOM` helper builds — a container holding `[span1, mark, span2]` with `mark.isContentEditable = false` — maps one-for-one onto real elements.

**Files:**
- Modify: `packages/core/src/features/editing/utils/deleteMark.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/editing/utils/deleteMark.spec.ts
```

Expected: FAIL or unstable. `vi.stubGlobal('HTMLElement', MockHTMLElement)` replaces the browser's `HTMLElement` constructor with a class that does not extend `Element`; any `instanceof HTMLElement` check inside `deleteMark` starts returning `false` for real elements in the rest of the page.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/editing/utils/deleteMark.spec.ts` with:

```ts
import {afterEach, describe, it, expect, vi, beforeEach} from 'vitest'

import {cleanup, createEditableDiv} from '../../../test-utils/dom'
import {Store} from '../../../store/Store'
import type {Token} from '../../parsing'
import {deleteMark} from './deleteMark'

describe('deleteMark', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'system') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
		store.feature.system.enable()
	})

	afterEach(cleanup)

	function setupDOM(): void {
		const container = createEditableDiv()

		const span1 = document.createElement('span')
		span1.textContent = 'hi '
		span1.contentEditable = 'true'

		const mark = document.createElement('span')
		mark.textContent = '@user'
		mark.contentEditable = 'false'

		const span2 = document.createElement('span')
		span2.textContent = ' there'
		span2.contentEditable = 'true'

		container.append(span1, mark, span2)

		store.state.container(container)
		store.nodes.focus.target = mark
	}

	function makeTokens(): Token[] {
		const textToken1 = {type: 'text' as const, content: 'hi ', position: {start: 0, end: 3}}
		// oxlint-disable-next-line no-unsafe-type-assertion
		const markToken = {
			type: 'mark' as const,
			content: '@user',
			value: 'user',
			descriptor: {index: 0},
			children: [],
			position: {start: 3, end: 8},
		} as unknown as Token
		const textToken2 = {type: 'text' as const, content: ' there', position: {start: 8, end: 14}}
		return [textToken1, markToken, textToken2]
	}

	it('should fire event.change after deleting a mark', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(onChange).toHaveBeenCalled()
	})

	it('should merge adjacent text spans after deletion', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(store.state.tokens()).toHaveLength(1)
		expect(store.state.tokens()[0].content).toBe('hi  there')
	})
})
```

Key diffs from the original:
1. Deleted the `MockHTMLElement` class.
2. Deleted the top-level `beforeEach(() => vi.stubGlobal('HTMLElement', MockHTMLElement))` and matching `afterEach(() => vi.unstubAllGlobals())` pair.
3. `setupDOM` now uses `createEditableDiv()` (from the Task 2 helper) as the container and `document.createElement('span')` for each child; `parentElement` / `children` are set automatically by `container.append(...)`.
4. `afterEach(cleanup)` removes the container from `document.body` between tests.
5. Dropped `vi.clearAllMocks()` from the inner `beforeEach` — not required (no cross-test mock state leaks once the global stub is gone).

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/editing/utils/deleteMark.spec.ts
```

Expected: both tests pass.

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis|MockHTMLElement" packages/core/src/features/editing/utils/deleteMark.spec.ts
```

Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/editing/utils/deleteMark.spec.ts
git commit -m "test(core): migrate deleteMark.spec to real DOM"
```

---

## Task 8: Migrate `Caret.spec.ts`

The heaviest file (~426 lines, of which ~70 are mock scaffolding and most of the rest is hand-driven mock state). The rewrite drops every mock and drives `Caret` through real `document.createRange()`, `window.getSelection()`, `document.createTreeWalker()`, and real `<div contenteditable="true">` hosts built via `createEditableDiv()`.

Three tests from the original cannot be preserved verbatim because their preconditions are unreachable in a real browser:

| Original test | Problem | Replacement behaviour tested |
|---|---|---|
| `isSelectedPosition` "should return undefined when no selection" | Chromium's `window.getSelection()` never returns `null`. | Remove test. Covered implicitly by the other two cases. |
| `getCurrentPosition` "should return 0 when no selection" | Same. | Remove test. The `?? 0` branch stays covered by the "empty selection" case below. |
| `getAbsolutePosition` "should return default position when no range" / "no selection" | Same. `getRangeAt(0)` throws instead of returning undefined. | Replace with a single "returns {0,0} when selection has no ranges" test that calls `selection.removeAllRanges()` and expects `try/catch` inside `Caret.getAbsolutePosition` to yield `{left: 0, top: 0}`. |

All other tests are kept with equivalent real-DOM setup.

**Files:**
- Modify: `packages/core/src/features/caret/Caret.spec.ts`

- [ ] **Step 1: Confirm the current file fails in browser mode**

Run:

```bash
pnpm --filter @markput/core test -- src/features/caret/Caret.spec.ts
```

Expected: FAIL with many errors. `Object.defineProperty(global, 'window', ...)` and `Object.defineProperty(global, 'document', ...)` overwrite the live browser globals; the suite never recovers.

- [ ] **Step 2: Replace the full file contents**

Overwrite `packages/core/src/features/caret/Caret.spec.ts` with:

```ts
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {cleanup, createEditableDiv} from '../../test-utils/dom'
import {Caret} from './Caret'

function selectText(host: HTMLElement, start: number, end: number = start): void {
	const textNode = host.firstChild
	if (!textNode) throw new Error('host has no text node')
	const range = document.createRange()
	range.setStart(textNode, start)
	range.setEnd(textNode, end)
	const selection = window.getSelection()
	if (!selection) throw new Error('window.getSelection() returned null')
	selection.removeAllRanges()
	selection.addRange(range)
}

function clearSelection(): void {
	window.getSelection()?.removeAllRanges()
}

describe(`Utility: ${Caret.name}`, () => {
	let host: HTMLDivElement

	beforeEach(() => {
		host = createEditableDiv()
		host.appendChild(document.createTextNode('Hello world'))
	})

	afterEach(() => {
		clearSelection()
		cleanup()
	})

	describe('isSelectedPosition', () => {
		it('should return true when selection is collapsed', () => {
			selectText(host, 5)
			expect(Caret.isSelectedPosition).toBe(true)
		})

		it('should return false when selection is not collapsed', () => {
			selectText(host, 0, 5)
			expect(Caret.isSelectedPosition).toBe(false)
		})
	})

	describe('getCurrentPosition', () => {
		it('should return anchor offset from selection', () => {
			selectText(host, 10)
			expect(Caret.getCurrentPosition()).toBe(10)
		})

		it('should return 0 when selection has no ranges', () => {
			clearSelection()
			expect(Caret.getCurrentPosition()).toBe(0)
		})
	})

	describe('getFocusedSpan', () => {
		it('should return text content of anchor node', () => {
			selectText(host, 3)
			expect(Caret.getFocusedSpan()).toBe('Hello world')
		})

		it('should return empty string when selection has no anchor', () => {
			clearSelection()
			expect(Caret.getFocusedSpan()).toBe('')
		})
	})

	describe('getSelectedNode', () => {
		it('should return anchor node when available', () => {
			selectText(host, 3)
			expect(Caret.getSelectedNode()).toBe(host.firstChild)
		})

		it('should throw when anchor node is detached from the document', () => {
			const detached = document.createElement('div')
			detached.appendChild(document.createTextNode('detached'))

			document.body.appendChild(detached)
			const range = document.createRange()
			range.setStart(detached.firstChild!, 0)
			range.collapse(true)
			window.getSelection()!.removeAllRanges()
			window.getSelection()!.addRange(range)
			detached.remove()

			expect(() => Caret.getSelectedNode()).toThrow('Anchor node of selection is not exists!')
		})

		it('should throw when selection has no anchor', () => {
			clearSelection()
			expect(() => Caret.getSelectedNode()).toThrow('Anchor node of selection is not exists!')
		})
	})

	describe('getAbsolutePosition', () => {
		it('should return a DOMRect-derived position when a range is active', () => {
			selectText(host, 5)
			const result = Caret.getAbsolutePosition()
			expect(typeof result.left).toBe('number')
			expect(typeof result.top).toBe('number')
			expect(Number.isFinite(result.left)).toBe(true)
			expect(Number.isFinite(result.top)).toBe(true)
		})

		it('should return {0,0} when selection has no ranges', () => {
			clearSelection()
			expect(Caret.getAbsolutePosition()).toEqual({left: 0, top: 0})
		})
	})

	describe('trySetIndex', () => {
		it('should swallow errors thrown by setIndex', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			setIndexSpy.mockImplementation(() => {
				throw new Error('Test error')
			})

			expect(() => Caret.trySetIndex(host, 3)).not.toThrow()
			expect(setIndexSpy).toHaveBeenCalledWith(host, 3)

			setIndexSpy.mockRestore()
		})
	})

	describe('setIndex', () => {
		it('should set caret position inside the text node', () => {
			Caret.setIndex(host, 5)

			const selection = window.getSelection()!
			expect(selection.anchorNode).toBe(host.firstChild)
			expect(selection.anchorOffset).toBe(5)
			expect(selection.isCollapsed).toBe(true)
		})

		it('should clamp to the end when offset exceeds text length', () => {
			Caret.setIndex(host, Infinity)

			const selection = window.getSelection()!
			expect(selection.anchorNode).toBe(host.firstChild)
			expect(selection.anchorOffset).toBe('Hello world'.length)
		})

		it('should do nothing when the element has no text nodes', () => {
			const empty = createEditableDiv()

			Caret.setIndex(empty, 5)

			const selection = window.getSelection()!
			expect(selection.anchorNode).not.toBe(empty)
		})
	})

	describe('getCaretIndex', () => {
		it('should calculate caret index from selection range', () => {
			selectText(host, 5)
			expect(Caret.getCaretIndex(host)).toBe(5)
		})

		it('should return 0 when selection has no ranges', () => {
			clearSelection()
			expect(Caret.getCaretIndex(host)).toBe(0)
		})
	})

	describe('setCaretToEnd', () => {
		it('should set position to end of element by delegating to setIndex', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')

			Caret.setCaretToEnd(host)

			expect(setIndexSpy).toHaveBeenCalledWith(host, Infinity)

			setIndexSpy.mockRestore()
		})

		it('should do nothing when element is null', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			Caret.setCaretToEnd(null)
			expect(setIndexSpy).not.toHaveBeenCalled()
			setIndexSpy.mockRestore()
		})

		it('should do nothing when element is undefined', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			Caret.setCaretToEnd(undefined)
			expect(setIndexSpy).not.toHaveBeenCalled()
			setIndexSpy.mockRestore()
		})
	})

	describe('getIndex', () => {
		it('should return anchor offset', () => {
			selectText(host, 7)
			expect(Caret.getIndex()).toBe(7)
		})

		it('should return 0 when selection has no anchor', () => {
			clearSelection()
			expect(Caret.getIndex()).toBe(0)
		})
	})

	describe('setIndex1', () => {
		it('should set caret position via range on the selection anchor', () => {
			selectText(host, 2)

			Caret.setIndex1(5)

			const selection = window.getSelection()!
			const range = selection.getRangeAt(0)
			expect(range.startOffset).toBe(5)
			expect(range.endOffset).toBe(5)
		})

		it('should do nothing when selection has no ranges', () => {
			clearSelection()
			expect(() => Caret.setIndex1(5)).not.toThrow()
		})
	})

	describe('setCaretRightTo (instance method)', () => {
		it('should set caret position inside the existing range endContainer', () => {
			selectText(host, 3)

			const instance = new Caret()
			instance.setCaretRightTo(host, 7)

			const selection = window.getSelection()!
			const range = selection.getRangeAt(0)
			expect(range.startOffset).toBe(7)
			expect(range.endOffset).toBe(7)
		})
	})
})
```

Key diffs from the original (summary):
1. Deleted the ~70 lines of `mockGetSelection`, `mockRange`, `Object.defineProperty(global, 'window'|'document', ...)` scaffolding.
2. Added `selectText(host, start, end?)` and `clearSelection()` helpers that drive real selection state.
3. Every `beforeEach` now builds a fresh `<div contenteditable="true">Hello world</div>` via `createEditableDiv`.
4. `afterEach` clears the selection and runs `cleanup()` so Chromium does not carry selection state between tests.
5. Three unreachable "no selection returned from `getSelection()`" tests replaced with equivalent "selection has no ranges" tests (see the table at the top of this task).
6. `Caret.getIndex` "no selection" assertion changed from `NaN` to `0` because `window.getSelection()?.anchorOffset ?? NaN` evaluates to `0` when ranges are cleared but the `Selection` object still exists (its `anchorOffset` is `0`). This matches the production branch that actually runs in the app.
7. Restored `vi.spyOn(Caret, 'setIndex')` usage per test instead of leaving spies installed across the suite (no shared `vi.restoreAllMocks()` in `afterEach`).

- [ ] **Step 3: Run the spec and confirm it passes**

Run:

```bash
pnpm --filter @markput/core test -- src/features/caret/Caret.spec.ts
```

Expected: all tests pass. If a test fails on `anchorNode` identity, verify the `host.firstChild` text node was not replaced (the `contenteditable` div retains the explicit text node we appended).

- [ ] **Step 4: Confirm no residual DOM-stub patterns remain**

Run:

```bash
grep -nE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis|mockCreatedRange|mockGetSelection" packages/core/src/features/caret/Caret.spec.ts
```

Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/Caret.spec.ts
git commit -m "test(core): migrate Caret.spec to real DOM selection"
```

---

## Task 9: Verify Bucket B specs pass unchanged in browser mode

The spec (§"Bucket B") declares these five files pass as-is because they use type-cast identity stubs, not runtime DOM mocks. This task runs them explicitly to confirm.

**Files (read-only verification):**
- `packages/core/src/store/Store.spec.ts`
- `packages/core/src/features/input/InputFeature.spec.ts`
- `packages/core/src/features/editable/ContentEditableFeature.spec.ts`
- `packages/core/src/features/drag/DragFeature.spec.ts`
- `packages/core/src/shared/classes/NodeProxy.spec.ts`

- [ ] **Step 1: Run the five files in one Vitest invocation**

Run:

```bash
pnpm --filter @markput/core test -- \
  src/store/Store.spec.ts \
  src/features/input/InputFeature.spec.ts \
  src/features/editable/ContentEditableFeature.spec.ts \
  src/features/drag/DragFeature.spec.ts \
  src/shared/classes/NodeProxy.spec.ts
```

Expected: all tests pass with zero warnings about `document is not defined` or `Cannot read properties of undefined (reading 'createElement')`.

- [ ] **Step 2: If any file fails, triage and fix inline**

If a failure occurs, the most likely cause is a test file that reached a DOM API via transitive import (e.g. a test pulled `Store`, which pulled `ContainerFeature`, which uses `document.createElement` at runtime — this is actually fine in Browser Mode, but an assertion comparing `firstChild` identity might surface a subtle diff).

Apply the minimal fix: swap the `{} as HTMLDivElement` cast for a real `document.createElement('div')` call and keep the rest of the test intact. Commit the fix as `test(core): use real element in <file>` and rerun Step 1.

- [ ] **Step 3: Commit (only if Step 2 made edits; skip otherwise)**

```bash
git status
# If changes exist:
git add -A
git commit -m "test(core): switch Bucket B specs to real DOM casts"
```

---

## Task 10: Verify Bucket C specs pass unchanged in browser mode

The spec (§"Bucket C") lists 17 files that do not touch DOM. They should pass in browser mode without edits.

**Files (read-only verification):**

All 17 specs listed under "Bucket C" in the design spec.

- [ ] **Step 1: Run the full core test suite**

Run:

```bash
pnpm --filter @markput/core test 2>&1 | tee /tmp/core-browser-final.log
```

Expected: every one of the 28 `*.spec.ts` files passes. Zero skipped tests. No failures. Vitest's per-file summary should show 6 + 5 + 17 = 28 spec files reported.

- [ ] **Step 2: Confirm zero remaining DOM-stub patterns across the whole package**

Run:

```bash
grep -rnE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis" packages/core/src
```

Expected: empty output. Any hit here must be inspected and, if it is a DOM-faking pattern, scheduled for a follow-up fix in this same task (commit as `test(core): remove leftover DOM stub in <file>`).

- [ ] **Step 3: Confirm no `Fake*` DOM constructors remain**

Run:

```bash
grep -rnE "FakeHTMLElement|MockHTMLElement" packages/core/src
```

Expected: empty output.

---

## Task 11: Final cross-cutting verification

Run every repository-level check the spec's "Success Criteria" lists and fix anything that regressed.

- [ ] **Step 1: Root-level `pnpm test`**

Run:

```bash
pnpm test
```

Expected: all packages pass. The storybook package continues to pass (it was already on browser mode); the core package now passes under browser mode. Total run time increases (~cold Playwright startup per package), but no tests fail.

- [ ] **Step 2: Typecheck the monorepo**

Run:

```bash
pnpm run typecheck
```

Expected: exit code 0. The new `packages/core/vitest.config.ts` and `packages/core/src/test-utils/dom.ts` are inside the tsconfig include glob; any type drift would surface here.

- [ ] **Step 3: Build core**

Run:

```bash
pnpm --filter @markput/core build
```

Expected: exit code 0. `packages/core/dist/` is produced. The `test-utils/` folder is **not** part of the Vite lib entry graph (only `index.ts` is), so it is not bundled unless something in `index.ts` imports from it — which nothing does. No assertion on `dist` contents beyond the build succeeding.

- [ ] **Step 4: Lint and formatting (whole repo)**

Run:

```bash
pnpm run lint
pnpm run format
```

Expected: both exit 0. If lint complains about the new `oxlint-disable-next-line` comments, keep them only where the type cast really requires it (they're all single-line, local-scope disables — no blanket disables).

- [ ] **Step 5: Final grep audit across `packages/core/src/**/*.spec.ts`**

Run:

```bash
grep -rnE "stubGlobal|defineProperty\\(global|defineProperty\\(globalThis|vi\\.mock\\(" packages/core/src --include="*.spec.ts"
```

Expected: **only** `vi.mock('./Caret', ...)` in `TriggerFinder.spec.ts`. Any other match is a regression and must be removed before the task is complete. Per spec §Migration Strategy step 1, dependency mocks that aren't DOM fakes are allowed — but `TriggerFinder.spec.ts` is currently the only legitimate use.

- [ ] **Step 6: Commit any lint/format fixups (only if Step 4 changed files)**

```bash
git status
# If changes exist:
git add -A
git commit -m "chore(core): lint fixups after browser-mode migration"
```

- [ ] **Step 7: Summary of the migration**

The branch now satisfies every bullet in the spec's "Success Criteria":
- All 28 spec files pass under `pnpm --filter @markput/core test`.
- Zero `vi.stubGlobal`, `Object.defineProperty(global|globalThis, ...)`, or DOM-faking `vi.mock(...)` calls remain in `packages/core/src/**/*.spec.ts`.
- `pnpm test` (monorepo root) passes.
- `pnpm run typecheck` passes.
- `pnpm --filter @markput/core build` succeeds; `src/test-utils/dom.ts` is absent from the `index.ts` entry graph.

No further commits are needed. Open the PR.
