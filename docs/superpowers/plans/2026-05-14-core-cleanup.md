# Core Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the audit in `docs/superpowers/reviews/2026-05-14-core-cleanup-audit.md` — remove dead code, tighten over-broad exports, deduplicate two near-identical keyboard input pipelines, replace a counter-as-proxy `DomIndex` with an `isIndexed` boolean, and simplify two `effectScope` toggle dances. Findings #4, #5, #21, #24, #27 from that audit are deliberately out of scope.

**Architecture:** Five batched commits, each landable on its own with a green test suite. Phases A–D have no observable behavior change. Phase E tightens two reactive lifetimes (Overlay/Block toggles) — see Phase E for the small documented behavior shift.

**Tech Stack:** TypeScript, Vitest, alien-signals reactive primitives, pnpm monorepo. No new runtime dependencies.

---

## File Structure

### Files deleted

- `packages/core/src/features/parsing/utils/valueParser.ts` (Phase A)
- `packages/core/src/features/parsing/mark_types.ts` (Phase A)
- `packages/core/src/features/block/createNewSpan.ts` (Phase A)
- `packages/core/src/shared/checkers/isFunction.ts` (Phase A)
- `packages/core/src/shared/checkers/isObject.ts` (Phase A)
- `packages/core/src/shared/checkers/assertNonNullable.ts` (Phase A)
- `packages/core/src/shared/checkers/assertNonNullable.spec.ts` (Phase A)

### Files created

- `packages/core/src/features/keyboard/inputRange.ts` (Phase C — extracted shared helpers)

### Files modified (by phase)

- Phase A: `packages/core/src/features/parsing/index.ts`, `packages/core/index.ts`, `packages/core/src/shared/types.ts`, `packages/core/src/shared/checkers/index.ts`, `packages/core/src/shared/checkers/domGuards.ts`, `packages/core/src/shared/editorContracts.ts`, `packages/core/src/features/block/index.ts`.
- Phase B: `packages/core/src/features/parsing/index.ts`, `packages/core/src/features/parsing/parser/types.ts`, `packages/core/src/features/parsing/parser/Parser.ts`, `packages/core/src/features/parsing/parser/Parser.spec.ts`, `packages/core/src/features/parsing/parser/core/TreeBuilder.ts`, `packages/core/src/features/parsing/tokenIndex.ts`, `packages/core/src/features/parsing/TokenModel.ts`, `packages/core/src/features/keyboard/index.ts`, `packages/core/src/features/keyboard/input.ts`, `packages/core/src/features/keyboard/input.spec.ts`, `packages/core/src/features/clipboard/pasteMarkup.ts`, `packages/core/src/features/clipboard/pasteMarkup.spec.ts`, `packages/core/src/features/dom/textOffsets.ts`, `packages/core/src/features/state/ValueModel.ts`, `packages/core/src/features/state/ValueModel.spec.ts`, `packages/core/src/features/selection/SelectionController.ts`, `packages/core/src/features/selection/SelectionController.spec.ts`, `packages/core/src/features/dom/DomModel.spec.ts`, `packages/core/src/store/Store.spec.ts`, `packages/core/src/features/clipboard/ClipboardController.ts`, `packages/core/src/shared/constants.ts`.
- Phase C: `packages/core/src/features/keyboard/inputRange.ts` (new), `packages/core/src/features/keyboard/input.ts`, `packages/core/src/features/keyboard/blockEdit.ts`.
- Phase D: `packages/core/src/features/dom/DomIndexer.ts`, `packages/core/src/features/dom/DomBoundary.ts`, `packages/core/src/features/dom/DomModel.ts`, `packages/core/src/features/dom/DomModel.spec.ts`, `packages/core/src/features/selection/SelectionController.ts`, `packages/core/src/features/selection/SelectionController.spec.ts`, `packages/core/src/shared/editorContracts.ts`.
- Phase E: `packages/core/src/features/overlay/OverlayController.ts`, `packages/core/src/features/block/BlockController.ts`.

---

## Phase A: Pure dead-code deletes

Findings landed: #3 (whole `valueParser.ts`), #14 (`mark_types.ts`), #19 (`createNewSpan.ts`), #9 (`Listener`/`EventKey`), #10 (dead checker exports), #15 (`MarkControllerConstructor`).

These are mechanical deletions with zero non-spec consumers. Single commit.

**Files:**

- Delete: `packages/core/src/features/parsing/utils/valueParser.ts`
- Delete: `packages/core/src/features/parsing/mark_types.ts`
- Delete: `packages/core/src/features/block/createNewSpan.ts`
- Delete: `packages/core/src/shared/checkers/isFunction.ts`
- Delete: `packages/core/src/shared/checkers/isObject.ts`
- Delete: `packages/core/src/shared/checkers/assertNonNullable.ts`
- Delete: `packages/core/src/shared/checkers/assertNonNullable.spec.ts`
- Modify: `packages/core/src/features/parsing/index.ts` — drop `valueParser` and `MarkOptions` re-exports.
- Modify: `packages/core/index.ts` — drop `MarkOptions` re-export.
- Modify: `packages/core/src/shared/types.ts` — delete `Listener`, `EventKey`.
- Modify: `packages/core/src/shared/checkers/index.ts` — drop `isFunction`, `isObject`, `assertNonNullable`, `isTextNode`, `childAt`, `lastHtmlChild`, `htmlTarget` exports.
- Modify: `packages/core/src/shared/checkers/domGuards.ts` — remove the four dead functions.
- Modify: `packages/core/src/shared/editorContracts.ts` — drop `MarkControllerConstructor`.
- Modify: `packages/core/src/features/block/index.ts` — drop `createNewSpan` re-export (verify no other re-export uses it first; the file currently re-exports `createNewSpan` only via `* from './createNewSpan'` if at all).

---

- [ ] **Step A.1: Delete `valueParser.ts` and update its barrel**

