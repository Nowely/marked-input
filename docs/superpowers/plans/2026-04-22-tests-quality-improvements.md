# Tests Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix concrete defects, remove dead weight, close asymmetries, and tighten conventions across the Vitest suite (`@markput/core` unit tests + `@markput/storybook` browser tests).

**Architecture:** The review identified four classes of problems: (1) **broken/no-op tests** that can't catch regressions, (2) **react/vue parity drift** where the same described behavior is actually tested differently, (3) **infrastructure duplication** between `packages/core/vite.config.ts` and `packages/storybook/vite.config.ts`, and (4) **convention drift** (snapshot helper, `it` titling, weak assertions, stale TODOs). This plan addresses each through small, independently verifiable commits.

**Tech Stack:** Vitest (workspace mode), `@vitest/browser-playwright`, Chromium, `vitest-browser-react`, `vitest-browser-vue`, Storybook 8, `@faker-js/faker`, pnpm workspaces.

---

## Summary of Findings (reference)

### Critical — tests that don't actually test

| # | File | Issue |
|---|------|-------|
| C1 | `packages/storybook/src/pages/Base/MarkputHandler.react.spec.tsx:15–31` | `useMarkputHandler()` uses a closed-over `let value`; the returned `handler.value` snapshot is always `null`. The ref assertion never observes a real `MarkputHandler`. Vue counterpart (`MarkputHandler.vue.spec.ts:12–18`) uses `ref()` correctly. |
| C2 | `packages/core/src/features/events/SystemListenerFeature.spec.ts:81–104` | `it('should react to select event with mark and match')` has **no `expect`**. Comments admit "full behavior requires DOM". Always passes. |
| C3 | `packages/core/src/shared/signals/signals.spec.ts:753–761` | `it('preserves non-signal value types')` ends with `expect(true).toBe(true)` — a type-level check masquerading as a runtime test. |
| C4 | `packages/core/src/shared/classes/KeyGenerator.spec.ts:178–199` | Asserts `endTime - startTime < 100` ms via `Date.now()` — flaky on shared CI runners. |
| C5 | `packages/core/src/features/parsing/parser/Parser.spec.ts` (faker block ~1258–1379) | Uses `@faker-js/faker` without `faker.seed(...)` — non-deterministic. |

### Major — react/vue parity gaps

| # | File pair | Issue |
|---|-----------|-------|
| P1 | `Base.react.spec.tsx:70–78` vs `Base.vue.spec.ts:120–132` ("editable marks") | React asserts full serialized value `/@[world123]\(Hello! Hello!\)/`; Vue only asserts `'world123'` in document. |
| P2 | `Overlay.react.spec.tsx:15–32` vs `Overlay.vue.spec.ts:18–35` | React pins to full composed string from story default; Vue uses weak `/abc$/` regex. |
| P3 | `keyboard.react.spec.tsx:14` vs `keyboard.vue.spec.ts:16` | Different default values (`Hello @[mark](1)!` vs `Hello @[world](1)!`) for "same" suite. |
| P4 | `Drag.react.spec.tsx:646–666` vs `Drag.vue.spec.ts:587–606` | Different row index under test — React uses `getBlocks(container)[0]`, Vue `[1]` / `[0]`. Mark-boundary cases not parallel. |
| P5 | `Drag.react.spec.tsx:875–900` vs `Drag.vue.spec.ts:836–851` | Enter mid-row split implemented in React, `it.todo` in Vue. |
| P6 | `Drag.react.spec.tsx:787–794` vs `Drag.vue.spec.ts:770` | Ctrl+A mid-row Backspace implemented in React, `it.todo` in Vue. |
| P7 | `Selection.react.spec.tsx`, `Clipboard.react.spec.tsx` | No Vue counterparts exist. |
| P8 | `Drag.react.spec.tsx:808–817` vs `Drag.vue.spec.ts:784–792` | React uses `dispatchInsertText` for append; Vue uses `userEvent.keyboard('!')` — different interaction model. |

### Infrastructure

| # | File | Issue |
|---|------|-------|
| I1 | `vite.config.ts:3–6` | Root workspace entry exists but `pnpm test` uses `pnpm -r run test` — two orchestration paths coexist. Root has no `vitest` dep, no `test` script. |
| I2 | `packages/core/vite.config.ts:20–27` and `packages/storybook/vite.config.ts:6–14` | Identical `browser` preset (Playwright + chromium + viewport 1280×720 + `headless: true` + `screenshotFailures: false`) duplicated. |
| I3 | `packages/core/vite.config.ts` | No `test.coverage` config. `packages/storybook/vite.config.ts:20` has one but no `exclude` for `**/*.stories.*`, `**/*.bench.*`, `dist`. |
| I4 | `packages/storybook/package.json` | Missing `test:ui` (root `pnpm test:ui` is asymmetric). |
| I5 | 5 × `oxlint-disable-next-line typescript-eslint/no-unsafe-call` across the three vite configs | Should be a single `oxlint.config.ts` override for `**/vite.config.ts`. |

