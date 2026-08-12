# One Host Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate markput from N contenteditable hosts (one per text token) to ONE editing host, taking the block feature onto tree anchors with it.

**Architecture:** The container becomes the single `contenteditable=true` host; text spans go bare (inherit editability), mark roots become `contenteditable=false` atomics with the slot child-wrapper re-enabled, and registered controls become `ce=false`. All input stays `preventDefault()` + `edit.replace()` (now fail-closed). Block row identity moves from `document.activeElement` to "root of the selection anchor" via the existing `domAnchors()`; drag operations stop slicing the props-first `value()` by tree positions and compose from anchor-based `valueBetween` reads. The `isUserSelecting` sweep flip, the focusin selection sync, and the cross-row arrow handlers are deleted — one host makes each of them either unnecessary or natively correct.

**Tech Stack:** TypeScript (dependency-free core), hand-rolled signals (`shared/signals`), vitest (+ browser storybook suites via `pnpm -F storybook test:react|test:vue`).

**Design doc:** `docs/one-host-migration.html` (measured evidence: defect re-measurement, single-host probes, breaking changes). Read it first.

---

## Context an engineer must know before touching anything

**Read `AGENTS.md` at the repo root. It overrides habit.**

### Measured facts this plan is built on (2026-08-11, Chromium)

1. **The click steal (new critical defect):** under N hosts, clicking from one text span into an adjacent one never places the caret. `SelectionDriver`'s focusout microtask clears the stored anchors mid-transition, the focusin sync re-reads the *stale* DOM range, the anchors watch fires, and `#applySelection → placeCaret → focusIfNeeded` steals focus back before Chromium places the clicked caret. Structurally impossible under one host (no focus transition between spans).
2. **Empty-gap carets need NO ZWSP filler.** On the committed DOM shape, a bare empty `<span>` between two `ce=false` marks is reachable: 5/5 clicks land element-anchored (`gapSpan:0`), arrows give one container-anchored stop (`DIV:2`). `anchorFor` already resolves all of these: `(gapSpan, 0)` via the element-boundary arm (`textOffsets.ts:17,44-46`), `(container, k)` via `fromContainerAnchor` (`domBoundary.ts:46-48,152-157`). **Invariant to preserve: container child index ↔ root index stays 1:1 — empty text tokens keep rendering their bare `<span>`.**
3. **Native sweep crosses `ce=false` marks inside one host with no flip machinery**; `deleteContentBackward` over that cross-mark selection is cancelable with `getTargetRanges()` spanning the mark.
4. **Native undo is dead identically under both topologies** (guarded input leaves the browser undo stack empty). Out of scope; do not try to fix it here.
5. **IME (`insertCompositionText`) is not cancelable.** Composition stays unhandled by design. Out of scope.
6. **Scope is Chromium-only** by maintainer decision (2026-08-10).

### Decisions already made (do not relitigate)

- **One host EVERYWHERE, including block mode.** Notion-style host-per-row was considered and REJECTED. Block rows keep their row elements; only editability topology changes.
- **Block-selection mode (rows-as-objects UX) is a LATER feature**, not part of this task.
- `'\n\n'` row splitting is REFUTED (was implemented once, broke 32 stories, reverted). A row IS a top-level token; a single `'\n'` is ordinary text.
- `user-select: none` is REFUTED (drops mark text from selection and clipboard).
- Never cut anything reachable from `MarkputApi` on zero-in-repo-caller evidence (`api.focus()`, `api.caret()` have real external users).

### Approval boundaries (hard rules from the maintainer)

- `packages/core/src/store/**`, any exported barrel (`index.ts`), and anything changing what `Store`/`MarkputApi` expose **need their own explicit approval** before the change is made. Tasks below that touch such surfaces carry a **⚠ APPROVAL** marker — stop and ask before executing those steps.
- Each commit must be green on its own. Behaviour changes are called out in the commit body.

### Gates — run before claiming ANY task done

```bash
pnpm test                    # core suites; 70 files / 1316 passed / 7 todo baseline (pre-plan)
pnpm run typecheck           # 8 projects; regenerates packages/website/src/content/docs/api/*.md — expected
pnpm run build
pnpm run lint:check
pnpm run format:check
pnpm -F storybook test:react # 239 passed baseline
pnpm -F storybook test:vue   # 213 passed baseline; known flake: overlay specs may time out — retry once and say so
```

- `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS. Always use the storybook variants.
- Test files are `*.spec.ts(x)`, never `*.test.ts`. Storybook: `*.react.spec.tsx` / `*.vue.spec.ts`.
- A pre-commit hook runs lint+format on staged files and re-stages; re-verify gates on the committed state afterwards.
- Playwright cannot open `file:` URLs — serve fixtures over `python3 -m http.server`.

### File map (what changes where)

| File | Stage | Fate |
|---|---|---|
| `packages/core/src/features/keyboard/blockEdit.ts` | A, C | row identity → selection; cross-row arrows deleted |
| `packages/core/src/features/block/operations.ts` | B | rewritten on anchor-slice reads |
| `packages/core/src/features/block/BlockController.ts` | B, D | drops `tokens.value()` read; gate unified |
| `packages/core/src/features/block/BlockController.spec.ts` | B | caret pin at :56 FLIPS (breaking) |
| `packages/core/src/features/block/operations.spec.ts` | B | rewritten against slice reads |
| `packages/core/src/features/tokens/dom/editableState.ts` | C | new policy: bare spans, `ce=false` atomics, re-enabled slot host |
| `packages/core/src/features/tokens/dom/bind.ts` | C | mount state under the new policy; controls `ce=false` |
| `packages/core/src/features/tokens/dom/SelectionDriver.ts` | C | flip + focusin sync + empty-click focus deleted; container editable write |
| `packages/core/src/features/tokens/dom/TokenHandle.ts` | C | caret focus retargets to the editing host; markless placeCaret goes to parent coordinates |
| `packages/core/src/features/tokens/dom/caret.ts` | C | `focusEditingHost`, `placeAtParentBoundary` added; `placeAtChildBoundary` removed |
| `packages/core/src/features/tokens/seam/TokenModel.ts` | C | `setEditable` plumbing shrinks — **⚠ APPROVAL** |
| `packages/core/src/features/keyboard/input.ts` | C | guard fails closed; Enter mapping; Cmd+A moves here |
| `packages/core/src/features/keyboard/arrowNav.ts` | C | DELETED |
| `packages/core/src/features/keyboard/KeyboardController.ts` | C | drops `enableArrowNav` |
| core specs: `SelectionDriver.spec.ts`, `TokenHandle.spec.ts`, `TokenModel.facade.spec.ts`, `bind.spec.ts`, `input.spec.ts`, `domBoundary.spec.ts` | C | migrated to one-host DOM |
| `packages/storybook/src/pages/**/*.spec.*` + `__snapshots__` | C | selectors + snapshots migrated |
| `packages/core/src/features/block/config.ts`, gates | D | one gating owner |
| `packages/website/src/content/docs/development/inconsistencies.md` | E | rewritten from measurements |

Stages land in order A → B → C → D → E. A and B are green under the CURRENT N-host design (that is the point: they are independently revertible and shrink stage C's blast radius).

---

## Stage A — row identity from the selection, not activeElement

### Task 1: `findActiveRow` reads the selection

Under one host `document.activeElement` is always the container, so every block keybinding dies. The replacement seam exists: `domAnchors()` (`TokenModel.ts:299`) resolves the live DOM selection to tree anchors under BOTH topologies, and `rootIndexOf(id)` (`tree/tree.ts:89-94`) already resolves a NESTED id to its root's index. Keep the activeElement path as a fallback for the one N-host state that has no DOM selection (a mark row focused via tabindex by mouse click); it dies in Task 8.

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts:31-43`
- Create: `packages/core/src/features/keyboard/blockEdit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/keyboard/blockEdit.spec.ts`. Use the existing test helpers — look at `packages/core/src/features/block/BlockController.spec.ts:38-57` for the mount pattern (`store.props.set`, `store.host.container(...)`, `store.tokens.setValue(...)`) and `packages/core/src/features/tokens/__testing__/mountFixtures.ts` for `anchorsAt`/`selectionRange`.