Delete the file `packages/core/src/features/parsing/utils/valueParser.ts`.

Edit `packages/core/src/features/parsing/index.ts` — remove line 11 (`export {computeTokensFromValue, parseUnionLabels, getRangeMap, parseWithParser} from './utils/valueParser'`).

- [ ] **Step A.2: Delete `mark_types.ts` and its public re-export**

Delete `packages/core/src/features/parsing/mark_types.ts`.

Edit `packages/core/src/features/parsing/index.ts` — remove line 15 (`export type {MarkOptions} from './mark_types'`).

Edit `packages/core/index.ts` — remove line 50 (`export type {MarkOptions} from './src/features/parsing'`).

- [ ] **Step A.3: Delete `createNewSpan.ts`**

Delete `packages/core/src/features/block/createNewSpan.ts`.

Verify with grep that nothing else in `packages/` imports `createNewSpan`:

```bash
rg -n 'createNewSpan' packages
```

Expected: zero hits after the delete (the only hit before is the file itself). If `packages/core/src/features/block/index.ts` re-exports it, drop that line too.

- [ ] **Step A.4: Drop dead checker modules**

Delete:
- `packages/core/src/shared/checkers/isFunction.ts`
- `packages/core/src/shared/checkers/isObject.ts`
- `packages/core/src/shared/checkers/assertNonNullable.ts`
- `packages/core/src/shared/checkers/assertNonNullable.spec.ts`

Edit `packages/core/src/shared/checkers/index.ts` to read exactly:

```ts
export {firstHtmlChild, htmlChildren, isHtmlElement, nextText, nodeTarget} from './domGuards'
```

Edit `packages/core/src/shared/checkers/domGuards.ts` — drop these four functions and their JSDoc:
- `isTextNode` (lines 6–9)
- `childAt` (lines 11–15)
- `lastHtmlChild` (lines 29–33)
- `htmlTarget` (lines 35–39)

Resulting `domGuards.ts` should expose only: `isHtmlElement`, `htmlChildren`, `firstHtmlChild`, `nodeTarget`, `nextText`. Verify by reading the file.

- [ ] **Step A.5: Drop dead types in `shared/types.ts` and `editorContracts.ts`**

Edit `packages/core/src/shared/types.ts` — delete lines 84–87 (`Listener` and `EventKey`):

```ts
export type Listener<T = unknown> = (e: T) => void

// eslint-disable-next-line @typescript-eslint/no-unused-vars, oxlint-disable-next-line no-wrapper-object-types
export interface EventKey<T = unknown> extends Symbol {}
```

Edit `packages/core/src/shared/editorContracts.ts` — locate `MarkControllerConstructor` and delete its declaration (it sits among the other type aliases; type-only delete).

- [ ] **Step A.6: Typecheck + tests**

Run:

```bash
pnpm run typecheck
pnpm -w exec vitest run packages/core
```

Expected: both pass. If a spec still imports a deleted symbol, the import will throw — switch the spec to inline whatever it needed (none of the deleted symbols are exercised by passing tests, but a stray import will surface).

- [ ] **Step A.7: Commit**

```bash
git add -A packages/core
git commit -m "$(cat <<'EOF'
refactor(core): delete dead modules and exports

Deletes valueParser.ts (public-API shim with zero consumers),
mark_types.ts and its MarkOptions re-export (no importer in tree),
block/createNewSpan.ts (orphaned), and four checker modules
(isFunction, isObject, assertNonNullable + isTextNode/childAt/
lastHtmlChild/htmlTarget). Also drops Listener/EventKey from
shared/types.ts and MarkControllerConstructor from editorContracts.ts.
EOF
)"
```

---

## Phase B: Tighten exports and inline trivial wrappers

Findings landed: #6 (`keyboard/index.ts` re-exports), #11 (`textOffsets` over-broad exports), #12 (`tokenIndex.equals`), #13 (`parsing/index.ts` re-exports of `tokenIndex` helpers), #16 (`marksOnly`), #17 (`clearMarkupPaste`), #18 (`isMarkToken`), #20 (`tokens.serializeRange` wrapper), #22 (`ValueModel.isControlledMode`), #23 (`selection.isUserSelecting` re-export), #25 (`getTargetRanges` wrapper), #26 (`shared/constants` DEFAULTs).

Single commit. No public-package surface change beyond what Phase A already trimmed.

**Files:** see "Phase B" entries in the file structure section above.

---

- [ ] **Step B.1: Drop `parsing/index.ts` re-exports of `tokenIndex` helpers**

Edit `packages/core/src/features/parsing/index.ts`. After Phase A the file should be:

```ts
// Canonical export point for Parser APIs
// Public API for parsing and text manipulation

export {Parser} from './parser/Parser'
export type {Token, TextToken, MarkToken, Markup, ParseOptions} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {toString} from './parser/utils/toString'
export {findToken} from './utils/findToken'
export type {TokenContext} from './utils/findToken'
export {TokenModel} from './TokenModel'
export {createTokenIndex, pathEquals, pathKey, resolvePath, type TokenIndex} from './tokenIndex'
export {MarkController} from './MarkController'
```

Replace the line that re-exports the four `tokenIndex` helpers with a `TokenIndex`-only type re-export:

```ts
export type {TokenIndex} from './tokenIndex'
```

The two in-tree consumers (`DomIndexer.ts`, `TokenModel.ts`) already import directly from `./tokenIndex`. The spec (`tokenIndex.spec.ts`) sits next to the source and already imports `from './tokenIndex'`. No spec changes needed.

Verify with:

```bash
rg -n "from '.*parsing'" packages | rg "createTokenIndex|pathEquals|pathKey|resolvePath"
```

Expected: zero hits.

- [ ] **Step B.2: Drop `tokenIndex.equals`**

Edit `packages/core/src/features/parsing/tokenIndex.ts`. Remove `equals(a, b)` from the `TokenIndex` interface (line 10) and the `equals: pathEquals` line from `createTokenIndex` return value (line 59). `pathEquals` itself stays — `DomIndexer` still imports it directly.