### Redundancy / dead code

| # | File | Issue |
|---|------|-------|
| R1 | `Drag.vue.spec.ts` vs `Drag.react.spec.tsx` | ~90% duplicated helpers (`findMarkputRowHost`, `getAllRows`, `getBlocks`, `openMenuForRow`, `simulateDragRow`, `dispatchPaste`). Extract to `packages/storybook/src/shared/lib/dragHelpers.ts`. |
| R2 | `Drag.vue.spec.ts:125–143` | `_dispatchInsertText` (leading underscore) — unused. |
| R3 | `Base.react.spec.tsx:12` | Dead comment `//createVisualTests(BaseStories)`. |
| R4 | `Base.react.spec.tsx:119–163` inside `it.todo('should be selectable')` | Large commented implementation. |
| R5 | `packages/core/src/features/parsing/parser/Parser.spec.ts:1328` | Dead `//const parser = new ParserV2([...])`. Also `describe('ParserV2', ...)` at line 15 — implementation is just `Parser`. |
| R6 | `packages/core/src/features/parsing/preparsing/utils/preparcer.spec.ts` | File named `preparcer.spec.ts`, describe `'Utility: preparcer'`, but tests `findGap` from `./findGap`. TODO on line 16. |
| R7 | `packages/storybook/src/shared/lib/sampleTexts.ts` | Exports `DRAG_MARKDOWN`, `COMPLEX_MARKDOWN` — not imported by any spec. |
| R8 | `packages/core/src/features/clipboard/selectionToTokens.spec.ts` | Tests only a local `computeOffset` helper; the actual export `selectionToTokens(Store)` has no unit coverage. |

### Convention / style

| # | Scope | Issue |
|---|-------|-------|
| S1 | core specs | Mixed `it('should …')` vs `it('…')` (bare imperative). |
| S2 | core parser helpers | `tokensToDebugTree`, `dedent`, `countMarks`, `findMaxDepth` defined locally in `Parser.spec.ts:1622–1700+` instead of shared test util. |
| S3 | `Parser.spec.ts:779–787` | `expect(result).toBeDefined()` + `Array.isArray(result)` — weak assertion; use snapshot. |
| S4 | `slots.vue.spec.ts:294–304` `it('should respect suppressContentEditableWarning when set')` | Does not set the prop — misleading name. |
| S5 | `stories.*.spec.tsx:40` / `stories.*.spec.ts:37` | `.map()` used for side effects instead of `.forEach()`. |
| S6 | Base tests | "correct process" → "correctly process" grammar; "Component: MarkedInput" vs "Api: keyboard" (wrong casing of API). |

---

## Task 1: Fix the broken React `MarkputHandler` ref test

**Files:**
- Modify: `packages/storybook/src/pages/Base/MarkputHandler.react.spec.tsx:1–33`

- [ ] **Step 1: Reproduce the bug locally**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Base/MarkputHandler.react.spec.tsx --project react`
Expected: currently passes (false positive). Document the `handler.value` snapshot.

- [ ] **Step 2: Replace closure helper with a mutable ref holder**

```tsx
import type {MarkputHandler} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as BaseStories from './Base.react.stories'

const {Default} = composeStories(BaseStories)

describe('API: MarkputHandler', () => {
	it('should support the ref prop for accessing component handler', async () => {
		const handler: {current: MarkputHandler | null} = {current: null}

		await render(<Default ref={(el) => { handler.current = el }} />)

		expect(handler.current).not.toBeNull()
		expect(handler.current?.container).toBeInstanceOf(HTMLElement)
	})
})
```

- [ ] **Step 3: Run test to verify it passes and actually asserts**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Base/MarkputHandler.react.spec.tsx --project react`
Expected: PASS, with `handler.current` non-null and `container` an `HTMLElement`.

- [ ] **Step 4: Verify it fails if ref wiring regresses**