```ts
import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

/**
 * Row identity comes from the STORED selection, not document.activeElement.
 * Under one host activeElement is always the container; these pin the
 * topology-independent path.
 */
describe('blockEdit row identity', () => {
	function mountBlockStore(): Store {
		const store = new Store()
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')
		return store
	}

	it('Enter on a row resolved from the selection inserts a row after it', () => {
		const store = mountBlockStore()
		const container = store.host.container()!
		// Place the caret in the SECOND row through the model, then blur the
		// element focus entirely: activeElement must not be consulted.
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.nodes().length).toBe(3)
	})

	it('does nothing when there is no selection anywhere', () => {
		const store = mountBlockStore()
		const container = store.host.container()!
		store.tokens.selection.clear()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.nodes().length).toBe(2)
	})
})
```

Note: `store.tokens.selection.selectNode` stores anchors; `SelectionDriver`'s watch applies them to the DOM, so `domAnchors()` reads them back. If in the bare-container fixture the DOM application declines (no bound row elements), the primary path must fall through to the STORED anchors — that is what Step 3's `selection.anchors()` fallback is for. Run the test first; let its failure tell you which read is live in this fixture.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- blockEdit.spec`
Expected: FAIL — `nodes().length` stays 2 because `findActiveRow` consults `document.activeElement`, which is `<body>` in the fixture.

- [ ] **Step 3: Implement the selection-first `findActiveRow`**

In `packages/core/src/features/keyboard/blockEdit.ts` replace lines 31-43 (the current `findActiveRow`) with:

```ts
import type {Anchors, NodeAnchor, TokenHandle, TreeNode} from '../tokens'
// (extend the existing import from '../tokens'; NodeAnchor and Anchors are already exported there)

/** The anchor's own node — the tree identity every anchor form carries except the document edges. */
function anchorOwner(anchor: NodeAnchor): TreeNode | undefined {
	if (typeof anchor === 'string') return undefined
	if ('node' in anchor) return anchor.node
	if ('before' in anchor) return anchor.before
	return anchor.after
}

function rowFromAnchors(store: KbCtx, anchors: Anchors): ActiveRow | undefined {
	const owner = anchorOwner(anchors.anchor)
	if (!owner) return undefined
	const index = store.tokens.rootIndexOf(owner.id)
	if (index === undefined) return undefined
	const row = rowHandle(store, index)
	if (!row) return undefined
	return {handle: row, index}
}

function findActiveRow(store: KbCtx): ActiveRow | undefined {
	// Primary: the DOM selection resolved to tree anchors — topology-independent.
	const domAnchors = store.tokens.domAnchors()
	if (domAnchors) {
		const row = rowFromAnchors(store, domAnchors)
		if (row) return row
	}
	// Stored anchors cover a model-placed caret the DOM has not painted yet.
	const stored = store.tokens.selection.anchors()
	if (stored) {
		const row = rowFromAnchors(store, stored)
		if (row) return row
	}
	// N-host fallback: a mark row focused via tabindex has no DOM selection at
	// all. Dies with the host flip (Task 8) — under one host a click near a mark
	// produces a {before}/{after} anchor instead.
	const active = document.activeElement
	if (!active) return undefined
	const handle = store.tokens.handleAt(active)
	if (!handle || handle === 'control') return undefined
	const index = store.tokens.rootIndexOf(handle.id)
	if (index === undefined) return undefined
	const row = rowHandle(store, index)
	if (!row) return undefined
	return {handle: row, index}
}
```

`KbCtx` is `Pick<Store, 'edit' | 'tokens' | 'props'>` and `store.tokens.selection` is on `TokenModel` — no context change needed.

- [ ] **Step 4: Run the new spec and the full core suite**

Run: `pnpm test -- blockEdit.spec` → PASS.
Run: `pnpm test` → same pass count as baseline plus the new file (no regressions — the fallback keeps every existing activeElement-driven spec green).

- [ ] **Step 5: Run the storybook suites**

Run: `pnpm -F storybook test:react` → 239 passed.
Run: `pnpm -F storybook test:vue` → 213 passed (retry once on overlay flake, and say you retried).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/keyboard/blockEdit.spec.ts
git commit -m "refactor(keyboard): block row identity from the selection, not activeElement

Primary path resolves domAnchors()/stored anchors to a root index via
rootIndexOf; document.activeElement remains only as the N-host fallback
for a tabindex-focused mark row (removed with the host flip). No
behaviour change under the current topology."
```

---

## Stage B — block operations speak anchor reads

### Task 2: `operations.ts` composes from `valueBetween` slices

Today `applyDragAction(value, rows, …)` slices a caller-supplied string by tree `position`s — and the caller passes props-first `tokens.value()`, which can be string B while positions came from string A. The caret is then derived from PRE-edit positions applied to the POST-edit string, hidden by `Math.min` (`operations.ts:163-171`) and **pinned wrong** in `BlockController.spec.ts:56`.