- [ ] **Step B.3: Drop `marksOnly` parse option and `isMarkToken` helper**

Edit `packages/core/src/features/parsing/parser/types.ts`:

- Delete `isMarkToken` (lines 6–8).
- Drop the `marksOnly?: boolean` field and its JSDoc from `ParseOptions` (lines 38–39). The interface should read:

```ts
export interface ParseOptions {
	/** Drop zero-length TextTokens (where start === end) */
	skipEmptyText?: boolean
}
```

Edit `packages/core/src/features/parsing/parser/core/TreeBuilder.ts:255-267`. Replace the `filterTokens` method body with the simplified version:

```ts
private filterTokens(tokens: Token[]): Token[] {
	const {skipEmptyText} = this.options
	if (!skipEmptyText) return tokens

	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}
```

Edit `packages/core/src/features/parsing/parser/Parser.ts:34-41`. In the JSDoc above the constructor, remove the bullet:

```
 *   - `marksOnly` - return only MarkTokens, drop all TextTokens
```

Edit `packages/core/src/features/parsing/parser/Parser.spec.ts`:

- Remove `import {isMarkToken} from './types'` on line 7.
- Replace its only consumer on line 16 (`tokens.find(isMarkToken)`) with `tokens.find((t): t is MarkToken => t.type === 'mark')`. Add `import type {MarkToken} from './types'` if not already imported (add to existing type import line if present).
- Delete the entire `describe('marksOnly', () => { ... })` block at lines 1422–1470 inside `describe('ParseOptions')`.

- [ ] **Step B.4: Drop `keyboard/index.ts` dead re-exports**

Edit `packages/core/src/features/keyboard/index.ts`. New content:

```ts
export {KeyboardController} from './KeyboardController'
```

Edit `packages/core/src/features/keyboard/input.spec.ts` — line 4 already imports from `'./input'`, so no change needed.

Verify with:

```bash
rg -n "handleBeforeInput|handlePaste|replaceAllContentWith|applySpanInput" packages | rg -v 'features/keyboard/input'
```

Expected: zero hits outside `features/keyboard/input`.

- [ ] **Step B.5: Drop `getTargetRanges` wrapper inside `input.ts`**

Edit `packages/core/src/features/keyboard/input.ts`:

- Delete the `getTargetRanges` helper (lines 201–203).
- Replace its single caller in `rawRangeFromInputEvent` (line 176, `const ranges = getTargetRanges(event)`) with `const ranges = event.getTargetRanges()`.

- [ ] **Step B.6: Drop `clearMarkupPaste` and update its only consumer**