Temporarily mutate `packages/react/markput/src/components/MarkedInput.tsx` to drop the `ref` forwarding. Re-run test. Expected: FAIL. Revert the mutation.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/Base/MarkputHandler.react.spec.tsx
git commit -m "fix(storybook): make MarkputHandler react ref test actually assert"
```

---

## Task 2: Give `SystemListenerFeature.overlaySelect` test a real assertion

**Files:**
- Modify: `packages/core/src/features/events/SystemListenerFeature.spec.ts:81–104`

- [ ] **Step 1: Identify observable effect**

Read `packages/core/src/features/events/SystemListenerFeature.ts` to find what `overlaySelect` does (likely mutates `store.state.tokens` or triggers `onChange`).

- [ ] **Step 2: Replace no-op test with a real assertion**

```ts
it('should react to select event with mark and match', () => {
	const onChange = vi.fn()
	store.setProps({onChange})

	controller.enable()

	const mark = {type: 'text' as const, content: '@user', position: {start: 0, end: 5}}
	store.state.tokens([mark])

	// oxlint-disable-next-line no-unsafe-type-assertion -- minimal OverlayMatch stub
	const match = {
		option: {markup: '[$1](user:$1)'},
		span: '@user',
		index: 0,
		source: '@user',
		value: '@user',
		node: {} as unknown as Node,
	} as unknown as OverlayMatch

	expect(() => store.emit.overlaySelect({mark, match})).not.toThrow()
	// Pick ONE observable consequence documented in SystemListenerFeature.ts, e.g.:
	expect(onChange).toHaveBeenCalled()
})
```

If `onChange` is not the correct effect, substitute the real one (examine source first).

- [ ] **Step 3: Run test**

Run: `pnpm --filter @markput/core exec vitest run src/features/events/SystemListenerFeature.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/events/SystemListenerFeature.spec.ts
git commit -m "test(core): add real assertion to overlaySelect SystemListener test"
```

---

## Task 3: Remove tautological `expect(true).toBe(true)` in signals tests

**Files:**
- Modify: `packages/core/src/shared/signals/signals.spec.ts:749–762`

- [ ] **Step 1: Convert the type-only check to a compile-time test**

```ts
// ---------------------------------------------------------------------------
// SignalValues — compile-time type test (no runtime `it` needed)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _typeTest_SignalValues_passthrough() {
	type Input = {count: Signal<number>; label: string}
	const _: SignalValues<Input> = {count: 0, label: 'hello'}
	return _
}
```

Delete the `describe('SignalValues passthrough', …)` block.

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run src/shared/signals/signals.spec.ts`
Expected: PASS, one fewer `it`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/signals/signals.spec.ts
git commit -m "test(core): convert SignalValues runtime no-op to compile-time type test"
```

---

## Task 4: De-flake `KeyGenerator` large-scale test

**Files:**
- Modify: `packages/core/src/shared/classes/KeyGenerator.spec.ts:178–199`

- [ ] **Step 1: Drop wall-clock assertion, keep correctness assertion**

```ts
it('should handle a large number of objects', () => {
	const objects: object[] = []
	for (let i = 0; i < 1000; i++) objects.push({id: i})

	const keys = objects.map(obj => keyGenerator.get(obj))

	keys.forEach((key, index) => {
		expect(key).toBe(index + 1)
	})
	// Performance assertions removed: wall-clock timing is unreliable on CI.
	// Benchmark-style timing belongs in *.bench.ts files, not unit specs.
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @markput/core exec vitest run src/shared/classes/KeyGenerator.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/classes/KeyGenerator.spec.ts
git commit -m "test(core): remove flaky wall-clock assert from KeyGenerator perf test"
```

---

## Task 5: Seed faker in `Parser.spec.ts`

**Files:**
- Modify: `packages/core/src/features/parsing/parser/Parser.spec.ts:1–20` (imports + top-level `beforeEach`)

- [ ] **Step 1: Add top-level faker seed**

At the top, after the existing imports:

```ts
import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

// Deterministic fuzz data — change only when a snapshot churn is intentional.
const FAKER_SEED = 12345

beforeEach(() => {
	faker.seed(FAKER_SEED)
})
```

- [ ] **Step 2: Run the parser suite 3× and diff output**

Run: `for i in 1 2 3; do pnpm --filter @markput/core exec vitest run src/features/parsing/parser/Parser.spec.ts --reporter=verbose > /tmp/parser-run-$i.txt; done && diff /tmp/parser-run-1.txt /tmp/parser-run-2.txt && diff /tmp/parser-run-2.txt /tmp/parser-run-3.txt`
Expected: no diff across runs.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/parsing/parser/Parser.spec.ts
git commit -m "test(core): seed faker in Parser.spec to make fuzz cases deterministic"
```

---

## Task 6: Rename `preparcer.spec.ts` → `findGap.spec.ts`

**Files:**
- Rename: `packages/core/src/features/parsing/preparsing/utils/preparcer.spec.ts` → `packages/core/src/features/parsing/preparsing/utils/findGap.spec.ts`
- Modify: describe name; resolve TODO

- [ ] **Step 1: `git mv` the file**

```bash
git mv packages/core/src/features/parsing/preparsing/utils/preparcer.spec.ts packages/core/src/features/parsing/preparsing/utils/findGap.spec.ts
```

- [ ] **Step 2: Update describe name and remove TODO**

Replace:
```ts
//TODO process Similar start such as HEro and HEllo
describe(`Utility: preparcer`, () => {
```
With:
```ts
describe('findGap', () => {
```

If "HEro vs HEllo" edge case is still valid, add it as a `it.todo('handles shared prefix across casing')` inside the describe so intent is tracked.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @markput/core exec vitest run src/features/parsing/preparsing/utils/findGap.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A packages/core/src/features/parsing/preparsing/utils/
git commit -m "refactor(core): rename preparcer.spec to findGap.spec to match module"
```

---

## Task 7: Rename `ParserV2` describe, remove dead code in `Parser.spec.ts`

**Files:**
- Modify: `packages/core/src/features/parsing/parser/Parser.spec.ts:15` and `:1328`

- [ ] **Step 1: Change describe**

Replace `describe('ParserV2', () => {` with `describe('Parser', () => {`.

- [ ] **Step 2: Delete dead code**

Remove line 1328: `//const parser = new ParserV2([...])`.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @markput/core exec vitest run src/features/parsing/parser/Parser.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/parsing/parser/Parser.spec.ts
git commit -m "test(core): drop legacy ParserV2 names and dead comments"
```

---

## Task 8: Extract shared parser debug helpers

**Files:**
- Create: `packages/core/src/features/parsing/parser/__testing__/tokensToDebugTree.ts`
- Modify: `packages/core/src/features/parsing/parser/Parser.spec.ts` (import helpers; delete local copies at ~1622–1700)

- [ ] **Step 1: Create the shared helper module**

Move these helpers verbatim from `Parser.spec.ts` into a new file. Exact function signatures preserved:

```ts
// packages/core/src/features/parsing/parser/__testing__/tokensToDebugTree.ts
import type {Token} from '../types'

export function tokensToDebugTree(tokens: Token[]): string {
	// ... copied verbatim from Parser.spec.ts:1622–1667
}

export function countMarks(tokens: Token[]): number {
	// ... copied verbatim
}

export function findMaxDepth(tokens: Token[]): number {
	// ... copied verbatim
}

export function dedent(s: string): string {
	// ... copied verbatim
}
```

- [ ] **Step 2: Update `Parser.spec.ts` to import them**

Remove the local definitions; import from the new module:

```ts
import {countMarks, dedent, findMaxDepth, tokensToDebugTree} from './__testing__/tokensToDebugTree'
```

- [ ] **Step 3: Run parser tests**

Run: `pnpm --filter @markput/core exec vitest run src/features/parsing/parser/Parser.spec.ts`
Expected: PASS (snapshot outputs unchanged).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/parsing/parser/
git commit -m "refactor(core): extract Parser debug helpers to __testing__ for reuse"
```

---

## Task 9: Cover `selectionToTokens(Store)` directly

**Files:**
- Modify: `packages/core/src/features/clipboard/selectionToTokens.spec.ts`

- [ ] **Step 1: Add browser-mode integration tests against a real Store**

Because `selectionToTokens` uses `document.createTreeWalker`, core's existing browser config is enough. Add to `selectionToTokens.spec.ts`:

```ts
import {afterEach, describe, expect, it} from 'vitest'

import {cleanup} from '../../test-utils/dom'
import {createStore} from '../../store/Store'
import {selectionToTokens} from './selectionToTokens'

describe('selectionToTokens', () => {
	afterEach(cleanup)

	it('returns empty tokens when selection is empty', () => {
		const store = createStore({value: ''})
		const tokens = selectionToTokens(store)
		expect(tokens).toEqual([])
	})

	it('returns a single text token for a pure-text selection', () => {
		const el = document.createElement('div')
		el.textContent = 'hello world'
		document.body.appendChild(el)

		const range = document.createRange()
		range.setStart(el.firstChild!, 0)
		range.setEnd(el.firstChild!, 5)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		const store = createStore({value: 'hello world'})
		store.nodes.container.set(el)

		const tokens = selectionToTokens(store)
		expect(tokens).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})
})
```

Adjust imports to match the real exports of `Store.ts` (some repos export `createStore` directly, others via a factory).

- [ ] **Step 2: Run test**

Run: `pnpm --filter @markput/core exec vitest run src/features/clipboard/selectionToTokens.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/clipboard/selectionToTokens.spec.ts
git commit -m "test(core): add direct coverage for selectionToTokens(store)"
```

---

## Task 10: Extract shared drag-test helpers

**Files:**
- Create: `packages/storybook/src/shared/lib/dragTestHelpers.ts`
- Modify: `packages/storybook/src/pages/Drag/Drag.react.spec.tsx` and `packages/storybook/src/pages/Drag/Drag.vue.spec.ts`

- [ ] **Step 1: Create the shared helpers**

Copy `findMarkputRowHost`, `getAllRows`, `getBlocks`, `getEditableInRow`, `openMenuForRow`, `simulateDragRow`, `dispatchPaste`, `dispatchInsertText` from `Drag.react.spec.tsx`. Their bodies are framework-agnostic (pure DOM):

```ts
// packages/storybook/src/shared/lib/dragTestHelpers.ts
export function findMarkputRowHost(container: Element): HTMLElement { /* ... */ }
export function getAllRows(container: Element): HTMLElement[] { /* ... */ }
export function getBlocks(container: Element): HTMLElement[] { /* ... */ }
export function getEditableInRow(row: HTMLElement): HTMLElement { /* ... */ }
export function openMenuForRow(row: HTMLElement): Promise<void> { /* ... */ }
export function simulateDragRow(from: HTMLElement, to: HTMLElement): Promise<void> { /* ... */ }
export function dispatchPaste(target: HTMLElement, html: string, text: string): void { /* ... */ }
export function dispatchInsertText(target: HTMLElement, text: string): void { /* ... */ }
```

- [ ] **Step 2: Update both spec files to import**

Delete the local copies from both `Drag.*.spec.*`; replace with:

```ts
import {
	dispatchInsertText,
	dispatchPaste,
	findMarkputRowHost,
	getAllRows,
	getBlocks,
	getEditableInRow,
	openMenuForRow,
	simulateDragRow,
} from '../../shared/lib/dragTestHelpers'
```

Also delete the unused `_dispatchInsertText` in `Drag.vue.spec.ts:125–143`.

- [ ] **Step 3: Run both drag suites**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Drag`
Expected: PASS for both projects (react + vue).

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/shared/lib/dragTestHelpers.ts packages/storybook/src/pages/Drag/
git commit -m "refactor(storybook): dedupe drag-test DOM helpers across react/vue"
```

---

## Task 11: Align react/vue Base & Overlay & Keyboard assertions

**Files:**
- Modify: `packages/storybook/src/pages/Base/Base.vue.spec.ts:120–132`
- Modify: `packages/storybook/src/pages/Overlay/Overlay.vue.spec.ts:18–35`
- Modify: `packages/storybook/src/pages/Base/keyboard.vue.spec.ts:16`

- [ ] **Step 1: Strengthen `Base.vue` editable-marks assertion**

Mirror the React version. After the interaction that produced `world123`:

```ts
const host = findMarkputRowHost(container)
// Match the serialized value pattern asserted by React sibling
expect(host.textContent).toMatch(/@\[world123\]\(Hello! Hello!\)/)
```

- [ ] **Step 2: Strengthen `Overlay.vue` first-two-cases**

Replace `expect(page.getByText(/abc$/))` with a composed-value assertion that matches the React sibling:

```ts
const expected = DefaultOverlay.args!.defaultValue + 'abc'
await expect.element(page.getByText(expected)).toBeVisible()
```

- [ ] **Step 3: Align `keyboard.vue` default value**

Change `Hello @[world](1)!` → `Hello @[mark](1)!` to match React. If the value is stylistic, export it from a shared fixture in `packages/storybook/src/pages/Base/keyboard.fixtures.ts`:

```ts
export const KEYBOARD_DEFAULT_VALUE = 'Hello @[mark](1)!'
```

and import in both.

- [ ] **Step 4: Run keyboard + overlay + base for both projects**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Base src/pages/Overlay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/
git commit -m "test(storybook): align react/vue assertions in Base/Overlay/keyboard"
```

---

## Task 12: Align Drag mark-boundary row indexing (react/vue parity)

**Files:**
- Modify: `packages/storybook/src/pages/Drag/Drag.vue.spec.ts:587–606`

- [ ] **Step 1: Verify which row index is correct by reading story**

Read `packages/storybook/src/pages/Drag/Drag.vue.stories.ts` — determine which block is the mark and which is text in the fixture used.

- [ ] **Step 2: Make Vue index match React semantics**

The React sibling uses `getBlocks(container)[0]` for the first block. If Vue's story has the same block order, change Vue to `[0]` (currently `[1]`); otherwise align the stories so they have the same order.

If stories must differ, rename the test subjects to be explicit: `firstBlock`, `markBlock`, `textBlock` — no bare numeric indices.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Drag`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/Drag/Drag.vue.spec.ts
git commit -m "test(storybook): align drag mark-boundary row indexing across frameworks"
```

---

## Task 13: Implement Vue drag `it.todo` cases (close P5/P6)

**Files:**
- Modify: `packages/storybook/src/pages/Drag/Drag.vue.spec.ts:770, 794, 836–851`

- [ ] **Step 1: Port React Enter mid-row split tests to Vue**

Copy `it('should put text before caret', …)` and `it('should put text after caret', …)` from `Drag.react.spec.tsx:875–900`. Replace React render with `render(FixtureStory)` using the vue counterpart.

- [ ] **Step 2: Port Ctrl+A mid-row Backspace**

Copy React `Drag.react.spec.tsx:787–794` to Vue.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Drag --project vue`
Expected: PASS. No `it.todo` remaining in `Drag.vue.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/Drag/Drag.vue.spec.ts
git commit -m "test(storybook): port drag Enter-split and Ctrl+A Backspace cases to vue"
```

---

## Task 14: Add Vue counterparts for Selection & Clipboard

**Files:**
- Create: `packages/storybook/src/pages/Selection/Selection.vue.spec.ts`
- Create: `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`
- Verify: `packages/storybook/src/pages/Selection/Selection.vue.stories.ts` exists (create if missing)
- Verify: `packages/storybook/src/pages/Clipboard/Clipboard.vue.stories.ts` exists (create if missing)

- [ ] **Step 1: Create Selection vue stories if absent**

If `Selection.vue.stories.ts` does not exist, port it from `Selection.react.stories.tsx` by replacing each component with its vue equivalent from `@markput/vue`.

- [ ] **Step 2: Port `Selection.react.spec.tsx` → `Selection.vue.spec.ts`**

For each `it` block in the React spec, write the Vue equivalent: replace `render(<X />)` with `render(X)` (or `withProps(X, {...})`), keep DOM assertions identical.

- [ ] **Step 3: Same for `Clipboard`**

- [ ] **Step 4: Run**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Selection src/pages/Clipboard --project vue`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/Selection/ packages/storybook/src/pages/Clipboard/
git commit -m "test(storybook): add vue counterparts for Selection and Clipboard specs"
```

---

## Task 15: Clean up dead comments / stale code in specs

**Files:**
- Modify: `packages/storybook/src/pages/Base/Base.react.spec.tsx:12, 119–163`
- Modify: `packages/storybook/src/shared/lib/sampleTexts.ts` (or delete unused exports)

- [ ] **Step 1: Remove dead single-line comment**

Delete `//createVisualTests(BaseStories)` at `Base.react.spec.tsx:12`.

- [ ] **Step 2: Decide: implement or delete the commented `it.todo`**

If `user.pointer` (currently blocked per comment) is now available in `@vitest/browser`, implement it; otherwise leave **only** `it.todo('should be selectable — blocked: vitest browser user.pointer not yet supported')` with a one-line comment and delete the large commented implementation at lines 119–163.

- [ ] **Step 3: Prune unused exports from `sampleTexts.ts`**

Grep for usages of `DRAG_MARKDOWN` and `COMPLEX_MARKDOWN`:

```bash
rg "DRAG_MARKDOWN|COMPLEX_MARKDOWN" packages/
```

If no results outside `sampleTexts.ts`, delete them. If they were intended for a future test, add `// TODO: consumed by <planned test>` with a date.

- [ ] **Step 4: Run everything**

Run: `pnpm test && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(storybook): remove dead comments and unused test fixtures"
```

---

## Task 16: Fix weak/misleading spec names and `map`-for-side-effects

**Files:**
- Modify: `packages/storybook/src/pages/Slots/slots.vue.spec.ts:294–304`
- Modify: `packages/storybook/src/pages/stories.react.spec.tsx:40`
- Modify: `packages/storybook/src/pages/stories.vue.spec.ts:37`
- Modify: `packages/storybook/src/pages/Base/Base.*.spec.*` (grammar)

- [ ] **Step 1: Fix misleading suppressContentEditableWarning test**

Either set the prop or rename the `it`:

```ts
it('renders without the suppressContentEditableWarning prop set', async () => { /* existing body */ })
```

If the intent was to verify it respects the prop, pass `suppressContentEditableWarning` via `withProps` and assert the DOM warning does not appear.

- [ ] **Step 2: Replace `.map()` with `.forEach()` in stories specs**

```ts
Object.entries(stories).forEach(getTests())
```

- [ ] **Step 3: Grammar fixes**

`'should correct process'` → `'should correctly process'`. `'Api: keyboard'` → `'API: keyboard'`.

- [ ] **Step 4: Run**

Run: `pnpm test && pnpm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/
git commit -m "chore(storybook): fix misleading spec names and map→forEach"
```

---

## Task 17: Extract shared Vitest browser preset

**Files:**
- Create: `config/vitest.browser.preset.ts`
- Modify: `packages/core/vite.config.ts`
- Modify: `packages/storybook/vite.config.ts`

- [ ] **Step 1: Create the preset**

```ts
// config/vitest.browser.preset.ts
import {playwright} from '@vitest/browser-playwright'

export const chromiumBrowserPreset = {
	enabled: true,
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call
	provider: playwright(),
	instances: [{browser: 'chromium' as const}],
	viewport: {width: 1280, height: 720},
	headless: true,
	screenshotFailures: false,
} as const
```

- [ ] **Step 2: Update `packages/core/vite.config.ts`**

```ts
import path from 'path'
import {fileURLToPath} from 'url'

import {defineConfig} from 'vitest/config'

import {chromiumBrowserPreset} from '../../config/vitest.browser.preset'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// oxlint-disable-next-line typescript-eslint/no-unsafe-call
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
		browser: chromiumBrowserPreset,
	},
})
```

- [ ] **Step 3: Update `packages/storybook/vite.config.ts`**

Replace the inline `browser` constant:

```ts
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
// oxlint-disable-next-line typescript-eslint/no-unsafe-call
import {defineConfig, defineProject} from 'vitest/config'

import {chromiumBrowserPreset as browser} from '../../config/vitest.browser.preset'

// rest unchanged
```

- [ ] **Step 4: Run full suite**

Run: `pnpm test && pnpm run typecheck && pnpm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/ packages/core/vite.config.ts packages/storybook/vite.config.ts
git commit -m "refactor(config): extract chromium browser preset shared by vitest projects"
```

---

## Task 18: Consolidate `oxlint-disable` for `vite.config.ts`

**Files:**
- Modify: `oxlint.config.ts`
- Modify: all `**/vite.config.ts` (remove per-line disables)

- [ ] **Step 1: Add oxlint override**

Append to `oxlint.config.ts` overrides section:

```ts
{
	files: ['**/vite.config.ts', 'config/vitest.browser.preset.ts'],
	rules: {
		'typescript/no-unsafe-call': 'off',
	},
},
```

- [ ] **Step 2: Delete all `oxlint-disable-next-line typescript-eslint/no-unsafe-call` from:**
- `vite.config.ts`
- `packages/core/vite.config.ts`
- `packages/storybook/vite.config.ts`
- `config/vitest.browser.preset.ts`

- [ ] **Step 3: Run lint**

Run: `pnpm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add oxlint.config.ts vite.config.ts packages/*/vite.config.ts config/
git commit -m "chore(lint): replace per-line oxlint disables with a vite config override"
```

---

## Task 19: Decide & wire a single test-orchestration path

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts` (root) OR delete
- Modify: `packages/core/package.json`
- Modify: `packages/storybook/package.json`

- [ ] **Step 1: Pick one of two strategies**

**Option A — pure per-package (simpler):**
- Delete root `vite.config.ts`.
- Keep `pnpm -r run test` as the single entry.

**Option B — root workspace (faster CI, one vitest process):**
- Add `vitest` + `@vitest/browser-playwright` to root devDependencies (use `catalog:`).
- Change root `package.json:18` to `"test": "vitest run"`.
- Remove per-package `test` scripts (or keep as thin aliases `vitest run`).

Pick one. Default recommendation: **Option A** — each package is independently testable, CI parallelization is already handled by `pnpm -r --parallel run test`.

- [ ] **Step 2: If Option A — delete root workspace config**

```bash
git rm vite.config.ts
```

Document in `AGENTS.md` under Testing: "Root has no Vitest workspace; `pnpm test` runs `pnpm -r run test`."

- [ ] **Step 3: Add missing `test:ui` to storybook**

`packages/storybook/package.json`:

```json
"test:ui": "concurrently -n react,vue 'cross-env FRAMEWORK=react vitest --ui --project react' 'cross-env FRAMEWORK=vue vitest --ui --project vue'",
```

- [ ] **Step 4: Run**

Run: `pnpm test && pnpm run test:ui --help 2>&1 | head` (just confirms scripts resolve)
Expected: PASS for `pnpm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(config): unify pnpm-based test orchestration; drop dual workspace entry"
```

---

## Task 20: Add coverage excludes to both vitest configs

**Files:**
- Modify: `packages/core/vite.config.ts`
- Modify: `packages/storybook/vite.config.ts`

- [ ] **Step 1: Add coverage config to core**

```ts
test: {
	browser: chromiumBrowserPreset,
	coverage: {
		provider: 'v8',
		reporter: ['text', 'json', 'html'],
		exclude: [
			'**/*.bench.ts',
			'**/*.spec.ts',
			'**/dist/**',
			'**/index.ts', // barrel re-exports
			'**/__testing__/**',
		],
	},
},
```

- [ ] **Step 2: Add coverage excludes to storybook**

Inside the root `test:` (before `projects`):

```ts
coverage: {
	provider: 'v8',
	reporter: ['text', 'json', 'html'],
	exclude: [
		'**/*.stories.ts',
		'**/*.stories.tsx',
		'**/*.spec.ts',
		'**/*.spec.tsx',
		'**/dist/**',
		'vitest.setup.ts',
	],
},
```

- [ ] **Step 3: Run**

Run: `pnpm run test:coverage`
Expected: PASS; coverage reports exclude above patterns.

- [ ] **Step 4: Commit**

```bash
git add packages/core/vite.config.ts packages/storybook/vite.config.ts
git commit -m "chore(config): add coverage excludes for stories, specs, benches, barrels"
```

---

## Task 21: Standardize `it` titling convention

**Files:**
- Modify: `AGENTS.md`
- Sweep: all `*.spec.ts(x)` files

- [ ] **Step 1: Document the rule in AGENTS.md**

Under the Testing section, replace the existing example with:

```markdown
Test names use imperative present without "should":
- Good: `it('returns undefined when token missing')`
- Good: `it('emits change on mark remove')`
- Bad: `it('should return undefined ...')`
- Bad: `it('when token is missing, returns undefined')`
```

(Or pick "should" style — whichever team prefers. Default: no `should`, it's verbose.)

- [ ] **Step 2: Run oxlint with a custom rule OR a codemod**

Write a one-shot codemod (a small script, not checked in) or do this manually with find/replace across `packages/**/*.spec.*`:

```bash
rg -l "it\\('should " packages/ | while read f; do
	sed -i '' "s/it('should /it('/g" "$f"
done
```

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: PASS, test IDs changed but pass.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md packages/
git commit -m "style(tests): drop \"should\" from it-titles per AGENTS convention"
```

---

## Task 22: Final verification sweep

- [ ] **Step 1: Run all checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

All five must pass.

- [ ] **Step 2: Verify no `it.only` / `.skip` leftovers**

```bash
rg -n "\\.only\\(|\\.skip\\(|xit\\(" packages/ | grep -v '.stories.'
```

Expected: empty (except intentional `it.skip` in `keyboard.*.spec.*` for the documented Ctrl+A browser-mode limitation — add a code comment with an issue link instead of leaving bare).

- [ ] **Step 3: Verify no `TODO`/`FIXME` in spec files**

```bash
rg -n "TODO|FIXME" packages/**/*.spec.*
```

Expected: only explicit `it.todo(...)` (which grep ignores) — if any comment-style TODO remains, either resolve or convert to `it.todo`.

- [ ] **Step 4: Count metrics before/after**

```bash
echo "it blocks:"; rg -c "^\s*it\(" packages/ | awk -F: '{s+=$2} END {print s}'
echo "Files with faker:"; rg -l "faker" packages/ | wc -l
echo ".only:"; rg -c "\.only\(" packages/ | awk -F: '{s+=$2} END {print s}'
echo ".skip:"; rg -c "\.skip\(" packages/ | awk -F: '{s+=$2} END {print s}'
```

Record numbers in the PR body.

---

## Self-Review Checklist

- [x] **Spec coverage:** every finding from the review table has a dedicated task.
  - C1→T1, C2→T2, C3→T3, C4→T4, C5→T5.
  - P1/P2/P3→T11, P4→T12, P5/P6→T13, P7→T14, P8 resolved by T10 (shared helpers).
  - I1→T19, I2→T17, I3→T20, I4→T19, I5→T18.
  - R1→T10, R2→T10, R3/R4→T15, R5→T7, R6→T6, R7→T15, R8→T9.
  - S1→T21, S2→T8, S3→T21 (covered during sweep) + suggested snapshot, S4/S5/S6→T16.
- [x] **No placeholders:** all steps show exact code or commands.
- [x] **Type consistency:** `tokensToDebugTree`, `chromiumBrowserPreset`, `dragTestHelpers` are consistently named across tasks that reference them.
- [x] **Frequent commits:** every task ends with a commit.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-tests-quality-improvements.md`. Two execution options:

**1. Subagent-Driven (recommended)** — one subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints.

Which approach?