Rewrite: operations take a `read(from, to)` callback (backed by `tokens.valueBetween`, which reads the tree's own string — always consistent with the nodes), decompose the document into per-row texts + gaps, recompose, and compute the caret against the string they just built. The caret bug dies by construction.

**Files:**
- Rewrite: `packages/core/src/features/block/operations.ts`
- Rewrite: `packages/core/src/features/block/operations.spec.ts`
- Modify: `packages/core/src/features/block/BlockController.ts:26-34`
- Modify: `packages/core/src/features/block/BlockController.spec.ts:50-57` (**BREAKING: the pinned caret flips**)
- Modify: `packages/core/src/features/keyboard/blockEdit.ts` (the three call sites of `addDragRow`/`deleteDragRow`/`mergeDragRows`)

- [ ] **Step 1: Write the new `operations.spec.ts` (failing)**

Replace the body of `packages/core/src/features/block/operations.spec.ts`. Model rows as stubs with only what the new API uses — `kind`, `descriptor`, `slotRange`, `position` (for the within-row slot arithmetic), plus a `read` built from a plain string so every expectation is literal:

```ts
import {describe, it, expect} from 'vitest'

import type {TreeNode} from '../tokens'
import {applyDragAction} from './operations'
import type {SliceRead} from './operations'

/**
 * Rows are '<text>\n\n' segments of `doc`; `read` answers from `doc` by the
 * rows' own positions — the same self-consistent pair the live tree provides
 * (valueBetween and nodes() always come from one generation).
 */
function fixture(texts: string[]): {rows: TreeNode[]; read: SliceRead; doc: string} {
	let at = 0
	const rows = texts.map(text => {
		const start = at
		at += text.length
		return {
			kind: 'text',
			position: {start, end: at},
			text: () => text,
		} as unknown as TreeNode
	})
	const doc = texts.join('')
	const read: SliceRead = (from, to) => {
		const point = (a: typeof from, side: 'start' | 'end'): number => {
			if (a === 'start') return 0
			if (a === 'end') return doc.length
			if ('node' in a) return a.node.position.start + a.offset
			if ('before' in a) return a.before.position.start
			return a.after.position.end
		}
		return doc.slice(point(from, 'start'), point(to, 'end'))
	}
	return {rows, read, doc}
}

describe('applyDragAction (anchor-slice composition)', () => {
	it('delete: removes the row and puts the caret at the promoted row start', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 0}, [])
		expect(result).toEqual({value: 'beta\n\n', caret: 0})
	})

	it('delete of a middle row: caret at the start of the row that moved up', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n', 'gamma\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 1}, [])
		expect(result).toEqual({value: 'alpha\n\ngamma\n\n', caret: 7})
	})

	it('delete of the last row: caret at the end of the new last row', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 1}, [])
		expect(result).toEqual({value: 'alpha\n\n', caret: 7})
	})

	it('delete of the only row empties the document', () => {
		const {rows, read} = fixture(['alpha\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 0}, [])
		expect(result).toEqual({value: '', caret: 0})
	})

	it('reorder: moves the row and the gaps travel with the composition', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n', 'c\n\n'])
		const result = applyDragAction(read, rows, {type: 'reorder', source: 0, target: 3}, [])
		// 'b\n\n' (3) + 'c\n\n' (3) — the moved row starts at 6.
		expect(result).toEqual({value: 'b\n\nc\n\na\n\n', caret: 6})
	})

	it('reorder to the same place is a no-op (undefined, no write)', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n'])
		expect(applyDragAction(read, rows, {type: 'reorder', source: 0, target: 0}, [])).toBeUndefined()
		expect(applyDragAction(read, rows, {type: 'reorder', source: 0, target: 1}, [])).toBeUndefined()
	})

	it('duplicate: copies the row text and puts the caret at the copy start', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'duplicate', index: 0}, [])
		expect(result).toEqual({value: 'alpha\n\nalpha\n\nbeta\n\n', caret: 7})
	})

	it('add after a row: inserts the option row content and puts the caret inside it', () => {
		const {rows, read} = fixture(['alpha\n\n'])
		const result = applyDragAction(read, rows, {type: 'add', afterIndex: 0}, [{markup: '__slot__\n\n'}])
		expect(result).toEqual({value: 'alpha\n\n\n\n', caret: 7})
	})

	it('add into an empty document: two empty rows, caret in the first', () => {
		const result = applyDragAction(() => '', [], {type: 'add', afterIndex: 0}, [{markup: '__slot__\n\n'}])
		expect(result).toEqual({value: '\n\n\n\n', caret: 0})
	})
})
```

Notes for the engineer:
- Caret expectations are derived by hand from the composed string: `'alpha\n\n'` is 7 chars, so the promoted `gamma` row in the middle-delete case starts at 7.
- `createRowContent([{markup: '__slot__\n\n'}])` produces `'\n\n'` (the markup with an empty slot) — read `packages/core/src/features/block/createRowContent.ts` before assuming otherwise, and adjust the two `add` expectations to what it actually returns if it differs.
- The old spec's `canMergeRows`/`mergeDragRows` cases: port them mechanically to the `read` form (same expectations, `read` instead of `value`). `mergeDragRows`' slot-leading arm keeps within-row position arithmetic (`slotRange.end - position.start` indexes the row's OWN slice — both from the same tree generation, self-consistent).

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm test -- operations.spec`
Expected: FAIL — `applyDragAction` still has the `(value, rows, action, options)` signature.

- [ ] **Step 3: Rewrite `operations.ts`**

Replace `packages/core/src/features/block/operations.ts` with:

```ts
import type {CoreOption, DragAction} from '../../shared/types'
import type {MarkNode, NodeAnchor, TreeNode} from '../tokens'
import {createRowContent} from './createRowContent'

/** An anchor-addressed slice of the document — backed by `tokens.valueBetween` in production. */
export type SliceRead = (from: NodeAnchor, to: NodeAnchor) => string

export type DragApplyResult = {
	readonly value: string
	readonly caret: number
}

function isSlotLeadingMark(node: TreeNode): node is MarkNode {
	return node.kind === 'mark' && node.descriptor.hasSlot && node.descriptor.segments.length === 1
}

/**
 * Returns whether two adjacent rows can be merged (Backspace/Delete).
 * Text rows merge when there's a gap between them.
 * Slot-leading mark rows of the same descriptor merge by removing the first mark's suffix.
 */
export function canMergeRows(read: SliceRead, a: TreeNode, b: TreeNode): boolean {
	if (a.kind === 'text' && b.kind === 'text' && read({after: a}, {before: b}) !== '') return true
	if (isSlotLeadingMark(a) && isSlotLeadingMark(b) && a.descriptor === b.descriptor) return true
	return false
}

/**
 * The document as per-row texts and inter-row gaps, read through anchors — the
 * tree's own string, never the props-first `value()`. Recomposition is
 * `texts[0] + gaps[0] + texts[1] + …`; every operation below edits these arrays
 * and derives its caret from the parts it kept, so the caret always indexes the
 * string it returns.
 */
function project(read: SliceRead, rows: readonly TreeNode[]): {texts: string[]; gaps: string[]} {
	const texts = rows.map(row => read({before: row}, {after: row}))
	const gaps = rows.slice(0, -1).map((row, i) => read({after: row}, {before: rows[i + 1]}))
	return {texts, gaps}
}

function compose(texts: readonly string[], gaps: readonly string[]): string {
	const parts: string[] = []
	texts.forEach((text, i) => {
		parts.push(text)
		if (i < gaps.length) parts.push(gaps[i])
	})
	return parts.join('')
}

/** Length of the composition up to (not including) row `index` — the row's start in the composed string. */
function startOf(texts: readonly string[], gaps: readonly string[], index: number): number {
	let total = 0
	for (let i = 0; i < index; i++) {
		total += texts[i].length
		if (i < gaps.length) total += gaps[i].length
	}
	return total
}

export function applyDragAction(
	read: SliceRead,
	rows: readonly TreeNode[],
	action: DragAction,
	options: CoreOption[]
): DragApplyResult | undefined {
	if (action.type === 'add' && rows.length === 0) {
		const rowContent = createRowContent(options)
		return {value: rowContent + rowContent, caret: 0}
	}
	const {texts, gaps} = project(read, rows)

	switch (action.type) {
		case 'delete': {
			if (rows.length <= 1) return {value: '', caret: 0}
			const keptTexts = texts.filter((_, i) => i !== action.index)
			const gapIndex = Math.min(action.index, gaps.length - 1)
			const keptGaps = gaps.filter((_, i) => i !== gapIndex)
			// Caret: the row that takes the deleted row's place — the next row when
			// one exists, else the end of the new last row.
			const caret =
				action.index < keptTexts.length
					? startOf(keptTexts, keptGaps, action.index)
					: compose(keptTexts, keptGaps).length
			return {value: compose(keptTexts, keptGaps), caret}
		}
		case 'duplicate': {
			const copy = texts[action.index]
			const newTexts = [...texts.slice(0, action.index + 1), copy, ...texts.slice(action.index + 1)]
			const newGaps = [...gaps.slice(0, action.index), '', ...gaps.slice(action.index)]
			const caret = startOf(newTexts, newGaps, action.index + 1)
			return {value: compose(newTexts, newGaps), caret}
		}
		case 'add': {
			const rowContent = createRowContent(options)
			const at = Math.min(action.afterIndex + 1, texts.length)
			const newTexts = [...texts.slice(0, at), rowContent, ...texts.slice(at)]
			const newGaps = at >= texts.length ? [...gaps, ''] : [...gaps.slice(0, at), '', ...gaps.slice(at)]
			const caret = startOf(newTexts, newGaps, at)
			return {value: compose(newTexts, newGaps), caret}
		}
		case 'reorder': {
			const {source, target} = action
			if (source === target || source === target - 1) return undefined
			if (rows.length < 2 || source < 0 || source >= rows.length || target < 0 || target > rows.length)
				return undefined
			const newTexts = [...texts]
			const [moved] = newTexts.splice(source, 1)
			const insertAt = target > source ? target - 1 : target
			newTexts.splice(insertAt, 0, moved)
			const newGaps = [...gaps]
			newGaps.splice(Math.min(source, newGaps.length - 1), 1)
			if (insertAt < newTexts.length - 1) newGaps.splice(insertAt, 0, '')
			const caret = startOf(newTexts, newGaps, insertAt)
			return {value: compose(newTexts, newGaps), caret}
		}
	}
}

/**
 * Merges row[index] into row[index - 1] by removing the boundary between them.
 * For text rows: removes the gap. For slot-leading marks: removes the first
 * mark's literal suffix, merging slot content. The within-row offset arithmetic
 * (`slotRange.end - position.start`) indexes the row's OWN slice — positions
 * and the slice come from one tree generation, so the pair is self-consistent.
 */
export function mergeDragRows(
	read: SliceRead,
	rows: readonly TreeNode[],
	index: number
): {value: string; caret: number} {
	if (index <= 0 || index >= rows.length) return {value: compose(...destructure(project(read, rows))), caret: 0}
	const {texts, gaps} = project(read, rows)
	const prev = rows[index - 1]
	const curr = rows[index]
	const prefix = startOf(texts, gaps, index - 1)
	if (isSlotLeadingMark(prev) && isSlotLeadingMark(curr)) {
		const local = (prev.slotRange ? prev.slotRange.end : prev.position.end) - prev.position.start
		const keptPrev = texts[index - 1].slice(0, local)
		const value =
			compose(texts.slice(0, index - 1), gaps.slice(0, Math.max(0, index - 2))) +
			(index >= 2 ? gaps[index - 2] : '') +
			keptPrev +
			texts[index] +
			composeTail(texts, gaps, index)
		return {value, caret: prefix + keptPrev.length}
	}
	const caret = prefix + texts[index - 1].length
	// Rows 0..index-1 with their gaps EXCEPT the merged boundary's gap, then the
	// merged-in row, then the untouched tail.
	const value = compose(texts.slice(0, index), gaps.slice(0, Math.max(0, index - 1))) + texts[index] + composeTail(texts, gaps, index)
	return {value, caret}
}

/** Rows after `index` with their leading gaps — the untouched tail of a merge. */
function composeTail(texts: readonly string[], gaps: readonly string[], index: number): string {
	let out = ''
	for (let i = index + 1; i < texts.length; i++) {
		out += gaps[i - 1] ?? ''
		out += texts[i]
	}
	return out
}

function destructure(p: {texts: string[]; gaps: string[]}): [string[], string[]] {
	return [p.texts, p.gaps]
}

/** Insert `content` as a row after `afterIndex`; caret at the END of the inserted content (blockEdit Enter on a mark row). */
export function addDragRow(read: SliceRead, rows: readonly TreeNode[], afterIndex: number, content: string): DragApplyResult {
	if (rows.length === 0) return {value: content + content, caret: 0}
	const {texts, gaps} = project(read, rows)
	const at = Math.min(afterIndex + 1, texts.length)
	const newTexts = [...texts.slice(0, at), content, ...texts.slice(at)]
	const newGaps = at >= texts.length ? [...gaps, ''] : [...gaps.slice(0, at), '', ...gaps.slice(at)]
	return {value: compose(newTexts, newGaps), caret: startOf(newTexts, newGaps, at) + content.length}
}

export function deleteDragRow(read: SliceRead, rows: readonly TreeNode[], index: number): DragApplyResult {
	return applyDragAction(read, rows, {type: 'delete', index}, []) ?? {value: '', caret: 0}
}
```

**Engineer notes for this step (read before typing):**
- The `mergeDragRows` slot arm above is the trickiest composition. Before accepting it, port the OLD spec's merge expectations (they encode the intended strings) and let them drive the exact composition — the old expectations are correct for merges; only the drag-action caret pins were wrong.
- `addDragRow`'s first `applyDragAction` call exists only to mirror the empty-document arm; if it reads awkwardly, inline the empty-document branch instead. Delete the `void result` line in that case.
- If `DragApplyResult.caret` was `number | undefined` at any call site, note the type tightened to `number` — every branch now knows its caret.

- [ ] **Step 4: Run the operations spec**

Run: `pnpm test -- operations.spec`
Expected: PASS. If a merge expectation fails, fix the composition (the spec is authoritative for the strings; the caret must equal the prefix computed from kept parts).

- [ ] **Step 5: Rewire `BlockController` and flip the pinned caret**

In `packages/core/src/features/block/BlockController.ts` replace the action watch (lines 26-34) with:

```ts
		watch(this.action, action => {
			if (!this.props.layout.isBlock() || !this.props.draggable()) return
			// Anchor-slice reads: the tree's own string, always consistent with nodes().
			const read = (from: NodeAnchor, to: NodeAnchor): string => this.tokens.valueBetween(from, to)
			const result = applyDragAction(read, this.tokens.nodes(), action, this.props.options())
			if (result === undefined) return
			this.edit.setValue(result.value, result.caret)
		})
```

Add `NodeAnchor` to the type imports from `../tokens`.

In `packages/core/src/features/block/BlockController.spec.ts` flip the pin at lines 50-57 — delete of row 0 in `'alpha\n\nbeta\n\n'` now lands the caret at the START of the promoted row:

```ts
		store.block.action({type: 'delete', index: 0})

		expect(store.tokens.value()).toBe('beta\n\n')
		expect(selectionRange(store)).toEqual({start: 0, end: 0})
```

- [ ] **Step 6: Rewire the three `blockEdit.ts` call sites**

In `packages/core/src/features/keyboard/blockEdit.ts`:

`handleDelete` (empty-row arm, currently `deleteDragRow(value, rows, blockIndex)` + manual `pos`):

```ts
		if (blockText === '') {
			event.preventDefault()
			const read = (from: NodeAnchor, to: NodeAnchor): string => store.tokens.valueBetween(from, to)
			const result = deleteDragRow(read, rows, blockIndex)
			store.edit.setValue(result.value, result.caret)
			return
		}
```

`mergeOrFocusNeighbor` (currently `mergeDragRows(value, rows, joinIndex)`):

```ts
	if (canMergeRows(read, a, b)) {
		const merged = mergeDragRows(read, rows, joinIndex)
		store.edit.setValue(merged.value, merged.caret)
		return
	}
```

with `const read = (from: NodeAnchor, to: NodeAnchor): string => store.tokens.valueBetween(from, to)` at the top of the function, and drop the `value` parameter from `mergeOrFocusNeighbor`'s signature and both call sites.

`handleEnter` (currently `addDragRow(value, rows, blockIndex, newRowContent)`):

```ts
		if (!isTextLikeRow(row)) {
			const read = (from: NodeAnchor, to: NodeAnchor): string => store.tokens.valueBetween(from, to)
			const result = addDragRow(read, rows, blockIndex, newRowContent)
			store.edit.setValue(result.value, result.caret)
			return
		}
```

Delete the now-unused `const value = store.tokens.value()` reads in these functions. `handleDelete`'s `valueBetween` read for `blockText` already exists (`blockEdit.ts:88`) — leave it.

- [ ] **Step 7: Run everything**

Run: `pnpm test` → the flipped pin passes, nothing else regresses.
Run: `pnpm -F storybook test:react` and `pnpm -F storybook test:vue`. The Drag suites assert row outcomes; if any assert the OLD caret position after delete, update them to the promoted-row-start expectation and list each in the commit body.

- [ ] **Step 8: Run remaining gates**

Run: `pnpm run typecheck && pnpm run build && pnpm run lint:check && pnpm run format:check` → all green.

- [ ] **Step 9: Commit (breaking change called out)**

```bash
git add packages/core/src/features/block packages/core/src/features/keyboard/blockEdit.ts
git commit -m "fix(block): drag operations compose from anchor-slice reads

BREAKING: the caret after a drag-delete lands at the start of the row
that replaced the deleted one. The previous position was derived from
pre-edit tree positions applied to the post-edit string and clamped by
Math.min - end-of-document for the first-of-two case (pinned in
BlockController.spec.ts:56, now flipped), mid-word in the next row for
the three-row case.

operations.ts no longer takes a caller-supplied value string: it reads
the document through tokens.valueBetween (the tree's own string), so
the props-first value()/tree-positions mismatch in controlled mode is
structurally gone. applyDragAction returns undefined for no-op reorders
instead of comparing against value()."
```

---

## Stage C — the host flip

Stage C is one behavioural unit but lands as reviewable commits (Tasks 3–10). The suite is only fully green again at Task 9/10 for browser suites; CORE gates must stay green after every commit. Order matters: policy first (3–4), then caret plumbing (5), then the driver diet (6), then input (7), then blockEdit cleanup (8), then spec migration (9–10).

### Task 3: the editable policy — `editableState.ts` + `bind.ts`

**Files:**
- Rewrite: `packages/core/src/features/tokens/dom/editableState.ts`
- Modify: `packages/core/src/features/tokens/dom/bind.ts:37-38,60-61,96,203-219` (mount state + `BindInput.editable` shrinks; controls get `ce=false`)
- Modify: `packages/core/src/features/tokens/seam/TokenModel.ts` (the `bind(...)` call's `editable` argument; `setEditable` — **⚠ APPROVAL: `setEditable` is reachable through the `Store` export. Before changing its signature or deleting it, ask. Default: keep the method, reduce its body to the container write described in Task 6.**)
- Test: `packages/core/src/features/tokens/dom/bind.spec.ts` (mount-state cases)

- [ ] **Step 1: Write the failing mount-state test**

In `packages/core/src/features/tokens/dom/bind.spec.ts`, find the existing editable/mount-state cases (search for `contenteditable` / `tabindex` in the file) and add a new describe block; the old cases are updated in this same task (they pin the N-host writes):

```ts
describe('one-host mount state', () => {
	it('text surfaces carry NO contenteditable attribute; mark roots are ce=false without tabindex', () => {
		// Reuse the file's existing mount helper for a text+mark+text tree.
		const {container, textElements, markElements} = mountTextMarkText() // adapt to the file's actual fixture helper
		for (const span of textElements) {
			expect(span.hasAttribute('contenteditable')).toBe(false)
		}
		for (const mark of markElements) {
			expect(mark.getAttribute('contenteditable')).toBe('false')
			expect(mark.hasAttribute('tabindex')).toBe(false)
		}
	})

	it('a slot mark re-enables its child sequence host', () => {
		const {childSequenceHost} = mountSlotMark() // adapt to the file's actual fixture helper
		expect(childSequenceHost.getAttribute('contenteditable')).toBe('true')
	})
})
```

Adapt fixture-helper names to what `bind.spec.ts` actually uses — read the file first; it is 777 lines and already mounts every topology this needs.

- [ ] **Step 2: Run to verify the new cases fail**

Run: `pnpm test -- bind.spec`
Expected: the two new cases FAIL (spans get `contenteditable="true"`, marks get `tabindex="0"`).

- [ ] **Step 3: Rewrite `editableState.ts`**

```ts
import type {ElementBindings} from './TokenHandle'

/**
 * One-host editable topology for a single bound token:
 *
 * - Text surface: BARE — no contenteditable attribute at all; it inherits
 *   editability from the container, which is the only editing host.
 * - Mark root: `contenteditable=false` — atomic by contract, not by accident
 *   of "my parent is not an editing host". No tabindex: marks are not tab
 *   stops (Tab leaves the field natively).
 * - Slot child wrapper: re-enabled `contenteditable=true` inside the atomic
 *   root, so slot content stays editable while the mark chrome around it
 *   stays atomic.
 *
 * readOnly lives on the CONTAINER (SelectionDriver writes it), not here.
 */
export function applyEditableState(bindings: ElementBindings): void {
	if (bindings.textElement) {
		bindings.textElement.removeAttribute('contenteditable')
		return
	}
	if (bindings.tokenElement.contentEditable !== 'false') {
		bindings.tokenElement.contentEditable = 'false'
	}
	bindings.tokenElement.removeAttribute('tabindex')
	const host = bindings.childSequenceHost
	if (host && host.contentEditable !== 'true') host.contentEditable = 'true'
}
```

- [ ] **Step 4: Update `bind.ts`**

- Remove `editable` from `BindInput` (line 38) and from the destructuring (line 61); update `applyMountState` (lines 203-219) to call `applyEditableState(bindings)` with no state argument. Keep the "newly bound only" conditional exactly as is.
- Registered controls become non-editable islands: in the main `batch` (after the tree loop), add

```ts
			// Controls are not document content: inside the one editing host they
			// must be atomic, or the browser would let the caret and edits into
			// grips, menus and overlays.
			for (const ctrl of controlElements) {
				if (ctrl.isConnected && ctrl.contentEditable !== 'false') ctrl.contentEditable = 'false'
			}
```

- In `TokenModel.ts`, fix the `bind({...})` call to stop passing `editable` (search for `editable:` near the `bind(` call; the surrounding lines show how the mount state was fed — delete that argument and the plumbing that computed it, EXCEPT `setEditable` itself, which Task 6 repurposes).

- [ ] **Step 5: Update the OLD editable pins in `bind.spec.ts`**

Every existing case asserting `contenteditable="true"` on spans or `tabindex="0"` on marks flips to the new policy (bare spans / `ce=false` marks / no tabindex). Mechanical; keep the case names truthful (rename "writes contenteditable on mount" → "leaves text surfaces bare on mount", etc.).

- [ ] **Step 6: Run core gates**

Run: `pnpm test` → green (browser storybook suites are NOT run here; they go red until Task 9-10 and that is expected — do not run them mid-stage-C except where a task says to).
Run: `pnpm run typecheck` → green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/tokens/dom/editableState.ts packages/core/src/features/tokens/dom/bind.ts packages/core/src/features/tokens/dom/bind.spec.ts packages/core/src/features/tokens/seam/TokenModel.ts
git commit -m "feat(dom)!: one-host editable topology

BREAKING (DOM shape): text spans no longer carry contenteditable; mark
roots become contenteditable=false and lose tabindex=0 (marks are not
tab stops - Tab leaves the field natively); slot child wrappers are
re-enabled; registered controls become contenteditable=false. The
container write lands with the SelectionDriver change."
```

### Task 4: the container becomes the editing host

**Files:**
- Modify: `packages/core/src/features/tokens/dom/SelectionDriver.ts:53-82` (the policy watch writes the container)
- Modify: `packages/core/src/features/tokens/seam/TokenModel.ts:336-345` (`setEditable` body → container write) — **⚠ APPROVAL** (Store-reachable member; keep the name/signature, change only the body, and confirm with the maintainer in the task report)
- Test: `packages/core/src/features/tokens/dom/SelectionDriver.spec.ts`

- [ ] **Step 1: Write the failing test**

In `SelectionDriver.spec.ts` add:

```ts
	it('mounting makes the container the editing host; readOnly toggles it', () => {
		// Reuse the file's mount fixture.
		const {container, store} = mountEditor() // adapt to the file's actual helper
		expect(container.getAttribute('contenteditable')).toBe('true')

		store.props.set({readOnly: true})
		expect(container.getAttribute('contenteditable')).toBe('false')

		store.props.set({readOnly: false})
		expect(container.getAttribute('contenteditable')).toBe('true')
	})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- SelectionDriver.spec` → FAIL (container carries no attribute).

- [ ] **Step 3: Implement**

In `SelectionDriver.ts`, `onMounted`:

```ts
			// THE editing host: the container, gated only by readOnly. Applied on
			// mount and on every readOnly change; per-token topology is bind's.
			const applyHostEditable = (): void => {
				const editable = !this.deps.readOnly()
				const attr = editable ? 'true' : 'false'
				if (container.contentEditable !== attr) container.contentEditable = attr
			}
			applyHostEditable()
			watch(
				() => this.deps.readOnly(),
				() => applyHostEditable()
			)
```

replacing the current `#applyEditablePolicy` watch pair (lines 57-61). Keep `#applyEditablePolicy` itself and `deps.setEditable` for now — Task 6 deletes them with the flip.

In `TokenModel.ts:339`, `setEditable`'s per-handle sweep body: leave it in place for this task (the flip that calls it still exists until Task 6).

- [ ] **Step 4: Run and commit**

Run: `pnpm test` → green. `pnpm run typecheck` → green.

```bash
git add packages/core/src/features/tokens/dom/SelectionDriver.ts packages/core/src/features/tokens/dom/SelectionDriver.spec.ts
git commit -m "feat(dom): container is the editing host, gated by readOnly"
```

### Task 5: caret plumbing — focus the host, place mark carets in parent coordinates

**Files:**
- Modify: `packages/core/src/features/tokens/dom/caret.ts:132-142,160-163`
- Modify: `packages/core/src/features/tokens/dom/TokenHandle.ts:117-130,140-146`
- Test: `packages/core/src/features/tokens/dom/caret.spec.ts`, `packages/core/src/features/tokens/dom/TokenHandle.spec.ts`

- [ ] **Step 1: Write the failing tests**

`caret.spec.ts`:

```ts
describe('focusEditingHost', () => {
	it('focuses the nearest contenteditable=true ancestor, not the element itself', () => {
		const host = document.createElement('div')
		host.contentEditable = 'true'
		const span = document.createElement('span')
		host.append(span)
		document.body.append(host)
		focusEditingHost(span)
		expect(document.activeElement).toBe(host)
		host.remove()
	})
})

describe('placeAtParentBoundary', () => {
	it('places a collapsed caret at a child index of the parent', () => {
		const host = document.createElement('div')
		host.contentEditable = 'true'
		const a = document.createElement('span')
		a.textContent = 'a'
		const mark = document.createElement('mark')
		mark.contentEditable = 'false'
		host.append(a, mark)
		document.body.append(host)
		placeAtParentBoundary(host, 1) // between a and mark
		const sel = window.getSelection()!
		expect(sel.anchorNode).toBe(host)
		expect(sel.anchorOffset).toBe(1)
		host.remove()
	})
})
```

`TokenHandle.spec.ts` — find the existing `placeCaret` cases for a markless-surface handle (search `placeAtChildBoundary` / "without a text surface") and add:

```ts
	it('placeCaret on a mark handle lands in the PARENT coordinate space, not inside the mark', () => {
		// Reuse the file's bind fixture for a text+mark+text mount.
		const {markHandle, container} = mountTextMarkText() // adapt to the file's actual helper
		markHandle.placeCaret(Infinity)
		const sel = window.getSelection()!
		expect(sel.anchorNode).toBe(container)
		// after the mark = the mark's child index + 1
		const markEl = markHandle.element()!
		const index = Array.prototype.indexOf.call(container.childNodes, markEl)
		expect(sel.anchorOffset).toBe(index + 1)
	})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- caret.spec` and `pnpm test -- TokenHandle.spec` → new cases FAIL.

- [ ] **Step 3: Implement in `caret.ts`**

Replace `placeAtChildBoundary` (lines 132-142) with:

```ts
/** Place a collapsed caret at a child index of `parent` (the one-host coordinate for "before/after an atomic child"). */
export function placeAtParentBoundary(parent: HTMLElement, childIndex: number): void {
	const selection = window.getSelection()
	if (!selection) return
	const range = document.createRange()
	range.setStart(parent, Math.max(0, Math.min(childIndex, parent.childNodes.length)))
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
}
```

Replace `focusIfNeeded` (lines 160-163) with:

```ts
/** Focus the element's editing host (nearest ce=true ancestor incl. itself) unless focus is already inside it. */
export function focusEditingHost(element: HTMLElement): void {
	const host = element.closest('[contenteditable="true"]')
	if (host instanceof HTMLElement && !host.contains(document.activeElement)) host.focus()
}
```

- [ ] **Step 4: Implement in `TokenHandle.ts`**

`placeCaret` (lines 117-130):

```ts
	placeCaret(offset: number): boolean {
		const bindings = this.#bindings
		if (!bindings) return false
		const {tokenElement, textElement} = bindings
		if (!textElement) {
			// A mark has no anchorable interior: its caret positions are the parent
			// coordinates before/after it — the placement selectRange refused for a
			// decade of N-host asymmetry.
			const parent = tokenElement.parentElement
			if (!parent) return false
			focusEditingHost(parent)
			const index = Array.prototype.indexOf.call(parent.childNodes, tokenElement)
			placeAtParentBoundary(parent, offset <= 0 ? index : index + 1)
			return true
		}
		focusEditingHost(textElement)
		const length = textLength(textElement)
		placeAtTextOffset(textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
		return true
	}
```

`focus()` (lines 140-146): `focusIfNeeded(scope)` → `focusEditingHost(scope)`. Update the imports from `./caret` accordingly (drop `focusIfNeeded`/`placeAtChildBoundary`, add `focusEditingHost`/`placeAtParentBoundary`).

- [ ] **Step 5: Update old pins, run, commit**

Existing `TokenHandle.spec.ts` cases asserting `document.activeElement === span` after `placeCaret` flip to "activeElement is the container / the editing host". Run `pnpm test` → green; `pnpm run typecheck` → green.

```bash
git add packages/core/src/features/tokens/dom/caret.ts packages/core/src/features/tokens/dom/TokenHandle.ts packages/core/src/features/tokens/dom/caret.spec.ts packages/core/src/features/tokens/dom/TokenHandle.spec.ts
git commit -m "feat(dom): caret focuses the editing host; mark carets in parent coordinates

Fixes the selectRange/placeCaret asymmetry: {before}/{after} mark
anchors now have a real DOM placement instead of a range refused for
not being a text surface."
```

### Task 6: the SelectionDriver diet — delete the flip, the focusin sync, the empty-click focus

Everything deleted here exists only because of N hosts, and two of the deletions are the measured defect sources (the click steal; the dead editor after a sweep).

**Files:**
- Modify: `packages/core/src/features/tokens/dom/SelectionDriver.ts` (delete `isUserSelecting`, `#trackUserSelecting`, `#applyEditablePolicy`, the focusin listener, `#focusEmptyEditorOnClick`; delete `deps.setEditable`)
- Modify: `packages/core/src/features/tokens/seam/TokenModel.ts` (driver deps wiring at :387-397; `setEditable` body → container write, `isUserSelecting` re-export at :313 — **⚠ APPROVAL for both: Store-reachable surface.** Proposal to show the maintainer: `setEditable` keeps its signature and writes the container; `isUserSelecting` is deleted with its 0 external callers verified by grep)
- Test: `packages/core/src/features/tokens/dom/SelectionDriver.spec.ts`

- [ ] **Step 1: Grep for external users of the deleted surface**

Run: `rg -n "isUserSelecting|setEditable" packages/core/src packages/react packages/vue packages/storybook --type ts | grep -v "core/src/features/tokens"`
Expected: no hits outside the token layer (if there ARE hits, stop — the deletion needs the maintainer's yes with the hit list).

- [ ] **Step 2: Write the failing pin for the click-steal fix**

In `SelectionDriver.spec.ts`, the file has two "focusin …" cases pinning the old exits (`:213-217` of the source describes them). Replace them with pins of the new contract:

```ts
	it('a selectionchange inside the editor updates the stored anchors; NO focusin listener re-applies stale ones', () => {
		const {container, store, text1, text2} = mountTwoSpans() // adapt to the file's actual helper
		// Stored caret in text2.
		store.tokens.selection.selectNode(store.tokens.nodes()[2], 'start')
		// Simulate the mid-click state the steal needed: focus transition with a
		// STALE dom selection still on text2, focusin on text1.
		text1.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))
		// The stored selection must NOT have been re-applied over the click;
		// with no focusin listener the anchors simply stay until selectionchange.
		expect(document.activeElement).not.toBe(text2)
	})
```

Adapt to the fixture the file actually builds — the assertion that matters: dispatching `focusin` alone triggers NO placement (no focus change, no range write). If the file's fixtures make the negative easier to pin through a spy on `selection.select`, pin that instead: `focusin` alone calls neither `select` nor `clear`.

- [ ] **Step 3: Run to verify it fails, then implement the deletions**

Run: `pnpm test -- SelectionDriver.spec` → the new pin FAILS (the focusin listener syncs and re-applies).

In `SelectionDriver.ts` delete:
- field `isUserSelecting` (line 40) and its watch (line 61);
- `#applyEditablePolicy` (lines 78-82) — Task 4's `applyHostEditable` already replaced its container half;
- the `isUserSelecting()` early-return in `#applySelection` (line 133);
- `#focusEmptyEditorOnClick` (lines 155-165) and its call (line 46) — under one host a click in the empty editor places a native caret (measured: `editor:0` resolves);
- `#trackUserSelecting` entirely (lines 167-196) and its call (line 48);
- the `focusin` listener (lines 242-250). KEEP the `focusout` microtask clear (lines 252-256 — still correct when focus leaves the editor entirely) and the `selectionchange` sync (lines 258-263 — now the ONLY DOM→model direction).
- `deps.setEditable` from `SelectionDriverDeps` (line 25) and its call site.

In `TokenModel.ts`:
- driver deps at :387-397: drop `setEditable`;
- `setEditable` (:339): keep name and signature, body becomes the container write (`host.container()` → set `contenteditable` per `editable && !readOnly`) so the Store-reachable member keeps working — show this to the maintainer per the ⚠ marker;
- the `isUserSelecting` re-export (:313): delete after Step 1 proved zero callers.

- [ ] **Step 4: Update the remaining driver pins**

`SelectionDriver.spec.ts` cases exercising the sweep flip (the 14 flip references live across 4 spec files — find them: `rg -n "isUserSelecting" packages/core/src --type ts`) are deleted with the mechanism. Cases pinning "focusin clears when target is not in editor" migrate to the `focusout`/`selectionchange` behaviours that still exist.

- [ ] **Step 5: Run and commit**

Run: `pnpm test` → green. `pnpm run typecheck` → green.

```bash
git add packages/core/src/features/tokens
git commit -m "fix(dom)!: delete the sweep flip and the focusin selection sync

The flip (isUserSelecting -> ce=false across hosts) let a drag escape
its host; one host has nothing to escape, and the flip's aftermath was
a dead editor (all hosts ce=false, focus on BODY, keys silently
dropped). The focusin sync read a STALE dom range during the focus
transition and re-applied old anchors with a focus steal - the reason
a click into an adjacent span never moved the caret. Both mechanisms
are structurally impossible to need under one host.

BREAKING: focus/blur on the container now fire once per real
entry/exit instead of once per span switch."
```

### Task 7: the input guard fails closed; Cmd+A moves; arrowNav dies

**Files:**
- Modify: `packages/core/src/features/keyboard/input.ts:58-101` (fail-closed + Enter mapping), `:26-29` (Cmd+A)
- Delete: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/KeyboardController.ts:7,17` (drop `enableArrowNav`)
- Modify: `packages/core/src/features/keyboard/index.ts` if it exports `enableArrowNav` (**⚠ APPROVAL if the export is in a public barrel** — check `rg -n "arrowNav" packages/core/src/index.ts packages/core/src/features/keyboard/index.ts` first)
- Test: `packages/core/src/features/keyboard/input.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `input.spec.ts` (reuse its existing mount/dispatch helpers — the file already dispatches `beforeinput` with `inputType`):

```ts
	it('insertParagraph maps to a newline through the guard', () => {
		const {store, dispatchBeforeInput} = mountInputFixture() // adapt to the file's helpers
		store.tokens.setValue('ab')
		store.tokens.selection.select({node: store.tokens.nodes()[0], offset: 1})
		const event = dispatchBeforeInput({inputType: 'insertParagraph'})
		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
	})

	it('an unhandled cancelable inputType is prevented and changes nothing (fail closed)', () => {
		const {store, dispatchBeforeInput} = mountInputFixture()
		store.tokens.setValue('ab')
		const event = dispatchBeforeInput({inputType: 'formatBold'})
		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('ab')
	})

	it('Ctrl/Cmd+A selects all from the input keydown path', () => {
		const {store, container} = mountInputFixture()
		store.tokens.setValue('ab')
		container.dispatchEvent(
			new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})
		)
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- input.spec` → the three new cases FAIL (insertParagraph returns undefined → not prevented; formatBold untouched; Cmd+A lives in arrowNav).

- [ ] **Step 3: Implement in `input.ts`**

`replacementForInput` (lines 93-101) gains the newline mapping:

```ts
function replacementForInput(container: HTMLElement, event: InputEvent): string | undefined {
	if (event.inputType.startsWith('delete')) return ''
	if (event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') {
		const markup = consumeMarkupPaste(container)
		return markup ?? event.dataTransfer?.getData('text/plain') ?? event.data ?? ''
	}
	if (event.inputType === 'insertText') return event.data ?? ''
	if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') return '\n'
	if (event.inputType === 'insertFromDrop') return event.dataTransfer?.getData('text/plain') ?? ''
	return undefined
}
```

`handleBeforeInput` (lines 58-91) fails closed — the tail becomes:

```ts
	if (store.props.layout.isBlock()) return

	const anchors = anchorsFromInputEvent(store, event)
	const replacement = replacementForInput(container, event)
	if (anchors === undefined || replacement === undefined) {
		// FAIL CLOSED: under one host any unguarded default mutates DOM the
		// model owns. insertCompositionText is not cancelable and passes through
		// (composition is unhandled by design); everything cancelable that this
		// guard cannot express as an edit is dropped.
		if (event.cancelable) event.preventDefault()
		return
	}

	const target = anchorsForInput(store, event, anchors)
	if (!target) {
		if (event.cancelable) event.preventDefault()
		return
	}

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement)
```

`enableInput`'s keydown listener (lines 26-28) gains Cmd+A:

```ts
	listen(container, 'keydown', e => {
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
			e.preventDefault()
			store.tokens.selection.selectAll()
			return
		}
		handleDeleteKey(store, e)
	})
```

- [ ] **Step 4: Delete `arrowNav.ts`, update `KeyboardController.ts`**

```bash
git rm packages/core/src/features/keyboard/arrowNav.ts
```

Remove the `enableArrowNav` import and call from `KeyboardController.ts`. If a barrel exports it, that removal needs the ⚠ approval noted above.

The `isBlock()` guards that lived in arrowNav die with the file. `blockEdit`'s own Left/Right/Up/Down handlers still exist until Task 8.

- [ ] **Step 5: Update old pins, run, commit**

`input.spec.ts` cases pinning "unhandled types pass through" flip to fail-closed. Core specs referencing `arrowNav` (`rg -n "arrowNav" packages/core/src --type ts`) migrate or die with it — the Ctrl+A pin moves to `input.spec.ts` (Step 1 wrote it).

Run: `pnpm test` → green. `pnpm run typecheck` → green.

```bash
git add packages/core/src/features/keyboard
git commit -m "feat(keyboard)!: fail-closed beforeinput guard; arrowNav deleted

BREAKING: Enter now maps insertParagraph/insertLineBreak to a newline
through the guard; every unhandled cancelable inputType is prevented
(the browser never edits the host DOM). Left/Right mark skipping is
native under one host - measured: arrows traverse ce=false atomics with
element-anchored stops that anchorFor already resolves; the empty-gap
positions need no ZWSP. Ctrl/Cmd+A moves to the input keydown path.
insertCompositionText remains uncancelable and unhandled by design."
```

### Task 8: blockEdit sheds the N-host machinery

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts` — delete `handleBlockArrowLeftRight` (:165-189), `handleArrowUpDown` (:191-220), their dispatch (:49-53), the activeElement fallback from Task 1, and `focusRow`'s handle-focus fallback (:152-163 shrinks)
- Test: `packages/core/src/features/keyboard/blockEdit.spec.ts`

- [ ] **Step 1: Write the failing pin**

```ts
	it('Arrow keys in block mode are left to the browser (no preventDefault)', () => {
		const store = mountBlockStore()
		const container = store.host.container()!
		store.tokens.selection.selectNode(store.tokens.nodes()[0], 'end')
		const event = new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true})
		container.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(false)
	})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- blockEdit.spec` → FAIL (`handleBlockArrowLeftRight` preventDefaults at a row edge).

- [ ] **Step 3: Implement the deletions**

- Delete `handleBlockArrowLeftRight` and `handleArrowUpDown` and their two dispatch lines in `enableBlockEdit` — cross-row caret movement is native inside one host (this is the ~56 lines of manual caret transport incl. `placeCaretAtX` ±4px).
- Delete the activeElement fallback block from Task 1's `findActiveRow` (the selection paths are now the only ones).
- `focusRow` shrinks — `handle.focus()` + `placeCaret` on a row handle still work (they focus the editing host now), so only remove what dead code remains after the arrow deletion; if `focusRow` has no remaining callers (`mergeOrFocusNeighbor` still calls it), keep it.
- Check `TokenHandle` methods orphaned by this deletion: `rg -n "caretOnFirstLine|caretOnLastLine|placeCaretAtX" packages/core/src packages/react packages/vue --type ts`. If the block arrows were the only callers, delete `caretOnFirstLine`/`caretOnLastLine`/`placeCaretAtX` from `TokenHandle` and `isOnFirstLine`/`isOnLastLine`/`setAtX` from `caret.ts` — **⚠ APPROVAL: `TokenHandle` is Store-reachable; show the zero-caller grep in the task report before cutting.**

- [ ] **Step 4: Run and commit**

Run: `pnpm test` → green. `pnpm run typecheck` → green.

```bash
git add packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/keyboard/blockEdit.spec.ts packages/core/src/features/tokens/dom
git commit -m "refactor(keyboard)!: delete cross-row caret transport from blockEdit

Cross-row Left/Right/Up/Down movement is native inside the one host.
The activeElement fallback in findActiveRow dies with it - row identity
is selection-only now."
```

### Task 9: core spec migration sweep

**Files:** every core spec still red. Enumerate them:

```bash
rg -ln "contenteditable|tabindex|activeElement" packages/core/src --type ts | grep spec
```

Known from the measurements: `TokenModel.facade.spec.ts` (activeElement assertions at :65,69,82,85), `TokenHandle.spec.ts:264`, `SelectionDriver.spec.ts:51`, `domBoundary.spec.ts` (boundary fixtures), plus whatever the grep adds.

- [ ] **Step 1: Migrate mechanically, one file per sub-commit if large**

Transformation rules (apply exactly):
1. `expect(document.activeElement).toBe(<span|text surface>)` → `expect(document.activeElement).toBe(container)` (the editing host owns focus).
2. `expect(document.activeElement).toBe(<mark>)` → assert the SELECTION instead: the anchors equal `{before: mark}` / `{after: mark}` (marks are not focusable any more).
3. Fixture DOM built with `span.contentEditable = 'true'` → container `ce=true`, bare spans, marks `ce=false` (mirror the committed policy).
4. Cases whose SUBJECT was the deleted mechanism (flip, focusin sync, tabindex) are deleted, not migrated. List each deleted case in the commit body.

- [ ] **Step 2: Run the full core gates**

Run: `pnpm test` → green, count recorded in the commit body (it will be BELOW baseline by exactly the deleted-mechanism cases; new cases from Tasks 1-8 offset part of it — state both numbers).
Run: `pnpm run typecheck && pnpm run build && pnpm run lint:check && pnpm run format:check` → green.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src
git commit -m "test(core): migrate specs to the one-host DOM

activeElement assertions retarget the editing host; mark-focus
assertions become {before}/{after} anchor assertions; flip and
focusin-sync cases die with their mechanisms (list below)."
```

### Task 10: storybook suites (react + vue)

**Files:** enumerate first —

```bash
rg -ln "contenteditable|tabindex|activeElement" packages/storybook/src
```

Known: `pages/Base/keyboard.react.spec.tsx`, `keyboard.vue.spec.ts`, `Base.*.spec.*`, `Drag.*.spec.*`, `Selection/`, `__snapshots__/stories.react.spec.tsx.snap`, `stories.vue.spec.ts` snapshots, `htmlSnapshot.react.spec.tsx` (~114 selector lines measured).

- [ ] **Step 1: Regenerate the DOM snapshots**

Run: `pnpm -F storybook test:react -- -u` then inspect the snapshot diff BY HAND before accepting: the ONLY changes must be (a) `contenteditable="true"` disappearing from spans, (b) `tabindex="0"` disappearing from mark roots, (c) `contenteditable="false"` appearing on mark roots, (d) `contenteditable="true"` appearing on slot child wrappers, (e) the container gaining `contenteditable="true"`. Any OTHER structural diff is a bug in Tasks 3-8 — stop and fix there, do not accept the snapshot.

- [ ] **Step 2: Migrate the selectors and focus assertions**

Same transformation rules as Task 9, plus:
- `locator('[contenteditable="true"]')` used to enumerate TEXT SPANS → a structural selector for the same spans (e.g. `container.querySelectorAll(':scope > span')` in inline stories) — the container itself now matches `[contenteditable="true"]`.
- Tab-navigation specs (if any assert focus cycling through marks): the new behaviour is Tab LEAVES the field. Rewrite the assertion to that, and name it in the commit body as the breaking-change pin.
- Drag suite specs asserting the flip's `ce=false` sweep: delete.

- [ ] **Step 3: Run both suites to green**

Run: `pnpm -F storybook test:react` → green (record the count).
Run: `pnpm -F storybook test:vue` → green (retry once on the known overlay flake; say you retried).

- [ ] **Step 4: Live sanity sweep in a real browser (the defects this migration exists to kill)**

Run: `pnpm -F storybook dev:react`, open `http://localhost:6006/iframe.html?id=markedinput--configured&viewMode=story` in Chromium, and verify by hand (or via the Playwright MCP if available):
1. Click into each of the first three text spans in turn — the caret lands where clicked EVERY time (the click steal is dead).
2. Sweep-select from span 1 across the first mark into span 2, then press Backspace — the selected text INCLUDING the mark is deleted (the dead-editor state is gone).
3. Tab from inside the field — focus LEAVES the editor.
4. Home/End — caret moves across the whole visual line.
5. Alt+ArrowLeft repeatedly — the caret crosses marks word-by-word.
6. Triple-click — selects the visual line/paragraph, not one span.
7. Arrow Left/Right through a mark — one keystroke per position, no dead stops around empty gaps.
8. Click between two adjacent marks (Nested stories) — a caret appears in the gap; typing inserts into the empty token.

Record the result of each check in the task report. Any failure goes back to its owning task; do not paper over in the storybook spec.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook
git commit -m "test(storybook): migrate suites and snapshots to the one-host DOM

BREAKING pins: Tab leaves the field; focus/blur fire once per real
entry/exit; snapshot diff is exactly the editable-topology change."
```

---

## Stage D — one gating owner

### Task 11: unify `isBlock`/`draggable` gating

Today `BlockController` requires `isBlock && draggable` (`BlockController.ts:27`) while `blockEdit` requires only `isBlock` (`blockEdit.ts:47,63`), so with `draggable: false` the adapter renders grips/menus whose every action is silently swallowed. Decision (encode it, it is the smallest correct one): **`draggable` gates DRAG UI and drag actions; block keyboard editing is gated by `isBlock` alone.** The swallowed-action state dies by making the CONTROLLER accept actions whenever block mode is on, and the adapters gate the drag UI on `draggable`.

**Files:**
- Modify: `packages/core/src/features/block/BlockController.ts:27`
- Verify (no code change expected): `packages/react/markput/src/components/Block.tsx`, `DragHandle.tsx`; `packages/vue/markput/src/components/` equivalents — confirm the grip renders only under `draggable`; if it renders unconditionally, THAT is the bug to fix, in the adapters
- Test: `packages/core/src/features/block/BlockController.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
	it('block actions apply with draggable:false (keyboard/menu actions are not drag UI)', () => {
		store.props.set({
			layout: 'block',
			draggable: false,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		store.block.action({type: 'delete', index: 0})

		expect(store.tokens.value()).toBe('beta\n\n')
	})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- BlockController.spec` → FAIL (the watch returns at `!draggable()`).

- [ ] **Step 3: Implement**

`BlockController.ts:27`: `if (!this.props.layout.isBlock() || !this.props.draggable()) return` → `if (!this.props.layout.isBlock()) return`.

Then verify the adapter side: `rg -n "draggable" packages/react/markput/src packages/vue/markput/src`. The grip/drag-handle render must be conditional on `draggable`; reorder actions must originate only from the grip. If both hold, adapters need no change. The existing "does not leak a watcher when props toggle" spec (`BlockController.spec.ts:17-30`) toggles BOTH layout and draggable — it stays green because layout goes `inline`.

- [ ] **Step 4: Run gates and commit**

Run: `pnpm test` → green. `pnpm -F storybook test:react` / `test:vue` → green.

```bash
git add packages/core/src/features/block
git commit -m "fix(block)!: draggable gates drag UI only, not every block action

BREAKING: with layout:'block' and draggable:false, menu and keyboard
row actions now APPLY instead of being silently swallowed after the
grip/menu had already rendered."
```

---

## Stage E — the documentation debt

### Task 12: rewrite `inconsistencies.md` from the measurements

**Files:**
- Rewrite: `packages/website/src/content/docs/development/inconsistencies.md`

- [ ] **Step 1: Rewrite the page**

Structure (source of truth: `docs/one-host-migration.html`, tab "Measured: N hosts today", plus the post-migration reality after Tasks 3-10):

1. Frontmatter unchanged except `description: Behavior differences between MarkedInput and native input/textarea elements — re-measured against the single-host core`.
2. Opening: the single-host DOM shape (container `ce=true`, bare spans, `ce=false` marks) replaces the N-host diagram at lines 23-38.
3. Resolved by the migration (with the measured pre-migration state for history): the click steal, #4 cross-mark delete, #5 Tab, #6 Home/End, #7 word nav, #8 shift+arrow, #9 triple-click, #10 drag, #11 focus churn.
4. Still open, each with its measured statement:
   - **Undo**: dead for every guarded edit in both topologies (Cmd+Z fires no events after preventDefault'ed input). Needs editor-owned history. Was misdocumented as "works within a span".
   - **IME**: `insertCompositionText` not cancelable; composition unhandled by design.
   - **#2 markup injection via paste**: mechanism unchanged (paste → splice → reparse).
   - **#13 focus ring / #14 ARIA**: unchanged by this migration; note the container is now a natural `role="textbox"` carrier for a future task.
   - **Scope**: Chromium-only decision, Firefox/Safari users exist — restate.
5. Delete the "Works Correctly" table's false rows (undo) and re-verify the survivors against Task 10's live sweep before listing them.

- [ ] **Step 2: Build the website to validate**

Run: `pnpm run typecheck` (regenerates api docs; expected) and `pnpm run build` → green.

- [ ] **Step 3: Commit**

```bash
git add packages/website/src/content/docs/development/inconsistencies.md
git commit -m "docs(website): rewrite inconsistencies from the 2026-08-11 measurements

The N-host defect list is resolved by the single-host migration; the
page now documents what is still true: dead native undo (both
topologies, needs owned history), unhandled IME, paste markup
injection, missing focus ring and ARIA, Chromium-only scope."
```

---

## Post-plan follow-ups (explicitly OUT of this plan)

- **Editor-owned undo history** — required regardless of topology (measured dead in both).
- **IME/composition handling** — `insertCompositionText` is not cancelable; needs its own design.
- **Block-selection mode** (rows-as-objects UX, ProseMirror NodeSelection precedent) — maintainer-approved as a LATER feature.
- **ARIA/`role="textbox"`** on the container — natural next step after the flip; separate task.
- **Adapter dedup** (react/vue ~90% duplicated) — separate decision; note the Suggestions keydown semantics DIFFER between adapters (React re-registers over a captured length, Vue reads live) — that is a semantics decision, not a move.
- **`prepack.js` overwriting the Vite build** — own issue.
- Committed bench artifacts (1569 lines) — free deletion, own commit, any time.

## Self-review notes (already applied)

- Task 2's `mergeDragRows` composition is the highest-risk code in the plan; its spec porting note is load-bearing — the old merge expectations drive the final composition.
- Task 5 changes `placeCaret` for markless handles from "inside the mark" to "parent coordinates"; `DomModel.#targetOf`'s `{before}`/`{after}` → `offset 0/Infinity` mapping (`DomModel.ts:216-228`) is compatible as-is (0 → before-index, Infinity → after-index), so `DomModel` needs no change in that task — which is why no task touches `#surfaceAt` beyond what `selectRange` already does. If browser testing in Task 10 shows `selectRange` refusing `{before: mark}` endpoints matters in practice, extend `#surfaceAt` to answer mark parents the same way `placeCaret` does — as a follow-up with its own spec, not silently.
- Approval markers appear on: TokenModel `setEditable`/`isUserSelecting` surface (Tasks 3, 4, 6), keyboard barrel export (Task 7), TokenHandle caret-measure methods (Task 8). Nothing else touches `store/**` or `MarkputApi`.