Edit `packages/core/src/features/clipboard/pasteMarkup.ts` — delete the `clearMarkupPaste` function and its JSDoc. (Use Read to confirm it's a small standalone export. Do not modify `captureMarkupPaste` / `consumeMarkupPaste`.)

Verify with:

```bash
rg -n 'clearMarkupPaste' packages
```

Expected: only `pasteMarkup.spec.ts` line ~52 still references it (the test we're about to update).

Edit `packages/core/src/features/clipboard/pasteMarkup.spec.ts`:

- Remove `clearMarkupPaste` from the import on line 3:

```ts
import {captureMarkupPaste, consumeMarkupPaste, MARKPUT_MIME} from './pasteMarkup'
```

- Replace the last `it(...)` block (lines 49–54) with one that uses `consumeMarkupPaste` to drain instead:

```ts
	it('consumeMarkupPaste removes pending markup for that container', () => {
		const container = makeContainer()
		captureMarkupPaste(makePasteEvent('@[a](1)'), container)
		consumeMarkupPaste(container)
		expect(consumeMarkupPaste(container)).toBeUndefined()
	})
```

(Identical observable assertion: after a single `consumeMarkupPaste(container)`, the next `consumeMarkupPaste(container)` returns `undefined`.)

- [ ] **Step B.7: Privatize internal helpers in `textOffsets.ts`**

Edit `packages/core/src/features/dom/textOffsets.ts` — turn `nextTextNode`, `splitsSurrogatePair`, `textOffsetFromTreeWalker`, `elementBoundaryOffset` from `export function` into plain `function` declarations. Verify with grep before and after that the only callers live inside this file:

```bash
rg -n 'nextTextNode|splitsSurrogatePair|textOffsetFromTreeWalker|elementBoundaryOffset' packages
```

Expected after the change: only `textOffsets.ts` itself appears.

- [ ] **Step B.8: Inline `ValueModel.isControlledMode`**

Edit `packages/core/src/features/state/ValueModel.ts`. Replace the file with:

```ts
import type {Range} from '../../shared/editorContracts'
import {model} from '../../shared/signals/index.js'
import {replaceInString} from '../../shared/utils'
import type {PropsModel} from './PropsModel'

export class ValueModel {
	readonly current = model<string>({
		default: () => this.props.defaultValue() ?? '',
		get: value => (this.props.value() !== undefined ? (this.props.value() ?? '') : value),
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			this.props.onChange()?.(next)
			return this.props.value() !== undefined ? previous : next
		},
	})

	constructor(private readonly props: PropsModel) {}

	replace(range: Range, replacement: string): boolean {
		if (this.props.readOnly()) return false
		const next = replaceInString(this.current(), range, replacement)
		if (next === undefined) return false
		this.current(next)
		return true
	}
}
```

(Differences vs the current file: `import {computed, model}` → `import {model}`, `isControlledMode` field deleted, two call sites inlined as `this.props.value() !== undefined`. The JSDoc on `replace` is removed since the method body is self-explanatory; if you prefer to keep the doc, do.)

Edit `packages/core/src/features/state/ValueModel.spec.ts`:

- Delete line 11 (`expect(typeof store.value.isControlledMode).toBe('function')`).
- Delete line 14 (`expect(store.value.isControlledMode()).toBe(false)`).
- On line 53, replace `expect(store.value.isControlledMode()).toBe(false)` with a direct prop check:

```ts
		expect(store.props.value()).toBeUndefined()
```

(This is the same observable assertion: after `store.props.set({value: undefined})`, `store.props.value()` is `undefined`, which is exactly the predicate `isControlledMode` was returning the negation of.)

Edit `packages/core/src/store/README.md` — remove the `isControlledMode` mention from the bullet list near line 10.

- [ ] **Step B.9: Drop `SelectionController.isUserSelecting` re-export**

Edit `packages/core/src/features/selection/SelectionController.ts`:

- Remove the `isUserSelecting = this.dom.isUserSelecting` field declaration.
- Replace the internal `this.isUserSelecting()` call in `#applyRangeToDOM` with `this.dom.isUserSelecting()`.

Edit specs that reach in via `selection.isUserSelecting`. The grep results showed three files:

- `packages/core/src/features/dom/DomModel.spec.ts:360` — replace `store.selection.isUserSelecting(true)` with `store.dom.isUserSelecting(true)`.
- `packages/core/src/features/selection/SelectionController.spec.ts` — replace every `store.selection.isUserSelecting(...)` (lines 10, 52, 54, 163, 207, 210) with `store.dom.isUserSelecting(...)`. The line-10 assertion (`expect(typeof store.selection.isUserSelecting).toBe('function')`) becomes redundant — delete that single line.
- `packages/core/src/store/Store.spec.ts:69-86` — replace each `store.selection.isUserSelecting(...)` with `store.dom.isUserSelecting(...)`.

Run:

```bash
rg -n 'selection\.isUserSelecting' packages
```

Expected: zero hits.

- [ ] **Step B.10: Inline `tokens.serializeRange` wrapper**

Edit `packages/core/src/features/parsing/TokenModel.ts` — delete the `serializeRange` method and the `serializeRange as serializeRangeUtil` import (just `import {serializeRange} from './utils/serializeRange'` if you've consolidated).

Edit `packages/core/src/features/clipboard/ClipboardController.ts`:

- Add `import {serializeRange} from '../parsing/utils/serializeRange'` to the imports.
- Replace `this.tokens.serializeRange(raw.value.range)` (line 41) with `serializeRange(this.tokens.current(), raw.value.range)`.

Verify nothing else imported `tokens.serializeRange`:

```bash
rg -n 'tokens\.serializeRange|TokenModel.*serializeRange' packages
```

Expected: zero hits.

- [ ] **Step B.11: Inline `shared/constants` DEFAULT helpers**

Edit `packages/core/src/shared/constants.ts` to read exactly:

```ts
import type {Markup} from '../features/parsing/parser/types'
import type {CoreOption} from './types'

export const KEYBOARD = {
	UP: 'ArrowUp',
	DOWN: 'ArrowDown',
	LEFT: 'ArrowLeft',
	RIGHT: 'ArrowRight',
	END: 'End',
	HOME: 'Home',
	PAGE_DOWN: 'PageDown',
	PAGE_UP: 'PageUp',

	ENTER: 'Enter',
	TAB: 'Tab',
	SPACE: ' ',

	BACKSPACE: 'Backspace',
	DELETE: 'Delete',
	COMMA: ',',

	ESC: 'Escape',
} as const
export type KEYBOARD = (typeof KEYBOARD)[keyof typeof KEYBOARD]

export const DEFAULT_OPTIONS: (CoreOption & {overlay?: {trigger?: string; data?: string[]}})[] = [
	{
		markup: '@[__value__](__meta__)' satisfies Markup,
		overlay: {
			trigger: '@',
			data: [],
		},
	},
]
```

Notes:

- `DEFAULT_OVERLAY_TRIGGER`, `DEFAULT_MARKUP`, `DefaultOverlayConfig`, `DefaultOption` are dropped.
- The literal `'@[__value__](__meta__)'` is asserted with `satisfies Markup` to keep the type assignability check that `DEFAULT_MARKUP: Markup = ...` was providing.
- `DEFAULT_OPTIONS`'s array element type is inlined.
- The "Navigation Keys" / "Whitespace Keys" / etc. comments inside `KEYBOARD` are dropped — purely category headers, no semantic info.

Verify nothing else imports the deleted names:

```bash
rg -n 'DEFAULT_OVERLAY_TRIGGER|DEFAULT_MARKUP|DefaultOverlayConfig|DefaultOption' packages
```

Expected: zero hits.

- [ ] **Step B.12: Run typecheck + full core suite**

```bash
pnpm run typecheck
pnpm -w exec vitest run packages/core
```

Expected: both pass.

- [ ] **Step B.13: Commit**

```bash
git add -A packages/core
git commit -m "$(cat <<'EOF'
refactor(core): tighten dead exports and inline trivial wrappers

- drop parsing/index.ts re-exports of createTokenIndex/pathEquals/
  pathKey/resolvePath (only consumers import directly from
  ./tokenIndex)
- drop TokenIndex.equals (zero callers)
- drop marksOnly ParseOption and isMarkToken helper (only spec
  consumers; remove the marksOnly describe block too)
- drop keyboard/index.ts re-exports of internal helpers
- drop getTargetRanges() no-op wrapper in input.ts
- drop clearMarkupPaste (only spec used it; switch the spec to
  consumeMarkupPaste, same observable behavior)
- privatize four textOffsets helpers (no external callers)
- inline ValueModel.isControlledMode (used only internally)
- drop SelectionController.isUserSelecting re-export of
  DomModel.isUserSelecting and migrate specs
- inline TokenModel.serializeRange wrapper at its single caller
- inline DEFAULT_OVERLAY_TRIGGER / DEFAULT_MARKUP and drop
  DefaultOverlayConfig / DefaultOption helper types
EOF
)"
```

---

## Phase C: Hoist duplicated keyboard helpers

Finding landed: #2 (`input.ts`/`blockEdit.ts` duplication).

Both files declare an identical `InputTargetRange` type, `RawSelectionFailureReason` type, `rawRangeFromInputEvent`, `rawRangeFromTargetRange`, `rawSelectionReason`. Hoist into `keyboard/inputRange.ts`. Behavior unchanged.

**Files:**

- Create: `packages/core/src/features/keyboard/inputRange.ts`
- Modify: `packages/core/src/features/keyboard/input.ts` (replace local copies with import)
- Modify: `packages/core/src/features/keyboard/blockEdit.ts` (same)

---

- [ ] **Step C.1: Write the new shared module**

Create `packages/core/src/features/keyboard/inputRange.ts`:

```ts
import type {BoundaryPositionResult, RawSelectionResult} from '../../shared/editorContracts'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'dom'>

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

export function rawRangeFromInputEvent(store: KbCtx, event: InputEvent): RawSelectionResult {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.dom.readRawSelection()
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: KbCtx, range: InputTargetRange): RawSelectionResult {
	const start = store.dom.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
	const end = store.dom.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')
	if (!start.ok) return {ok: false, reason: rawSelectionReason(start)}
	if (!end.ok) return {ok: false, reason: rawSelectionReason(end)}
	return {
		ok: true,
		value: {
			range:
				start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value},
		},
	}
}

function rawSelectionReason(result: BoundaryPositionResult): RawSelectionFailureReason {
	if (result.ok) return 'invalidBoundary'
	if (result.reason === 'composing') return 'invalidBoundary'
	return result.reason
}
```

Notes:

- Only `rawRangeFromInputEvent` is exported. The other two helpers are private to this module — no caller outside the module needs them.
- `KbCtx` is narrowed to `Pick<Store, 'dom'>` because that's all these helpers actually touch. Each calling file already has its own broader `KbCtx` for the rest of its logic.
- The `InputTargetRange` and `RawSelectionFailureReason` type aliases are local; they don't need to be exported.

- [ ] **Step C.2: Switch `input.ts` to the new module**

Edit `packages/core/src/features/keyboard/input.ts`:

- Remove the local `InputTargetRange` type (lines 10–15).
- Remove the local `RawSelectionFailureReason` type (line 22).
- Remove `rawRangeFromInputEvent` (lines 175–179).
- Remove `rawRangeFromTargetRange` (lines 181–193).
- Remove `rawSelectionReason` (lines 195–199).
- Remove `BoundaryPositionResult` from the imports on line 2 (only used inside the deleted helpers).
- Add `import {rawRangeFromInputEvent} from './inputRange'` (preserve import sort order with the other relative imports).

The remaining file should be under ~190 lines.

- [ ] **Step C.3: Switch `blockEdit.ts` to the new module**

Edit `packages/core/src/features/keyboard/blockEdit.ts`:

- Remove `InputTargetRange` (lines 14–19).
- Remove `RawSelectionFailureReason` (line 21).
- Remove `rawRangeFromInputEvent` (lines 329–333).
- Remove `rawRangeFromTargetRange` (lines 335–347).
- Remove `rawSelectionReason` (lines 349–353).
- Remove `BoundaryPositionResult` from the imports on line 3 (only the deleted helpers used it).
- Add `import {rawRangeFromInputEvent} from './inputRange'`.

- [ ] **Step C.4: Run keyboard tests**

```bash
pnpm -w exec vitest run packages/core/src/features/keyboard
```

Expected: passes. The browser tests in storybook (block keyboard suites) only run via `pnpm test`; defer to step F.1.

- [ ] **Step C.5: Commit**

```bash
git add -A packages/core
git commit -m "$(cat <<'EOF'
refactor(keyboard): hoist duplicated input-range helpers

input.ts and blockEdit.ts declared identical InputTargetRange /
RawSelectionFailureReason types and identical
rawRangeFromInputEvent / rawRangeFromTargetRange /
rawSelectionReason helpers. Move them into inputRange.ts and
import the single public entry from both files.
EOF
)"
```

---

## Phase D: Replace `DomIndex` counter with `isIndexed` boolean

Finding landed: #1.

`DomIndex = {generation: number}` was a counter-as-proxy: every consumer just wants to know "has the indexer ever committed?". Switch to `isIndexed: signal<boolean>` (one-way: false → true on first `#commitRendered`, never resets). Every reader becomes a boolean check. The `dom.indexed` event already covers the "re-run on each commit" case (one subscriber: `SelectionController#applyRangeToDOM`).

**Files:**

- Modify: `packages/core/src/features/dom/DomIndexer.ts`
- Modify: `packages/core/src/features/dom/DomBoundary.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts`
- Modify: `packages/core/src/features/dom/DomModel.spec.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/selection/SelectionController.spec.ts` (the brittle `// dom.index() is undefined → placement is deferred` comment becomes `// dom.isIndexed() is false → placement is deferred`)
- Modify: `packages/core/src/shared/editorContracts.ts` (delete `DomIndex` type)

---

- [ ] **Step D.1: Replace the indexer signal**

Edit `packages/core/src/features/dom/DomIndexer.ts`:

1. Remove `DomIndex` from the `editorContracts` import on line 1 (only `NodeLocationResult, TokenAddress, TokenPath` remain).
2. Remove `Computed` from the signals import on line 3 (no longer used in this file).
3. Replace the field block at lines 46–47:

```ts
	readonly #domIndex = signal<DomIndex>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())
```

with:

```ts
	readonly #isIndexed = signal(false, {readonly: true})
	readonly isIndexed: Signal<boolean> = this.#isIndexed
```

4. Delete the `#generation = 0` field on line 51 (no callers).
5. In `locateNode` (line 78) replace `if (!this.index()) return ...` with `if (!this.#isIndexed()) return ...`.
6. In `#commitRendered` replace line 173 (`batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})`) with:

```ts
		if (!this.#isIndexed()) batch(() => this.#isIndexed(true), {mutable: true})
```

(Setting the same value normally produces no notifications. The `if` is the cheap guard; `batch({mutable: true})` is preserved to mirror the previous notification-shape contract for the very first index commit.)

7. The `Computed` import is gone; `Signal` is already used in the file (`isUserSelecting: Signal<boolean>` in the host interface). Keep it.

The full new field block should read:

```ts
export class DomIndexer {
	readonly #isIndexed = signal(false, {readonly: true})
	readonly isIndexed: Signal<boolean> = this.#isIndexed

	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#rendering = false
	#queuedRender = false
```

- [ ] **Step D.2: Update `DomBoundary` to use `isIndexed` directly**

Edit `packages/core/src/features/dom/DomBoundary.ts` — no logic changes, but the host shim `isIndexed()` is fed by the new signal. No code change needed inside this file. (Verify: it reads `this.host.isIndexed()` on lines 29 and 85.)

- [ ] **Step D.3: Update `DomModel` to expose the new signal**

Edit `packages/core/src/features/dom/DomModel.ts`:

1. Replace `DomIndex` in the imports on lines 3 and 18 — drop `DomIndex` and `type {Computed}` (no longer needed):

```ts
import type {
	BoundaryPositionResult,
	DomRef,
	NodeLocationResult,
	RawSelectionResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {event, signal} from '../../shared/signals/index.js'
import type {Signal} from '../../shared/signals/index.js'
```

2. Replace the field declaration at line 33:

```ts
	readonly index: Computed<DomIndex | undefined>
```

with:

```ts
	readonly isIndexed: Signal<boolean>
```

3. In the constructor, replace `this.index = this.#indexer.index` (line 44) with `this.isIndexed = this.#indexer.isIndexed`.

4. In the `boundaryHost` declaration, replace `isIndexed: () => this.index() !== undefined` (line 48) with `isIndexed: () => this.isIndexed()`.

- [ ] **Step D.4: Update `SelectionController` consumer**

Edit `packages/core/src/features/selection/SelectionController.ts`:

- Line 79: replace `if (this.dom.index() === undefined) return false` with `if (!this.dom.isIndexed()) return false`.
- Line 195: replace `if (this.dom.index() === undefined) return` with `if (!this.dom.isIndexed()) return`.

- [ ] **Step D.5: Update specs**

Edit `packages/core/src/features/dom/DomModel.spec.ts`:

- Line 177: replace `expect(store.dom.index()).toEqual({generation: 1})` with `expect(store.dom.isIndexed()).toBe(true)`.
- Lines 262, 272, 310: replace each `expect(store.dom.index()).toBeDefined()` with `expect(store.dom.isIndexed()).toBe(true)`.

Edit `packages/core/src/features/selection/SelectionController.spec.ts`:

- Line 115 comment: replace `// No container set → dom.index() is undefined → placement is deferred` with `// No container set → dom.isIndexed() is false → placement is deferred`.

- [ ] **Step D.6: Drop `DomIndex` from contracts**

Edit `packages/core/src/shared/editorContracts.ts` — delete the `DomIndex` type definition (currently around lines 67-?? — delete the whole `export type DomIndex = {...}` block).

Verify the type is no longer used:

```bash
rg -n '\bDomIndex\b' packages
```

Expected: zero hits.

- [ ] **Step D.7: Run dom + selection tests**

```bash
pnpm -w exec vitest run packages/core/src/features/dom packages/core/src/features/selection
```

Expected: passes. Failures here mean a missed `dom.index()` call site — grep for it.

- [ ] **Step D.8: Commit**

```bash
git add -A packages/core
git commit -m "$(cat <<'EOF'
refactor(dom): replace DomIndex counter with isIndexed boolean

DomIndex = {generation: number} existed only so the public Signal
flipped identity on each commit, but no consumer ever read
.generation — every reader was an existence check
(dom.index() !== undefined). Replace with a one-way
isIndexed: Signal<boolean> that flips false → true on the first
commit and stays true. The dom.indexed event still covers
"re-run after commit" (one subscriber: SelectionController#applyRangeToDOM).
Drop DomIndex from editorContracts.
EOF
)"
```

---

## Phase E: Simplify Overlay/Block toggle scopes

Findings landed: #7, #8.

Both `OverlayController` and `BlockController` destroy/recreate an entire `effectScope` whenever a "feature enabled" gate flips. The wrapped subscriptions are `event()`/signal watchers — leaving them subscribed when the gate is off is essentially free (they fire only when the gated UI is actually used). Replacing the scope dance with an `if (!enabled) return` guard inside each watcher removes a class of state to maintain.

**Behavior shift:** subscriptions exist for the entire mounted lifetime instead of being torn down when the gate flips false. This is **safe** because:

- `BlockController` wraps a `watch(this.action, …)`. `action` is an `event()` whose only fire-site is the `addDragRow` / `deleteDragRow` / etc. UI helpers, which are themselves gated by `slots.isDragEnabled`. With drag disabled, no fire-site exists.
- `OverlayController` wraps several watchers on `value.current`, `selectionchange`, etc. Each fires whatever the gate state — but each watcher does cheap work (read a signal, return early) when the gate is off. The `selectionchange` listener is a global DOM handler we *do* want gated; we keep that conditional registration with a small inner `effect`.

**Files:**

- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/block/BlockController.ts`

---

- [ ] **Step E.1: Simplify `BlockController`**

Edit `packages/core/src/features/block/BlockController.ts`. Replace the constructor body and remove the `#unsub` field. Final shape of the class header:

```ts
export class BlockController {
	readonly action = event<DragAction>()

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly tokens: TokenModel,
		private readonly selection: SelectionController,
		slots: SlotsFeature
	) {
		watch(this.action, action => {
			if (!slots.isDragEnabled()) return
			switch (action.type) {
				case 'reorder':
					this.#reorder(action)
					break
				case 'add':
					this.#add(action)
					break
				case 'delete':
					this.#delete(action)
					break
				case 'duplicate':
					this.#duplicate(action)
					break
			}
		})
	}
```

The rest of the class (`#reorder`, `#add`, `#delete`, `#duplicate`, `#rangeAfterDrag`) is unchanged.

Notes:

- The `#unsub` field is gone; deletion is handled by the `BlockController` instance going out of scope (Store unmount). `watch` registered at construction time is owned by no `effectScope`, so it leaks on Store recreation in tests — but that was the pre-existing behavior of *most* watch calls in this codebase, and the previous toggle dance only saved teardown of the watch when `slots.isDragEnabled` flipped to false (which itself never happens in normal use because slot config is set once).
- If `BlockController.spec.ts` had a "does not leak a watcher" test, the new shape makes that test green by *not subscribing-then-unsubscribing*; the watcher is permanent and the test should already pass. If it asserts something subtler, read the spec; you may need to update its expectation comment.

- [ ] **Step E.2: Run block tests**

```bash
pnpm -w exec vitest run packages/core/src/features/block
```

Expected: passes. If the `does not leak a watcher` test fails, read the assertion — most likely it checks that the watcher is teardown-reentrant. Update the test description to reflect the new permanent-watcher contract.

- [ ] **Step E.3: Simplify `OverlayController`**

Edit `packages/core/src/features/overlay/OverlayController.ts`. The current `toggle(enabled)` builds an entire `effectScope` containing five subscriptions plus one DOM listener. Replace it with:

- one persistent `lifecycle.onMounted` body, with each subscription guarded by `if (!hasOverlayTrigger())` early-returns,
- one inner `effect` that conditionally registers the global `selectionchange` listener (the one place where being subscribed costs us anything).

Final shape of the constructor body (replacing lines 41–139):

```ts
	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly dom: DomModel,
		private readonly selection: SelectionController,
		private readonly edit: EditController,
		private readonly tokens: TokenModel
	) {
		const hasOverlayTrigger = computed(() => this.props.options().some(opt => opt.overlay?.trigger != null))

		this.lifecycle.onMounted(() => {
			watch(this.close, () => {
				this.match(undefined)
			})

			watch(this.value.current, () => {
				if (!hasOverlayTrigger()) return
				const showOverlayOn = this.props.showOverlayOn()
				const type: OverlayTrigger = 'change'
				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})

			effect(() => {
				const match = this.match()
				if (!match) return
				listen(window, 'keydown', e => {
					if (e.key === KEYBOARD.ESC) this.close()
				})
				listen(
					document,
					'click',
					e => {
						const target = e.target instanceof HTMLElement ? e.target : null
						if (this.element()?.contains(target)) return
						if (this.dom.container()?.contains(target)) return
						this.close()
					},
					true
				)
			})

			effect(() => {
				if (!hasOverlayTrigger()) return
				const handler = () => {
					const container = this.dom.container()
					if (!container?.contains(document.activeElement)) return
					const showOverlayOn = this.props.showOverlayOn()
					const type: OverlayTrigger = 'selectionChange'
					if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
						this.#probeTrigger()
					}
				}
				listen(document, 'selectionchange', handler)
			})

			watch(this.select, overlayEvent => {
				if (!hasOverlayTrigger()) return
				const {
					mark,
					match: {option, range},
				} = overlayEvent

				const markup = option.markup
				if (!markup) return

				const annotation =
					mark.type === 'mark'
						? annotate(markup, {
								value: mark.value,
								meta: mark.meta,
							})
						: annotate(markup, {
								value: mark.content,
							})

				this.edit.replace(range, annotation)
				this.match(undefined)
			})
		})
	}
```

Also delete the `#scope?: () => void` field declaration (line 39).

Notes:

- The `selectionchange` listener is now wrapped in `effect(() => { if (!hasOverlayTrigger()) return; ... })`. When `hasOverlayTrigger` flips, the effect re-runs; alien-signals tears down the previous effect's `listen` registration via the disposer attached to `effect`'s cleanup. This is the equivalent of the previous "register only when enabled" behavior with one fewer level of nesting.
- `watch(this.close, …)` has no gate — it's harmless when the trigger feature is off, since the only fire-site for `close` is internal calls inside this class, and the body just sets `match(undefined)` (already undefined when off).
- All other watchers add an `if (!hasOverlayTrigger()) return` guard so they short-circuit when the gate is off.
- The `select` watcher does the same — `select` is fired only by overlay UI, so the guard is defensive.

- [ ] **Step E.4: Run overlay tests**

```bash
pnpm -w exec vitest run packages/core/src/features/overlay
```

Expected: passes. The interesting property to verify is "re-enabling the overlay trigger after starting with no triggers makes `value.current` writes probe again". Check that an existing test exercises that path; if not, add one. The new shape preserves the property because `hasOverlayTrigger` is read inside each watcher, so the guard re-evaluates on every fire.

- [ ] **Step E.5: Commit**

```bash
git add -A packages/core
git commit -m "$(cat <<'EOF'
refactor: drop effectScope toggle dances in Overlay/Block

OverlayController and BlockController each created a fresh
effectScope on each gate flip (hasOverlayTrigger /
slots.isDragEnabled), tearing it down on the opposite flip.
Every gated watcher already returns cheaply when its source
hasn't fired, and the only event that *would* fire is itself
gated by the same flag (drag actions, overlay UI). Replace the
toggle with persistent watchers + early-return guards. The
selectionchange DOM listener stays conditionally registered
via a small inner effect.

Behavior shift documented in plan: watchers stay subscribed for
the whole mount instead of being torn down when the gate flips.
Cost is one signal read per gated event. No external API change.
EOF
)"
```

---

## Phase F: Final verification

Canonical AGENTS.md checks. Nothing new to commit unless `format` rewrites a file (in which case amend the previous commit only if it's the most recent and not yet pushed).

- [ ] **Step F.1: Full test suite**

```bash
pnpm test
```

Expected: passes. Watch for storybook browser-test snapshot failures — do **not** regenerate; diff and report.

- [ ] **Step F.2: Build**

```bash
pnpm run build
```

Expected: passes. The published `@markput/core` `dist/` should still expose `Store`, `Parser`, `annotate`, `denote`, `findToken`, `MarkController`, `MarkputHandler`, plus all reactive primitives — minus `MarkOptions`.

- [ ] **Step F.3: Typecheck**

```bash
pnpm run typecheck
```

Expected: passes.

- [ ] **Step F.4: Lint + format**

```bash
pnpm run lint:check
pnpm run format:check
```

Expected: both pass. If `format:check` flags whitespace, run `pnpm run format` and amend the most recent commit (it's yours, not pushed).

- [ ] **Step F.5: Update README files where they referenced removed symbols**

Audit the following READMEs for stale references to deleted symbols and remove them:

- `packages/core/README.md` — drop bullets that mention `computeTokensFromValue`, `assertNonNullable`, `EventKey`, `Listener`, `DEFAULT_OVERLAY_TRIGGER`, `DEFAULT_MARKUP`, `MarkOptions`, `clearMarkupPaste`, `createNewSpan` (if listed), `marksOnly`, `isMarkToken`.
- `packages/core/src/store/README.md` — drop the `isControlledMode` mention (already done in B.8).
- `packages/core/src/features/dom/README.md` — already accurate; verify.

Commit if any README changed:

```bash
git add packages/core
git commit -m "docs(core): drop stale README mentions of removed symbols"
```

---

## Deliberately out of scope

Findings from `2026-05-14-core-cleanup-audit.md` not addressed by this plan:

- **#4 (`features/parsing/preparsing/`)** — left in place per user request.
- **#5 (`Parser` static + `transform`/`escape`/`unescape`)** — left in place per user request.
- **#21 (`DomBoundaryHost` / `DomIndexerHost`)** — wider blast radius; warrants a dedicated plan that decides between merging the two classes back into `DomModel` or keeping them split with `DomModel` as the direct collaborator.
- **#24 (`TokenModel.#parser` computed wrap)** — already covered by `docs/superpowers/plans/2026-05-14-tokenmodel-cleanup.md`.
- **#27 (`Lifecycle.onMounted` orchestration)** — would change the `mounted`/`unmounted` event contract that React/Vue adapters depend on. Different blast radius; out of scope.

## Self-Review

Cross-check vs `docs/superpowers/reviews/2026-05-14-core-cleanup-audit.md`:

| Audit finding | Phase | Notes |
| --- | --- | --- |
| #1 DomIndex counter | D | Replaced with `isIndexed` boolean. |
| #2 keyboard duplication | C | Hoisted to `inputRange.ts`. |
| #3 valueParser.ts dead | A | File deleted, exports removed. |
| #4 preparsing/ | — | **Deferred**, per user. |
| #5 Parser static + transform/escape | — | **Deferred**, per user. |
| #6 keyboard/index.ts dead exports | B | Spec already imports from `./input`. |
| #7 OverlayController toggle | E | Persistent watchers + guards. |
| #8 BlockController toggle | E | Persistent watcher + guard. |
| #9 Listener / EventKey types | A | Deleted. |
| #10 Dead checker exports | A | Modules and re-exports gone. |
| #11 textOffsets internal exports | B | Privatized four helpers. |
| #12 tokenIndex.equals | B | Field dropped from interface and factory. |
| #13 parsing/index.ts re-exports | B | Direct imports preserved. |
| #14 mark_types.ts MarkOptions | A | File deleted; public re-export gone. |
| #15 MarkControllerConstructor | A | Type deleted. |
| #16 marksOnly parse option | B | Option, filter branch, spec block deleted. |
| #17 clearMarkupPaste | B | Function gone; spec switched to `consumeMarkupPaste`. |
| #18 isMarkToken helper | B | Deleted; spec uses inline `t.type === 'mark'`. |
| #19 createNewSpan | A | File deleted. |
| #20 tokens.serializeRange wrapper | B | Inlined at sole caller (`ClipboardController`). |
| #21 DomBoundary/Indexer hosts | — | **Deferred** to a separate plan. |
| #22 ValueModel.isControlledMode | B | Inlined inside `model({ get, set })`. |
| #23 selection.isUserSelecting | B | Re-export dropped; specs updated. |
| #24 TokenModel `#parser` wrap | — | **Out of scope**, see other plan. |
| #25 getTargetRanges wrapper | B | Inlined `event.getTargetRanges()`. |
| #26 shared/constants DEFAULTs | B | Inlined; helper types deleted. |
| #27 Lifecycle.onMounted | — | **Deferred**, larger blast radius. |

All in-scope items have a phase and a step. All deferred items have a documented reason.

## Risks and rollback

- Phase E changes reactive lifetime. If a user reports overlay or block-drag misbehavior after a release containing this plan, the most likely culprit is an `effect`/`watch` that should have an explicit `if (!gate)` guard but doesn't. Revert just the relevant phase E commit.
- Phase D drops the `DomIndex` type from `editorContracts`. External code (none in tree) referencing this type would break at compile time. The type was not re-exported from `packages/core/index.ts`, so this should be fully internal.
- Phase A drops `MarkOptions` from `packages/core/index.ts`. Any external dependent of `@markput/core` importing this type by name would break. The type had no documented public usage.

## Agent execution notes

- After each phase commits cleanly, **stop** and re-read the next phase before continuing. Do not pipeline phases.
- If a step's grep verification produces a hit you don't expect, stop and resolve it — do not proceed with stale assumptions.
- Where a step modifies a spec, run that spec file in isolation before committing the phase. The cost of finding a spec failure inside a 10-file commit is high.

