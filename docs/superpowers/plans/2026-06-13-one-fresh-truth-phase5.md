# One Fresh Truth — Phase 5: De-reactify + Surface Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trade win-4's per-node reactivity for plain getters, delete the dead handle/model surface, and collapse the six selection micro-reads into one snapshot. Concretely: (1) `TokenHandle`'s `token`/`element`/`text`/`address`/`dead` stop being per-node `Computed`s that track a `dirty` signal — they become PLAIN getters reading the backing fields (the win-4 trade — "handle getters stay methods, so per-node signals can return behind them additively"; reversible because the method signatures are unchanged). The per-node `dirty` signal, the `changed: Event<TokenChange>` event, and the `TokenChange`/`TokenSnapshot` plumbing die with it. (2) The dead-surface members the spec's "What dies" table names — `TokenModel.tokenAt`, `TokenModel.handles()`, `TokenModel.caretFromPoint`, and handle `changed`/`dead`/`text`/`caretRect`/`placeCaretAtBoundary`/`address()` — are deleted (all grep-verified to have ZERO production consumers; only specs read them). (3) The six selection micro-reads (`readSelection`/`selectionRect`/`selectionAnchor`/`isSelectionCollapsed`/`selectionIntersects`/`selectionFocusNode`) plus the `!== false` tri-state collapse into one `selection(): SelectionSnapshot | undefined`. This phase breaks NO public API the consumers use (the deleted members have no production callers) — it is a surface trim, not a semver-major. The semver-major boundary was Phase 4.

**Architecture:** Win 4 (fine-grained per-node reactivity) was consciously traded in the spec's four-wins table: "zero reactive consumers exist; render gates are satisfied by `renderTree` reference stability + direct textContent patching; no surveyed editor puts signals on document nodes." A full-consolidation-cycle grep (re-verified at this HEAD) confirms ZERO production code subscribes to a handle's `token`/`element`/`text`/`address`/`dead` reactively, and ZERO subscribes to `handle.changed`. The only consumers of those reactive getters are: (a) TokenModel's own internal reads (`#view` reads `handle.token()`; `placeCaret`/`setEditable` read `handle.token()`) — these are plain reads, not tracked subscriptions; (b) the `commit.ts` divergence detector reads `handle.token().content`; (c) `commit.ts:233` reads `handle.address().path` for an error message; (d) `blockEdit.ts:36` reads `handle.address().path[0]`. None of these needs reactivity — they read the current value once. So the `Computed` wrapper + `dirty()` dependency is pure overhead: a plain getter that returns `this.#token` / `this.#tokenElement` is behaviorally identical for every real caller, and the per-node `dirty` signal + the `changed` event + the `batch`/`computed`/`signal`/`event` imports they require all collapse out.

The dead-surface members are independent: `tokenAt`, `handles()`, `caretFromPoint` on `TokenModel`, and `caretRect`/`placeCaretAtBoundary` on the handle, were each grep-verified to have ZERO production callers (only specs probe them). They are removed and their specs deleted.

The six selection micro-reads are the model's window-selection face. Today each is a thin one-liner over `window.getSelection()`, and the `isSelectionCollapsed()` one returns a tri-state (`undefined` = no Selection object, `true` = collapsed, `false` = range) that one caller compares with `!== false`. Phase 5 replaces all six with one `selection(): SelectionSnapshot | undefined` that snapshots the live selection ONCE and exposes every field the six reads exposed. `selection()` returns `undefined` exactly when `window.getSelection()` has no range (the old tri-state `undefined` arm), so `selection()?.collapsed !== false` is the literal replacement for `isSelectionCollapsed() !== false`. The snapshot's `raw` field (absolute in-editor positions) is itself optional, set only when the boundary mapping resolves — matching today's `readSelection()` returning `undefined` for an out-of-editor selection while `anchor`/`focusNode`/`intersects` still reflect the raw selection.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full core suite). To run ONE spec: `pnpm -w exec vitest run --project core <path-or-pattern>`. Storybook page specs (the react/vue vitest projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck` (recursive `tsc --noEmit` / `vue-tsc --noEmit` across all packages). Encapsulation guard: `pnpm run check:encapsulation`. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of `.ts`/`.tsx` files** (`.vue` SFCs DO end with a newline — match each file).

**Commits in a shared checkout:** other agents work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times. If a pre-commit hook reflows a file you did not edit (MM, cosmetic-only vs HEAD), `git reset HEAD -- <file>` rather than commit churn.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 5: "plain handle getters; dead members + isolation specs deleted; `selection()` snapshot replaces the six micro-reads"; §Public API → `selection(): SelectionSnapshot | undefined` / `TokenHandle = {id, token(), path(), alive(), element(), caret/measure commands} — plain getters, no signals`; the four-wins table win 4 → "consciously traded for fine-grained DOM patching … Reversible: handle getters stay methods, so per-node signals can return behind them additively"; "What dies" → "Per-node dirty signals + reactive getters + isolation specs → plain getters (win-4 trade)" / "Dead surface: `tokenAt`, `handles()`, `caretFromPoint`, `handle.changed/.dead/.text/.caretRect/.placeCaretAtBoundary`, `address()`" / "Six selection micro-reads + `!== false` tri-state → one `selection()` snapshot"; "Reversal triggers" → "a real consumer for per-node mark reactivity → re-add dirty signals behind the getters" — NOT triggered; the trade is the default).

**Background facts (probe-verified against post-Phase-4 HEAD, do not re-derive):**

- **`TokenHandle`'s reactive getters and their backing.** `LiveNode.ts` declares: `dirty: Signal<number>` (per-node version, bumped by `#bumpDirty` in `update`/`bindElements`/`unbind`/`kill`); `#dead: Signal<boolean>` + `dead: Computed<boolean>`; `token: Computed<Token>` (reads `this.dirty()` then `this.#token`); `address: Computed<TokenSnapshot>` (reads `this.dirty()` then `{path:[...this.#path], token:this.#token}`, marked `@deprecated Phase-5 deletion target`); `element: Computed<HTMLElement|undefined>` (reads `this.dirty()` then `this.#tokenElement`); `text: Computed<string>` (reads `this.token().content`). The plain getters `path()` and `alive()` (added in Phase 4) read `this.dirty()` / `this.#dead()` directly. `changed: Event<TokenChange>` fires `text`/`moved`/`unmounted`. `kill()` flips `#dead` and fires `unmounted`.
- **`update()` MUST be kept** — it is the pipeline's in-place refresh: `commit.ts:158` `for (const {handle, token, path} of updates) handle.update(token, path)`. Phase 5 keeps `update(token, path)` refreshing `#token`/`#path`; it drops the `batch`/`#bumpDirty`/`changed` emit and the `previousAddress` snapshot. `bindElements`/`unbind`/`kill` keep clearing/setting `#tokenElement` etc. but drop `#bumpDirty`. `kill` keeps flipping `#dead` (now a plain boolean field) but drops the `changed({kind:'unmounted'})` emit.
- **ZERO production reactive consumers of handle getters (grep-verified, this HEAD):** no production file subscribes to `handle.token`/`element`/`text`/`address`/`dead` inside an `effect`/`computed`/`watch`. The internal reads are plain one-shot calls: `TokenModel.#view` (`handle.token()`), `placeCaret` (`handle.token().type`), `setEditable` (`handle.token().type`), `commit.ts` divergence (`handle.token().content`). The adapters read `overlay.element()` (an OverlayController signal, NOT a handle) — never a handle's reactive getter. So converting the getters to plain methods changes no observable behavior.
- **ZERO production subscribers of `handle.changed` (grep-verified):** only `commit.spec.ts`, `bind.spec.ts`, `LiveNode.spec.ts` `watch(handle.changed, …)`. No `src` non-spec file subscribes. The MODEL-level `pipeline.changed` (TokenModel's `changed: Event<void>`) is a DIFFERENT event and STAYS — SelectionController/Clipboard/etc. subscribe to it. Do NOT touch `pipeline.changed` / `TokenModel.changed`.
- **Dead-surface members — grep-verified ZERO production consumers (only specs):**
  - `TokenModel.tokenAt(position)` — callers: `TokenModel.facade.spec.ts` (lines 236-243, 300), `model/TokenModel.spec.ts` (156, 275-282, 346-353). No production caller. **Delete.**
  - `TokenModel.handles()` — callers: `TokenModel.index.spec.ts` (91), `TokenHandle.spec.ts` (78), `model/TokenModel.spec.ts` (154, 237). Production iterates `#pipeline.byPath().values()` directly (`#views`, `setEditable`), NEVER `handles()`. **Delete.**
  - `TokenModel.caretFromPoint(x,y)` — callers: `model/TokenModel.spec.ts` (357-369) only. **Delete.**
  - `TokenHandle.caretRect(offset)` — callers: `LiveNode.spec.ts` (273-279, 311). No production. **Delete.**
  - `TokenHandle.placeCaretAtBoundary(side)` — callers: `LiveNode.spec.ts` (323, 366-368, 372-379, 432). No production (block up/down uses `placeCaretAtX`; selection uses `placeCaret`). **Delete.**
  - `TokenHandle.text()` — callers: `TokenHandle.spec.ts`, `LiveNode.spec.ts`, `bind.spec.ts`, `commit.spec.ts`. No production (`commit.ts` divergence reads `handle.token().content`, not `handle.text()`). **Delete.**
  - `TokenHandle.dead()` — callers: `TokenHandle.spec.ts`, `bind.spec.ts`, `LiveNode.spec.ts`, `commit.spec.ts`. No production (`alive()` reads the private `#dead` field). **Delete the public getter; keep the private `#dead` state.**
  - `TokenHandle.address()` — production callers: `commit.ts:233` (`handle.address().path.join`), `blockEdit.ts:36` (`handle.address().path[0]`). Both migrate to `handle.path()` FIRST (Task 1), then `address()` + `TokenSnapshot` + the `moved` change variant + the `changed` event die.
  - `TokenHandle.changed` event + `TokenChange` type + `TokenSnapshot` type — `TokenChange` is exported from `tokens/index.ts` (NOT from public `core/index.ts`; internal-only). Consumed by `commit.spec.ts` (`import type {TokenChange}` + `markChanges`/`childChanges`/`tailChanges` arrays). Migrate those spec assertions to read final `handle.token()` state, then delete the event/types.
- **The six selection micro-reads + consumers (grep-verified, COMPLETE):**
  - `readSelection(): RawSelection | undefined` — `SelectionController.readRaw()` (line 73) → consumed by `ClipboardController.#handleCopy`/cut (via `selection.readRaw()`) and `SelectionController.#trackSelection.sync` (`this.readRaw()?.range`). Returns `{range:{start,end}, direction?}` — absolute in-editor positions; `undefined` when the boundary mapping fails (selection outside editor).
  - `selectionRect(): DOMRect | undefined` — `OverlayController.position` (line 31, reads `.left`/`.top`/`.height`), `blockEdit.ts` (205, 216, reads `.left`).
  - `selectionAnchor(): SelectionAnchor | undefined` where `SelectionAnchor = {node, offset, isCollapsed}` — `TriggerFinder` (24, 39), `OverlayController.#probeTriggerFromCaretRange` (152, reads `?.node`).
  - `isSelectionCollapsed(): boolean | undefined` — `SelectionController.#trackUserSelecting.clearIfCollapsed` (166, `!== false`). The ONLY tri-state caller.
  - `selectionIntersects(node): boolean` — `SelectionController.#trackUserSelecting` (157, `selectionIntersects(container)`). Takes a node arg.
  - `selectionFocusNode(): Node | undefined` — `SelectionController.#trackSelection` (210, `selectionchange` handler).
- **`selectedContent()` is NOT one of the six and STAYS** — `ClipboardController.#handleCopy` reads `tokens.selectedContent()`. It serializes the selection to clipboard HTML/text; orthogonal to the snapshot. Leave it.
- **The `SelectionSnapshot` shape (DECIDED — every field maps to exactly one micro-read):**
  ```ts
  export type SelectionSnapshot = {
  	/** Absolute in-editor positions of the selection, or undefined if it falls outside any bound token (replaces readSelection()). */
  	readonly raw: RawSelection | undefined
  	/** Viewport rect of the caret/selection (replaces selectionRect()). */
  	readonly rect: DOMRect | undefined
  	/** Anchor node + offset + collapsed flag of the raw window selection (replaces selectionAnchor()). */
  	readonly anchor: SelectionAnchor
  	/** Whether the raw selection is collapsed (replaces isSelectionCollapsed()'s `true`/`false` arms; the old `undefined` arm is now selection() itself returning undefined). */
  	readonly collapsed: boolean
  	/** Focus node of the raw window selection (replaces selectionFocusNode()). */
  	readonly focusNode: Node | undefined
  	/** Whether the raw selection intersects `node`, partial containment counting (replaces selectionIntersects(node)). */
  	intersects(node: Node): boolean
  }
  ```
  `selection()` returns `undefined` iff `window.getSelection()` is null OR `rangeCount === 0` (the old `isSelectionCollapsed() === undefined` arm AND the case where there is no range to read). When a snapshot exists, `anchor` is always present (the selection has an anchorNode whenever it has a range), `raw` is set only when both boundaries map into the editor, `rect`/`focusNode` reflect the raw selection, and `intersects` closes over the live `Selection`. `SelectionAnchor` stays exported (TriggerFinder's `anchor?` param keeps using it).
- **`removeAllRanges` / no-selection behavior:** in the test environment a freshly-mounted editor with no focus has `window.getSelection()` returning a Selection with `rangeCount === 0` after `removeAllRanges()`. The facade specs that assert `readSelection()` round-trips first place a caret (so `rangeCount === 1`). The new `selection()` returns `undefined` for `rangeCount === 0`; callers that did `isSelectionCollapsed() !== false` get `undefined?.collapsed !== false` → `undefined !== false` → `true` (treats no-selection as collapsed — identical to today's `!sel || sel.isCollapsed`).
- **No name collision.** `TokenModel` has no `selection` member today (`SelectionController` is a separate class). The method name `selection()` is free on `TokenModel`.
- **`getRect()`** (`caret.ts:27`) backs `selectionRect`. `window.getSelection()` is read directly by five of the six. The snapshot builds all fields from a single `window.getSelection()` read plus `getRect()` for the rect.
- **Signals imports shrink.** `LiveNode.ts` imports `{batch, computed, event, signal}` + types `{Computed, Event, Signal}`. After Phase 5, `LiveNode` uses NONE of them (plain fields, no batch, no event). Drop the whole signals import. `TokenModel.ts` keeps `{computed, watch}` (used by `#parser`/`#reconciled`/the mount watches) — unchanged.

---

### Task 1: Migrate the two production `handle.address()` readers to `handle.path()`

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts` (`findActiveRow`)
- Modify: `packages/core/src/features/tokens/model/commit.ts` (divergence error message)

`address()` has exactly two production readers, both reading `.path` off the snapshot. `path()` (added in Phase 4) returns the same `TokenPath` directly. Migrate them so `address()` becomes spec-only, ready for deletion in Task 4. This task is behavior-preserving (the path value is identical) and keeps the suite green.

- [x] **Step 1: Capture the baseline**

Run: `pnpm -w exec vitest run --project core "model/commit.spec"`
Run: `pnpm -F core test`
Expected: full pass (the pre-change baseline; `blockEdit` is exercised via storybook + keyboard specs in the full run).

- [x] **Step 2: `blockEdit.ts` — `findActiveRow`**

In `blockEdit.ts`, change line 36 from:

```ts
	const index = handle.address().path[0]
```

to:

```ts
	const index = handle.path()[0]
```

- [x] **Step 3: `commit.ts` — divergence message**

In `commit.ts` (~line 233), change:

```ts
				`TokenModel divergence at [${handle.address().path.join(', ')}]: DOM "${actual}" ≠ model "${expected}"`
```

to:

```ts
				`TokenModel divergence at [${handle.path().join(', ')}]: DOM "${actual}" ≠ model "${expected}"`
```

- [x] **Step 4: Verify zero production `address()` readers remain**

Run:

```bash
grep -rn "\.address()" packages/core/src --include="*.ts" | grep -v "\.spec\."
```

Expected: ZERO hits (production). Only spec files may still read `.address()` (migrated/deleted in Task 4).

- [x] **Step 5: Run the affected specs + full core**

Run: `pnpm -w exec vitest run --project core "model/commit.spec"`
Expected: full pass (the divergence message is only asserted on the divergence-throw path; the path string is unchanged).

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean.

- [x] **Step 6: Commit**

```bash
git commit -m "refactor(tokens): production address() readers use handle.path()" -- packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/tokens/model/commit.ts
```

---

### Task 2: Add `selection()` to `TokenModel` — the one snapshot (additive)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (add `SelectionSnapshot` type + `selection()`; keep the six micro-reads for now)
- Modify: `packages/core/src/features/tokens/index.ts` (export `SelectionSnapshot`)
- Modify: `packages/core/index.ts` (public-export `SelectionSnapshot`)
- Modify: `packages/core/src/features/tokens/TokenModel.facade.spec.ts` (pin `selection()` parity)

PURELY ADDITIVE: `selection()` lands alongside the six micro-reads so the suite stays green. Tasks 3 migrate the consumers onto it, then Task 4-region deletes the six.

- [x] **Step 1: Write the failing parity tests**

In `TokenModel.facade.spec.ts`, read the existing `readSelection reads the live selection …` test (~lines 217-233) — it shows the exact selection-setup idiom this file uses: `mountWithMark()` (the module-scoped fixture: text `'he'` [0,2], mark `'@[x]'` [2,6], text `'llo'` [6,9], returning `{store, container}`), then walk to the first text node via `document.createTreeWalker(container, NodeFilter.SHOW_TEXT)` and build a `Range` on it. The first text token `'he'` starts at absolute position 0. Append a new top-level describe (after the `TokenModel placement commands` describe near the file end; `mountWithMark` is module-scoped and reusable):

```ts
describe('TokenModel selection() — the one snapshot', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined when there is no range', () => {
		const {store} = mountWithMark()
		window.getSelection()?.removeAllRanges()
		expect(store.tokens.selection()).toBeUndefined()
	})

	it('carries raw absolute positions, anchor, collapsed, focusNode, rect, and intersects', () => {
		const {store, container} = mountWithMark()
		const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
		if (!(firstText instanceof Text) || firstText.length < 2) throw new Error('expected the "he" text node')
		const range = document.createRange()
		range.setStart(firstText, 0)
		range.setEnd(firstText, 2)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		const snapshot = store.tokens.selection()
		if (!snapshot) throw new Error('expected a selection snapshot')
		// "he" is [0,2] absolute.
		expect(snapshot.raw?.range).toEqual({start: 0, end: 2})
		expect(snapshot.collapsed).toBe(false)
		expect(snapshot.anchor.node).toBe(firstText)
		expect(snapshot.anchor.isCollapsed).toBe(false)
		expect(snapshot.focusNode).toBe(firstText)
		expect(snapshot.rect).toBeInstanceOf(DOMRect)
		expect(snapshot.intersects(firstText)).toBe(true)
		expect(snapshot.intersects(document.body)).toBe(true)
	})

	it('collapsed is true and raw is a zero-width range for a caret', () => {
		const {store, container} = mountWithMark()
		const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
		if (!(firstText instanceof Text) || firstText.length < 1) throw new Error('expected the "he" text node')
		const range = document.createRange()
		range.setStart(firstText, 1)
		range.collapse(true)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		const snapshot = store.tokens.selection()
		if (!snapshot) throw new Error('expected a selection snapshot')
		expect(snapshot.collapsed).toBe(true)
		expect(snapshot.raw?.range).toEqual({start: 1, end: 1})
	})
})
```

(`mountWithMark()` is the file's existing fixture — verify its return shape `{store, container}` and the first text node `'he'` at the top of the file before writing. Do NOT invent a `mountInline`/`span` helper; the facade spec has no such helper.)

- [x] **Step 2: Run to verify they fail**

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: the 3 new tests FAIL (`store.tokens.selection` is not a function). All pre-existing facade tests pass.

- [x] **Step 3: Add the `SelectionSnapshot` type + `selection()` to `TokenModel.ts`**

In `TokenModel.ts`, add the type right after the existing `SelectionAnchor` type (~line 21):

```ts
export type SelectionSnapshot = {
	/** Absolute in-editor positions of the selection, or undefined if it falls outside any bound token. */
	readonly raw: RawSelection | undefined
	/** Viewport rect of the caret/selection. */
	readonly rect: DOMRect | undefined
	/** Anchor node + offset + collapsed flag of the raw window selection. */
	readonly anchor: SelectionAnchor
	/** Whether the raw selection is collapsed. */
	readonly collapsed: boolean
	/** Focus node of the raw window selection. */
	readonly focusNode: Node | undefined
	/** Whether the raw selection intersects `node` (partial containment counts). */
	intersects(node: Node): boolean
}
```

Then add the `selection()` method directly above the existing `readSelection()` (~line 291), reading the live selection ONCE and building every field:

```ts
	/**
	 * THE selection read: one snapshot of the live window selection, or
	 * `undefined` when there is no range (the element is unfocused / nothing
	 * selected). Subsumes the six micro-reads — `raw` is the absolute in-editor
	 * range (undefined when the selection is outside the editor), `rect`/`anchor`/
	 * `collapsed`/`focusNode` reflect the raw selection, and `intersects` closes
	 * over it. A consumer that treated "no selection" as collapsed compares
	 * `selection()?.collapsed !== false`.
	 */
	selection(): SelectionSnapshot | undefined {
		const sel = window.getSelection()
		if (!sel || sel.rangeCount === 0) return undefined
		const anchorNode = sel.anchorNode
		if (!anchorNode) return undefined
		return {
			raw: this.#rawSelectionFrom(sel),
			rect: getRect() ?? undefined,
			anchor: {node: anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed},
			collapsed: sel.isCollapsed,
			focusNode: sel.focusNode ?? undefined,
			intersects: node => sel.containsNode(node, true),
		}
	}

	/** Absolute in-editor positions of a window selection's first range, or undefined if it maps outside any bound token. */
	#rawSelectionFrom(selection: Selection): RawSelection | undefined {
		const range = selection.getRangeAt(0)
		const start = this.boundaryFor(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.boundaryFor(range.endContainer, range.endOffset, 'before')
		if (end === undefined) return undefined

		const rangeValue = start <= end ? {start, end} : {start: end, end: start}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return direction ? {range: rangeValue, direction} : {range: rangeValue}
	}
```

(`#rawSelectionFrom` is the body of the existing `readSelection()` lifted to take the `Selection` directly — `readSelection()` will delegate to it in Step 4 so the two share one implementation until `readSelection` is deleted. `getRect` is already imported — verify line 9: `import {focusIfNeeded, getRect, …} from '../caret'`. `RawSelection`/`SelectionAnchor` are in scope.)

- [x] **Step 4: Re-point `readSelection()` at the shared helper (keep it green)**

In `TokenModel.ts`, replace the body of the existing `readSelection()` (~lines 292-311) so it delegates to the new helper (avoids two copies until `readSelection` is deleted with its consumers):

```ts
	/** Current window selection as absolute positions. */
	readSelection(): RawSelection | undefined {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined
		return this.#rawSelectionFrom(selection)
	}
```

- [x] **Step 5: Run the facade spec**

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass — the 3 new `selection()` tests green, all pre-existing `readSelection`/`tokenAt` tests still green.

- [x] **Step 6: Export `SelectionSnapshot`**

In `packages/core/src/features/tokens/index.ts`, extend the `SelectionAnchor` export line:

```ts
export type {SelectionAnchor, SelectionSnapshot} from './model/TokenModel'
```

In `packages/core/index.ts`, add `SelectionSnapshot` to the `tokens` re-export. Find the block re-exporting token types (it currently re-exports `Markup, Token, TextToken, MarkToken` from `./src/features/tokens`). Add a sibling export so consumers can name the type:

```ts
export type {SelectionSnapshot} from './src/features/tokens'
```

(Insert it adjacent to the existing `export type {Markup, Token, TextToken, MarkToken} from './src/features/tokens'` line.)

- [x] **Step 7: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass (additive — `selection()` alongside the six).

Run: `pnpm run typecheck`
Expected: clean.

- [x] **Step 8: Commit**

```bash
git commit -m "feat(tokens): add selection() — the one selection snapshot" -- packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/index.ts packages/core/index.ts packages/core/src/features/tokens/TokenModel.facade.spec.ts
```

---

### Task 3: Migrate the selection consumers onto `selection()`; delete the six micro-reads

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts` (`readRaw`, `#trackUserSelecting`, `#trackSelection`)
- Modify: `packages/core/src/features/overlay/OverlayController.ts` (`position`, `#probeTriggerFromCaretRange`)
- Modify: `packages/core/src/features/overlay/TriggerFinder.ts` (`selectionAnchor` reads)
- Modify: `packages/core/src/features/keyboard/blockEdit.ts` (`selectionRect` reads)
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (delete `readSelection`, `selectionRect`, `selectionAnchor`, `isSelectionCollapsed`, `selectionIntersects`, `selectionFocusNode`)
- Modify: `packages/core/src/features/tokens/model/TokenModel.spec.ts` (the model-spec micro-read tests)
- Modify: `packages/core/src/features/tokens/TokenModel.facade.spec.ts` (the facade `readSelection`/`tokenAt` micro-read tests)

Each consumer reads the snapshot ONCE per call and pulls the field it needs. `readSelection()` survives implicitly as `selection()?.raw`. After all consumers migrate, the six methods have zero callers and are deleted.

- [x] **Step 1: `SelectionController.readRaw()` → `selection()?.raw`**

In `SelectionController.ts`, change `readRaw()` (~lines 72-74) from:

```ts
	readRaw(): RawSelection | undefined {
		return this.tokens.readSelection()
	}
```

to:

```ts
	readRaw(): RawSelection | undefined {
		return this.tokens.selection()?.raw
	}
```

(`readRaw()` is the public method ClipboardController + `#trackSelection.sync` call — keep it as the thin wrapper. `RawSelection` import on line 3 stays.)

- [x] **Step 2: `SelectionController.#trackUserSelecting` — intersects + collapsed**

In `#trackUserSelecting` (~lines 146-175), the `mousemove` handler reads `selectionIntersects(container)` and `clearIfCollapsed` reads `isSelectionCollapsed() !== false`. Read the live snapshot once per event. Change the `mousemove` listener (~lines 153-161) from:

```ts
		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const startedOutsideEditor = !container.contains(pressedAt)
			const sweepingAcrossNodes = pressedAt !== e.target
			const selectionIntersectsEditor = this.tokens.selectionIntersects(container)
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})
```

to:

```ts
		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const startedOutsideEditor = !container.contains(pressedAt)
			const sweepingAcrossNodes = pressedAt !== e.target
			const selectionIntersectsEditor = this.tokens.selection()?.intersects(container) ?? false
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})
```

Change `clearIfCollapsed` (~lines 163-167) from:

```ts
		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			// No selection (undefined) is treated like collapsed, matching the raw `!sel || sel.isCollapsed`.
			if (this.tokens.isSelectionCollapsed() !== false) this.isUserSelecting(false)
		}
```

to:

```ts
		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			// No selection (undefined) is treated like collapsed, matching the raw `!sel || sel.isCollapsed`.
			if (this.tokens.selection()?.collapsed !== false) this.isUserSelecting(false)
		}
```

(The tri-state collapses: `selection()` is `undefined` for no range → `undefined?.collapsed` is `undefined` → `undefined !== false` is `true` — identical to the old `isSelectionCollapsed() === undefined → undefined !== false → true`.)

- [x] **Step 3: `SelectionController.#trackSelection` — focusNode**

In `#trackSelection` (~lines 208-213), change the `selectionchange` listener from:

```ts
		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const focusNode = this.tokens.selectionFocusNode()
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
```

to:

```ts
		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const focusNode = this.tokens.selection()?.focusNode
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
```

- [x] **Step 4: `OverlayController` — rect + anchor**

In `OverlayController.ts`, change `position` (~lines 29-34) from:

```ts
	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = this.tokens.selectionRect()
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})
```

to:

```ts
	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = this.tokens.selection()?.rect
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})
```

Change `#probeTriggerFromCaretRange`'s `node` field (~line 152) from:

```ts
				node: this.tokens.selectionAnchor()?.node ?? this.host.container() ?? document.body,
```

to:

```ts
				node: this.tokens.selection()?.anchor.node ?? this.host.container() ?? document.body,
```

- [x] **Step 5: `TriggerFinder` — anchor**

In `TriggerFinder.ts`, the constructor (~line 24) and the static `find` (~line 39) both read `tokens.selectionAnchor()`. Change line 24 from:

```ts
		const resolvedAnchor = anchor ?? tokens.selectionAnchor()
```

to:

```ts
		const resolvedAnchor = anchor ?? tokens.selection()?.anchor
```

Change line 39 from:

```ts
		const resolvedAnchor = anchor ?? tokens.selectionAnchor()
```

to:

```ts
		const resolvedAnchor = anchor ?? tokens.selection()?.anchor
```

(The `SelectionAnchor` import on line 4 STAYS — the `anchor?` constructor/`find` param still uses it. `selection()?.anchor` is typed `SelectionAnchor | undefined`, matching `anchor ?? …`.)

- [x] **Step 6: `blockEdit.ts` — selectionRect ×2**

In `blockEdit.ts`, change line 205 from:

```ts
		const caretX = store.tokens.selectionRect()?.left ?? handle.rect()?.left ?? 0
```

to:

```ts
		const caretX = store.tokens.selection()?.rect?.left ?? handle.rect()?.left ?? 0
```

Change line 216 (the DOWN branch, identical text) the same way:

```ts
		const caretX = store.tokens.selection()?.rect?.left ?? handle.rect()?.left ?? 0
```

- [x] **Step 7: Verify zero production callers of the six remain**

Run:

```bash
grep -rn "readSelection\|selectionRect\|selectionAnchor\|isSelectionCollapsed\|selectionIntersects\|selectionFocusNode" packages/core/src --include="*.ts" | grep -v "\.spec\." | grep -v "model/TokenModel.ts"
```

Expected: ZERO hits (every production caller migrated; only the method DEFINITIONS in `model/TokenModel.ts` remain). If a call site remains, migrate it before deleting.

- [x] **Step 8: Delete the six micro-reads from `TokenModel.ts`**

In `TokenModel.ts`, delete the entire `readSelection` method (now only `selection()`/`#rawSelectionFrom` provide the raw read — `readSelection` has no caller after Step 1). Delete `selectionRect`, `selectionAnchor`, `isSelectionCollapsed` (with its tri-state JSDoc block), `selectionIntersects`, and `selectionFocusNode`. The methods to delete (verbatim, ~lines 291-357 in the post-Task-2 file — `selectedContent` at ~313-322 is BETWEEN them and STAYS):

```ts
	/** Current window selection as absolute positions. */
	readSelection(): RawSelection | undefined {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined
		return this.#rawSelectionFrom(selection)
	}
```

```ts
	/** Viewport rect of the current caret/selection. */
	selectionRect(): DOMRect | undefined {
		return getRect() ?? undefined
	}

	/** Anchor node + offset of the current selection (overlay trigger probing). */
	selectionAnchor(): SelectionAnchor | undefined {
		const sel = window.getSelection()
		if (!sel?.anchorNode) return undefined
		return {node: sel.anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed}
	}

	/**
	 * Whether the current selection is collapsed.
	 *
	 * Tri-state: `undefined` when there is no Selection object at all (in
	 * practice: the element is not focused), `true` for a collapsed caret,
	 * `false` for a range. Callers wanting "no selection counts as collapsed"
	 * must compare `isSelectionCollapsed() !== false`.
	 */
	isSelectionCollapsed(): boolean | undefined {
		const sel = window.getSelection()
		return sel ? sel.isCollapsed : undefined
	}

	/** Whether the current selection intersects `node` (partial containment counts). */
	selectionIntersects(node: Node): boolean {
		return window.getSelection()?.containsNode(node, true) ?? false
	}

	/** Focus node of the current selection, if any. */
	selectionFocusNode(): Node | undefined {
		return window.getSelection()?.focusNode ?? undefined
	}
```

(Keep `selectedContent()` and `#rawSelectionFrom` — both still used: `selectedContent` by ClipboardController, `#rawSelectionFrom` by `selection()`. `getRect` is still imported and used inside `selection()`.)

- [x] **Step 9: Migrate the model-spec + facade-spec micro-read tests**

In `model/TokenModel.spec.ts`, the selection-read tests (~lines 357-412) read `selectionRect`/`isSelectionCollapsed`/`selectionAnchor`/`selectionFocusNode`/`selectionIntersects`/`readSelection`/`caretFromPoint`. Migrate each to the snapshot (and DROP the `caretFromPoint` block — deleted in Task 4; if it shares a test with `selectionRect`, split the surviving `selectionRect` assertion onto `selection()?.rect`). Read the block first, then for each:
- `model.readSelection()` → `model.selection()?.raw`
- `model.selectionRect()` → `model.selection()?.rect`
- `model.isSelectionCollapsed()` → `model.selection()?.collapsed` (note: a no-range case that asserted `undefined` now asserts the whole `selection()` is `undefined`)
- `model.selectionAnchor()` → `model.selection()?.anchor`
- `model.selectionFocusNode()` → `model.selection()?.focusNode`
- `model.selectionIntersects(text1)` → `model.selection()?.intersects(text1)`

(The `caretFromPoint agrees …` test at ~357-369 is a Task-4 deletion target. If it constructs the `oldRect`/`newRect` via `selectionRect()`, and the test's PURPOSE is `caretFromPoint`, delete the whole `it(...)` here and note it in Task 4. If a sibling assertion in the same `it` still needs `selectionRect`, lift that assertion into the `selection()?.rect` migration above and delete only the `caretFromPoint` lines.)

In `TokenModel.facade.spec.ts`, the `readSelection reads the live selection …` test (~217-234) and the `placeCaret(raw) … readSelection round-trips` test (~253-258, 286, 294) read `store.tokens.readSelection()`. Migrate each `store.tokens.readSelection()` → `store.tokens.selection()?.raw`. (Keep the test titles or rename to `selection().raw`.) The `tokenAt` test at ~236-243 is a Task-4 deletion target — leave it for now (it still passes; `tokenAt` exists until Task 4).

- [x] **Step 10: Run the affected specs + full core + typecheck**

Run, expecting full pass each:

```bash
pnpm -w exec vitest run --project core SelectionController.spec
pnpm -w exec vitest run --project core TokenModel.facade.spec
pnpm -w exec vitest run --project core "model/TokenModel.spec"
pnpm -w exec vitest run --project core OverlayController
pnpm -w exec vitest run --project core TriggerFinder.spec
```

Run: `pnpm -F core test`
Expected: full pass (overlay + clipboard + block keyboard exercised in the full run).

Run: `pnpm run typecheck`
Expected: clean — `TokenModel` no longer declares the six; `RawSelection`/`SelectionAnchor` imports stay (used by `selection()`/`#rawSelectionFrom`/the `SelectionSnapshot` type).

- [x] **Step 11: Commit**

```bash
git commit -m "refactor(selection): consumers read selection() snapshot; delete six micro-reads" -- packages/core/src/features/selection/SelectionController.ts packages/core/src/features/overlay/OverlayController.ts packages/core/src/features/overlay/TriggerFinder.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/model/TokenModel.spec.ts packages/core/src/features/tokens/TokenModel.facade.spec.ts
```

---

### Task 4: Delete the dead `TokenModel` surface — `tokenAt`, `handles()`, `caretFromPoint`

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (delete the three methods)
- Modify: `packages/core/src/features/tokens/TokenModel.facade.spec.ts` (delete `tokenAt` tests)
- Modify: `packages/core/src/features/tokens/model/TokenModel.spec.ts` (delete `tokenAt`/`caretFromPoint`/`handles()` tests)
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts` (delete the `handles()` read)
- Modify: `packages/core/src/features/tokens/TokenHandle.spec.ts` (delete the `handles()` read)

All three are grep-verified to have ZERO production consumers (Task background facts). Delete the methods and the specs that probe them. `handleAt` (the surviving DOM lookup) and `handle(id)` (the surviving id lookup) remain.

- [x] **Step 1: Re-verify zero production consumers**

Run:

```bash
grep -rn "\.tokenAt(\|\.handles()\|\.caretFromPoint(" packages/core/src packages/react/markput/src packages/vue/markput/src --include="*.ts" --include="*.tsx" --include="*.vue" | grep -v "\.spec\."
```

Expected: ZERO hits. (If a production hit appears — it must not, per the background grep — STOP and migrate it; do not delete a live method.)

- [x] **Step 2: Delete the three methods from `TokenModel.ts`**

Delete `tokenAt` (~lines 225-228):

```ts
	/** Handle of the text token containing `position` (or the next one after). */
	tokenAt(position: number): TokenHandle | undefined {
		return textTargetAt(this.#boundaryContext(), position)?.node.handle
	}
```

Delete `handles()` (~lines 217-223):

```ts
	/**
	 * Iterate all bound tokens' live handles.
	 * @yields each bound token's handle
	 */
	*handles(): IterableIterator<TokenHandle> {
		yield* this.#pipeline.byPath().values()
	}
```

Delete `caretFromPoint` (~lines 441-451):

```ts
	/**
	 * Absolute position at viewport coordinates (read half of old setAtX).
	 * Returns `undefined` when the point hits nothing hittable, or when the
	 * resolved DOM boundary falls outside any bound token.
	 */
	caretFromPoint(x: number, y: number): number | undefined {
		// oxlint-disable-next-line no-unsafe-type-assertion -- non-standard DOM APIs not in TS lib
		const doc = document as unknown as {
			caretRangeFromPoint?(x: number, y: number): globalThis.Range | null
			caretPositionFromPoint?(x: number, y: number): {offsetNode: Node; offset: number} | null
		}
		const pos = doc.caretRangeFromPoint?.(x, y) ?? doc.caretPositionFromPoint?.(x, y)
		if (!pos) return undefined
		if (pos instanceof globalThis.Range) return this.boundaryFor(pos.startContainer, pos.startOffset)
		return this.boundaryFor(pos.offsetNode, pos.offset)
	}
```

(`textTargetAt` is still imported — used by `#placeAtRawPosition`/`selectRange`. `boundaryFor` stays — used by `#rawSelectionFrom`. No import becomes unused.)

- [x] **Step 3: Delete the specs that probe the deleted methods**

In `TokenModel.facade.spec.ts`, delete the `tokenAt finds the containing text surface and the next one after a gap` test (~lines 236-243) and any other `it(...)` whose body's sole subject is `store.tokens.tokenAt(...)` (e.g. the one at ~line 300 — read it; if `tokenAt` is incidental to a placeCaret assertion, migrate the surrounding assertion to `handleAt`/`handle(id)` instead of deleting; if the test is purely `tokenAt`, delete it).

In `model/TokenModel.spec.ts`:
- Delete the `tokenAt finds the containing text surface and the next one after a gap` test (~275-282).
- Delete the `tokenAt agrees with the old TokenModel across the whole position range — inline` test (~346-353).
- Delete the `caretFromPoint agrees with the old TokenModel at the same caret rect — inline` test (~357-369) — already noted in Task 3 Step 9 (if not yet removed, remove it here).
- The `handles()` reads at ~154 (`expect([...model.handles()]).toHaveLength(0)`) and ~237 (`const all = [...model.handles()]`): the ~237 one was rewritten in Phase 4 to `handle(id)` parity — read it; if it still calls `handles()`, it does so to assert the bound-layer count. Migrate the count assertion to iterate via a surviving public read, OR delete the `handles()`-specific assertion lines while keeping the test's other assertions. The ~154 `toHaveLength(0)` (no bound handles before commit) — delete that single assertion line (the `tokenAt(0)` line right after it, ~156, is also a `tokenAt` deletion — remove both, keeping the rest of that `it`).

In `TokenModel.index.spec.ts`, the `handles() yields one handle per bound token …` test (~lines 78-91, rewritten in Phase 4) calls `[...store.tokens.handles()]`. Since `handles()` is deleted, rewrite the test to assert via `handle(id)` + `handleAt` only (drop the `handles()` iteration; keep the `handle(id)` identity assertion):

```ts
	it('handle(id) returns the bound handle for a token id', () => {
		const {store, container, span} = mountInline('hello')

		const id = store.tokens.tokens()[0].id!
		const handle = store.tokens.handle(id)
		expect(handle?.path()).toEqual([0])
		expect(handle?.element()).toBe(span)
		container.remove()
	})
```

(Read the existing test first to match its mount destructure — `mountInline` returns `{store, container, span}` per the file's helper.)

In `TokenHandle.spec.ts`, the `handles() yields one handle per bound token, handle(id) returns the same object` test (~lines 74-86) calls `[...store.tokens.handles()]`. Rewrite to drop `handles()` and assert `handle(id)` identity directly:

```ts
	it('handle(id) returns the bound handle for a token id', () => {
		const {store} = mountInline('hello')

		const id = store.tokens.tokens()[0].id!
		const handle = store.tokens.handle(id)
		expect(handle?.path()).toEqual([0])
	})
```

- [x] **Step 4: Verify zero references anywhere**

Run:

```bash
grep -rn "\.tokenAt(\|\.handles()\|\.caretFromPoint(" packages/core/src --include="*.ts"
```

Expected: ZERO hits (production AND spec). Any remaining hit is a missed spec deletion — fix it.

- [x] **Step 5: Run the affected specs + full core + typecheck**

Run, expecting full pass each:

```bash
pnpm -w exec vitest run --project core TokenModel.facade.spec
pnpm -w exec vitest run --project core "model/TokenModel.spec"
pnpm -w exec vitest run --project core TokenModel.index.spec
pnpm -w exec vitest run --project core TokenHandle.spec
```

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean.

- [x] **Step 6: Commit**

```bash
git commit -m "refactor(tokens): delete dead TokenModel surface — tokenAt, handles(), caretFromPoint" -- packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/TokenModel.facade.spec.ts packages/core/src/features/tokens/model/TokenModel.spec.ts packages/core/src/features/tokens/TokenModel.index.spec.ts packages/core/src/features/tokens/TokenHandle.spec.ts
```

---

### Task 5: Migrate the handle-spec reads off `address()`/`text()`/`dead()`/`caretRect`/`placeCaretAtBoundary`/`changed`

**Files:**
- Modify: `packages/core/src/features/tokens/model/LiveNode.spec.ts`
- Modify: `packages/core/src/features/tokens/model/bind.spec.ts`
- Modify: `packages/core/src/features/tokens/model/commit.spec.ts`
- Modify: `packages/core/src/features/tokens/TokenHandle.spec.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts`

Before the dead handle members + the `dirty`/`changed`/`address`/`text`/`dead` machinery are deleted from `LiveNode.ts` (Task 6), every spec that reads them must migrate to the survivors or be deleted. This task is spec-only — it leaves `LiveNode.ts` untouched, so the suite stays GREEN throughout (the deleted-target getters still exist; the specs simply stop depending on them). Task 6 then deletes the now-orphaned getters.

The survivor map:
- `handle.address()` / `handle.address().path` → `handle.path()` (path-only; the `{path, token}` object form has no survivor — assert `handle.path()` and `handle.token()` separately).
- `handle.text()` → `handle.token().content`.
- `handle.dead()` → `!handle.alive()` (where `alive()` ⇒ live AND bound). **Caveat:** `alive()` is `false` for an UNBOUND-but-not-dead handle too. Where a spec asserts `dead()` to distinguish killed from merely unbound, see Step rules below.
- `handle.caretRect(offset)` test → delete (no survivor; the method is removed).
- `handle.placeCaretAtBoundary(side)` test → delete or fold into `placeCaret(0)`/`placeCaret(Infinity)` (the method is removed; `placeCaret` is the survivor).
- `watch(handle.changed, …)` assertions on `{kind:'text'|'moved'|'unmounted'}` → assert the RESULTING state: after `update`, read `handle.token()`/`handle.path()`; after `kill`, read `!handle.alive()` and that reads still serve the last token.

- [x] **Step 1: `LiveNode.spec.ts` — the `creation`, `update`, `dead contract`, `measurements`, `commands`, and `fine-grained isolation` describes**

Read `LiveNode.spec.ts` in full first. Then:

- **`creation` describe (~65-88):**
  - `exposes id, token, text, derived address and liveness …` (~66-76): drop `expect(handle.text()).toBe('hello')` and `expect(handle.address()).toEqual({path: [0], token})`. Replace with `expect(handle.token().content).toBe('hello')` and `expect(handle.path()).toEqual([0])`. Keep `id`/`token()`/`element()` assertions. `expect(handle.dead()).toBe(false)` → `expect(handle.alive()).toBe(false)` is WRONG here (the handle is unbound → `alive()` is false but it is NOT dead). Instead drop the `dead()` line entirely (liveness of an unbound handle is covered by `element()` being undefined; the `dead contract` describe covers kill).
  - `derives the address on read: the input path is copied …` (~78-87): this test pins `address()` caching + path-copy semantics. `path()` also copies the input path (`[...path]`) and returns a fresh array each call (NOT cached). Rewrite to pin `path()`'s copy semantics and DROP the caching assertion (`address()` was a `Computed`; `path()` is a plain method returning a fresh array — `handle.path()` !== `handle.path()` by reference, but `.toEqual` holds):

    ```ts
    it('copies the input path on read: mutating the caller array does not leak in', () => {
    	const token = textToken('hello', 0)
    	const path = [1]
    	const handle = new TokenHandle(1, token, path)

    	path.push(99)
    	expect(handle.path()).toEqual([1])
    })
    ```

- **`update` describe (~90-170):** these pin `dirty`/`changed`/`address`/`text`. Rewrite each to pin the SURVIVING contract — `update` refreshes `token()`/`path()` in place:
  - `refreshes token and path in place and bumps dirty` (~91-102): drop `dirtyBefore`/`expect(handle.dirty()).toBe(dirtyBefore + 1)`, `expect(handle.text())…`, `expect(handle.address())…`. Keep `expect(handle.token()).toBe(next)`. Add `expect(handle.path()).toEqual([2])`. Rename to `refreshes token and path in place`.
  - `fires text with the previous content when content changes` (~104-113), `text wins over moved …` (~115-124), `fires moved with the previous address …` (~126-141), `is silent on a path-only refresh …` (~143-155), `changed watchers observe the already-updated handle` (~157-170): the `changed` event is deleted. **Delete the four `fires …`/`text wins`/`is silent`/`changed watchers` tests** (they assert event payloads that no longer exist). The surviving fact — `update` refreshes state — is covered by the rewritten `refreshes token and path in place` test above. (If you want to retain the path-only-refresh coverage, fold it: `handle.update(token, [3]); expect(handle.path()).toEqual([3]); expect(handle.token()).toBe(token)` in a single small test. Optional — the refresh test already covers a path change.)

- **`commands` describe (~318-403):**
  - `no-ops false when no elements are bound` (~319-326): drop `expect(handle.placeCaretAtBoundary('start')).toBe(false)`. Keep the other three (`placeCaret`, `placeCaretAtX`, `focus`).
  - `collapses to child boundaries on tokens without a text surface` (~346-370): the tail (~366-369) asserts `placeCaretAtBoundary('start'/'end')`. `placeCaretAtBoundary` is deleted — DELETE those two assertion lines (the `placeCaret(0)`/`placeCaret(1)` child-boundary assertions above them, ~356-364, cover the child-boundary behavior; keep them).
  - `placeCaretAtBoundary targets start and end of the text surface` (~372-381): the whole test is `placeCaretAtBoundary` — DELETE it (the `placeCaret`/`caretIndex` clamping test at ~328-344 covers start/end placement on a text surface).

- **`measurements` describe (~259-316):**
  - `measures the bound text surface` (~260-285): drop the `caretRect` block (`const start = handle.caretRect(0)` … `expect(handle.caretRect(99)).toBeUndefined()`, ~273-279). Keep `hasTextSurface`/`textLength`/`placeCaret`/`caretIndex`/`caretOnFirstLine`/`caretOnLastLine`/`rect`.
  - `returns inert defaults when nothing is bound` (~305-315): drop `expect(handle.caretRect(0)).toBeUndefined()` (~311). Keep the rest.

- **`dead contract` describe (~405-449):** this is the kill/`dead()`/`changed unmounted`/`dirty` test. Rewrite to the survivor contract — `kill` makes the handle not-alive, reads stay safe, commands no-op, never resurrects:

  ```ts
  describe('dead contract', () => {
  	it('kill freezes reads, disables commands and never resurrects', () => {
  		const {span} = mountSurface('hello')
  		const token = textToken('hello', 0)
  		const handle = new TokenHandle(5, token, [0])
  		handle.bindElements({tokenElement: span, textElement: span})
  		expect(handle.alive()).toBe(true)

  		handle.kill()

  		expect(handle.alive()).toBe(false)
  		expect(handle.element()).toBeUndefined()
  		expect(handle.node()).toBeUndefined()
  		// Stale reads stay safe and serve the last state.
  		expect(handle.token()).toBe(token)
  		expect(handle.path()).toEqual([0])

  		// Idempotent: a second kill is silent (no throw, still dead).
  		handle.kill()
  		expect(handle.alive()).toBe(false)

  		// Commands no-op false, measurements collapse to their unbound defaults.
  		expect(handle.placeCaret(0)).toBe(false)
  		expect(handle.placeCaretAtX(0)).toBe(false)
  		expect(handle.focus()).toBe(false)
  		expect(handle.textLength()).toBe(0)
  		expect(handle.caretIndex()).toBeUndefined()
  		expect(handle.hasTextSurface()).toBe(false)

  		// Never resurrected: update/bindElements are inert on a dead handle.
  		handle.update(textToken('zombie', 0), [4])
  		handle.bindElements({tokenElement: span, textElement: span})
  		expect(handle.alive()).toBe(false)
  		expect(handle.token()).toBe(token)
  		expect(handle.element()).toBeUndefined()
  	})
  })
  ```

  (Dropped: the `onChange`/`watch(handle.changed)` setup + the `toHaveBeenCalledWith({kind:'unmounted'})` + `handle.dead()` + `handle.dirty()` + `placeCaretAtBoundary` assertions. The survivor proof of "never resurrected" is `token()` unchanged + `alive()` still false after a post-kill `update`/`bindElements`.)

- **`fine-grained isolation` describe (~173-227):** this is THE isolation spec the design names for deletion ("per-node dirty signals + reactive getters + isolation specs"). It asserts A's `update` does not re-evaluate B's computeds and keeps B's `changed` silent — meaningless once the getters are plain (no computeds, no `dirty`, no `changed`). **DELETE the entire `describe('fine-grained isolation', …)` block.**

- After these edits, the spec no longer imports `computed`/`effect`/`watch`/`vi` if those were used only by the deleted tests. Check:

  ```bash
  grep -n "computed\|effect\|watch\|vi\." packages/core/src/features/tokens/model/LiveNode.spec.ts
  ```

  Drop any now-unused import from line 1/3 (`import {afterEach, describe, expect, it, vi} from 'vitest'`; `import {computed, effect, watch} from '../../../shared/signals/index.js'`). If `watch`/`computed`/`effect`/`vi` have zero remaining uses, remove them; keep what survives.

- [x] **Step 2: Run `LiveNode.spec` (must stay green — `LiveNode.ts` is untouched)**

Run: `pnpm -w exec vitest run --project core LiveNode.spec`
Expected: full pass. (The deleted-target getters still EXIST in `LiveNode.ts`; this step only proves the rewritten specs pass against the current implementation before Task 6 removes the getters.)

- [x] **Step 3: `TokenHandle.spec.ts` — `text()`/`dead()`/`changed`**

Read `TokenHandle.spec.ts`. For each:
- `handle.text()` reads (~60, 101, 160, 180) → `handle.token().content`.
- `handle.dead()` reads (~62, 130, 178): a `dead()` that distinguishes killed-from-unbound has no exact survivor. Read each assertion's intent:
  - `expect(handle.dead()).toBe(false)` where the handle IS bound → `expect(handle.alive()).toBe(true)`.
  - `expect(handle.dead()).toBe(true)` after a kill (the token disappeared) → `expect(handle.alive()).toBe(false)`.
  - `expect(handle.dead()).toBe(false)` where the handle survived a structural shift and is STILL bound → `expect(handle.alive()).toBe(true)`.
- `watch(handle.changed, onChange)` blocks (~94, 115, 163): these assert `text`/`moved`/`unmounted` payloads. Rewrite to assert resulting state: after the edit, `expect(handle.token().content)` / `expect(handle.path())` for text/moved; after the disappearance, `expect(handle.alive()).toBe(false)`. If a test's SOLE purpose is the event payload (no other assertion), delete it.

(Read each `it` and apply the survivor map. The `handles()`-rewritten test was already handled in Task 4 Step 3.)

- [x] **Step 4: `bind.spec.ts` — `address()`/`text()`/`dead()`/`changed`**

Read the relevant blocks (`address()` at ~77, 402, 484; `text()` at ~520, 730; `dead()` at ~431, 436, 476, 477, 517, 541; `changed` at ~353, 387, 426, 462-463, 729). Apply the survivor map:
- `handle.address()` (the `{path, token}` object, ~77) → assert `handle.path()` and `handle.token()` separately: `expect(handle?.path()).toEqual([0])` + `expect(handle?.token()).toBe(tokens[0])`.
- `handle.address().path` (~402, 484) → `handle.path()`.
- `handle.text()` (~520, 730) → `handle.token().content`.
- `handle.dead()` (~431, 436, 476, 477, 517, 541) → `handle.alive()` with the boolean inverted, applying the killed-vs-bound rule (a `dead()===true` after a kill → `alive()===false`; a `dead()===false` on a still-bound handle → `alive()===true`).
- `watch(handle.changed, …)` (~353, 387, 426, 462-463, 729): rewrite to assert resulting `token()`/`path()`/`alive()` state, or delete if the test is purely an event-payload assertion. The ~729 `observedText = handleB.text()` inside a `changed` watcher (a "watcher sees updated state" test) — if the event is gone, the test's premise is gone; delete it (the in-place refresh is covered by `LiveNode.spec`'s rewritten `refreshes token and path in place`).

- [x] **Step 5: `commit.spec.ts` — `address()`/`text()`/`dead()`/`changed` + `TokenChange` import**

Read the blocks. `commit.spec.ts` imports `type {TokenChange}` (line 8) and builds `markChanges`/`childChanges`/`tailChanges: TokenChange[]` arrays via `watch(handle.changed, …)`. Apply:
- `handle.address()` (~136, 154, 158, 201) → `handle.path()` (path) / split into `path()`+`token()` for the object form (~136: `expect(tail.address()).toEqual({path:[2], token: result.tokens[2]})` → `expect(tail.path()).toEqual([2])` + `expect(tail.token()).toBe(result.tokens[2])`).
- `handle.text()` (~135, 154, 158, 311, 386, 393, 476, 505, 688) → `handle.token().content`.
- `handle.dead()` (~301, 307, 308, 494) → `handle.alive()` inverted (killed → `alive()===false`; the divergence/escalation tests assert a mark is killed after a structural commit — `alive()===false`).
- The per-handle `changed` arrays (~187-200, 422-452, 654-686) assert routing via the EVENT (`markChanges`/`childChanges`/`tailChanges` equal `[{kind:'text',…}]` etc.). The event is deleted. Rewrite to assert the SAME routing fact via final state: a text-path commit leaves the handle alive with the new content (`expect(handle.alive()).toBe(true)` + `expect(handle.token().content).toBe(<new>)`); a structural commit kills the old handle (`expect(handle.alive()).toBe(false)`). Read each test's assertion and replace the event-array expectation with the equivalent state assertion. Delete the `markChanges`/etc. array declarations and their `watch(handle.changed, …)` setup.
- After removing the per-handle `changed` watchers, the `import type {TokenChange, TokenHandle}` (line 8) loses `TokenChange`. Change it to `import type {TokenHandle} from './LiveNode'`. KEEP `pipeline.changed` watchers untouched (the MODEL event — `watch(pipeline.changed, changedSpy)` at ~77, 120, 190, 214, 256, 293, 321, 373, 402, 425, 467, 497, 521, 544, 552, 662 — those subscribe to the pipeline's `Event<void>`, NOT a handle's `changed`; do NOT touch them).

(Distinguish carefully: `watch(pipeline.changed, …)` STAYS; `watch(<handle>.changed, …)` / `watch(markHandle.changed, …)` / `watch(he.changed, …)` / `watch(tail.changed, …)` GO.)

- [x] **Step 6: `TokenModel.index.spec.ts` — `handle.changed`/`address()`**

Read line 22 (`expect(typeof store.tokens.changed).toBe('function')`) and line 35 (`watch(store.tokens.changed, onChanged)`): these subscribe to the MODEL `changed` (`store.tokens.changed`, the `Event<void>`), NOT a handle — LEAVE them. Line 93 (`expect(all[0].address().path).toEqual([0])`) was part of the `handles()` test rewritten in Task 4 — if it survived, change it to `handle?.path()`. Grep to confirm no `<handle>.address()` / `<handle>.changed` (non-`store.tokens.changed`) remains:

```bash
grep -n "\.address()\|\.changed" packages/core/src/features/tokens/TokenModel.index.spec.ts
```

Expected: only `store.tokens.changed` (the model event) — fix any `<handle>.address()` to `<handle>.path()`.

- [x] **Step 7: Verify zero spec reads of the doomed handle members remain**

Run:

```bash
grep -rn "\.address()\|\.text()\|\.dead()\|\.caretRect(\|\.placeCaretAtBoundary(" packages/core/src/features/tokens --include="*.spec.ts"
```

Expected: ZERO hits. (Any survivor is a missed migration — fix it. Note: `.text()` on a CLIPBOARD `content` object — e.g. `content.text` — is a property access, not `.text()` the method call; the grep pattern `\.text()` matches the call form only.)

Run:

```bash
grep -rn "watch([a-zA-Z]*[Hh]andle\.changed\|watch(he\.changed\|watch(tail\.changed\|watch(a\.changed\|watch(b\.changed\|watch(child\.changed" packages/core/src/features/tokens --include="*.spec.ts"
```

Expected: ZERO hits (every per-handle `changed` watcher migrated/deleted; only `store.tokens.changed`/`pipeline.changed` remain).

- [x] **Step 8: Run the affected specs + full core**

Run, expecting full pass each (against the STILL-PRESENT getters — Task 6 deletes them next):

```bash
pnpm -w exec vitest run --project core LiveNode.spec
pnpm -w exec vitest run --project core TokenHandle.spec
pnpm -w exec vitest run --project core "model/bind.spec"
pnpm -w exec vitest run --project core "model/commit.spec"
pnpm -w exec vitest run --project core TokenModel.index.spec
```

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean — `commit.spec.ts` no longer imports `TokenChange`.

- [x] **Step 9: Commit**

```bash
git commit -m "test(tokens): migrate handle specs off address()/text()/dead()/changed; delete isolation spec" -- packages/core/src/features/tokens/model/LiveNode.spec.ts packages/core/src/features/tokens/TokenHandle.spec.ts packages/core/src/features/tokens/model/bind.spec.ts packages/core/src/features/tokens/model/commit.spec.ts packages/core/src/features/tokens/TokenModel.index.spec.ts
```

---

### Task 6: De-reactify `TokenHandle` — plain getters; delete `dirty`/`changed`/`address`/`text`/`dead`/`caretRect`/`placeCaretAtBoundary`

**Files:**
- Modify: `packages/core/src/features/tokens/model/LiveNode.ts`
- Modify: `packages/core/src/features/tokens/index.ts` (drop the `TokenChange` export)

The heart of the win-4 trade. `token`/`element` become PLAIN getters reading the backing fields (no `dirty` dependency). The per-node `dirty` signal, the `changed` event, the `TokenChange`/`TokenSnapshot` types, and the now-dead `address`/`text`/`dead`/`caretRect`/`placeCaretAtBoundary` members are deleted. `path()`/`alive()` (Phase 4) drop their `dirty()`/`#dead()`-signal reads and read the plain fields. `update`/`bindElements`/`unbind`/`kill` keep mutating the fields but drop the `batch`/`#bumpDirty`/event emits. Every spec was migrated in Task 5, so the suite stays green.

- [x] **Step 1: Capture the baseline**

Run: `pnpm -w exec vitest run --project core LiveNode.spec`
Run: `pnpm -w exec vitest run --project core "model/bind.spec"`
Run: `pnpm -w exec vitest run --project core "model/commit.spec"`
Expected: full pass (Task 5 left these green against the still-reactive implementation).

- [x] **Step 2: Rewrite `LiveNode.ts`**

Replace the ENTIRE contents of `packages/core/src/features/tokens/model/LiveNode.ts` with the de-reactified version below. Every member keeps its signature; only the reactive plumbing is removed. `#dead` becomes a plain boolean field; `token`/`element` become plain methods; `address`/`text`/`dead`/`caretRect`/`placeCaretAtBoundary`/`changed`/`dirty` are gone; `update`/`kill`/`bind`/`unbind` mutate plainly.

```ts
import type {TokenPath} from '../../../shared/editorContracts'
import {
	focusIfNeeded,
	getCaretIndex,
	isOnFirstLine,
	isOnLastLine,
	placeAtChildBoundary,
	placeAtTextOffset,
	setAtX,
} from '../caret'
import type {Token} from '../parser/types'
import {textLength} from '../textOffsets'

/** DOM bindings of a live node — set by bind, cleared on unbind/kill. */
export type ElementBindings = {
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}

/**
 * The live record of one token — the single source of truth for everything
 * currently true about it: the CURRENT parsed token, its tree position, and
 * its DOM bindings. The class doubles as the public handle face: plain getters
 * (`token()`/`path()`/`element()`/`alive()`) and caret commands read this
 * node's own fields. No per-node reactivity — the spec's win-4 trade: zero
 * production consumers subscribed to a handle's getters, so signals are pure
 * overhead here (reversible: the getters stay methods, so per-node signals can
 * return behind them additively).
 *
 * Lifetime: created when its token enters the tree (keyed by the token's
 * stable identity id), mutated in place by `update`/`bindElements`/`unbind`,
 * killed when the token disappears (stale reads stay safe, commands become
 * no-ops, never resurrected).
 */
export class TokenHandle {
	#dead = false

	#token: Token
	#path: TokenPath
	#tokenElement: HTMLElement | undefined
	#textElement: HTMLElement | undefined
	#rowElement: HTMLElement | undefined
	#childSequenceHost: HTMLElement | undefined

	constructor(
		readonly id: number,
		token: Token,
		path: TokenPath
	) {
		this.#token = token
		this.#path = [...path]
	}

	/** The handle's current token. A plain read of the backing field. */
	token(): Token {
		return this.#token
	}

	/** The handle's current tree position (a fresh copy each read). */
	path(): TokenPath {
		return [...this.#path]
	}

	/** Live AND bound: not killed and currently holding a DOM element. The whole validity check a holder of this handle needs. */
	alive(): boolean {
		return !this.#dead && this.#tokenElement != null
	}

	/** The handle's current token root element, or undefined while unbound/dead. */
	element(): HTMLElement | undefined {
		return this.#tokenElement
	}

	/** @internal Current DOM bindings; undefined while unbound or dead. */
	node(): ElementBindings | undefined {
		const tokenElement = this.#tokenElement
		if (!tokenElement) return undefined
		return {
			tokenElement,
			textElement: this.#textElement,
			rowElement: this.#rowElement,
			childSequenceHost: this.#childSequenceHost,
		}
	}

	/** Row in block layout, else the text surface / token root. */
	#measureScope(): HTMLElement | undefined {
		return this.#rowElement ?? this.#textElement ?? this.#tokenElement
	}

	hasTextSurface(): boolean {
		return this.#textElement != null
	}

	textLength(): number {
		const scope = this.#measureScope()
		return scope ? textLength(scope) : 0
	}

	/**
	 * Caret offset within this token's scope, or undefined when unmounted.
	 * Only meaningful while the selection is inside this token's scope — the
	 * underlying helper returns 0 when there is no selection.
	 */
	caretIndex(): number | undefined {
		const scope = this.#measureScope()
		return scope ? getCaretIndex(scope) : undefined
	}

	caretOnFirstLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnFirstLine(scope) : true
	}

	caretOnLastLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnLastLine(scope) : true
	}

	rect(): DOMRect | undefined {
		return this.#measureScope()?.getBoundingClientRect()
	}

	/**
	 * Place a collapsed caret at a character offset (Infinity → end).
	 * On tokens without a text surface any offset > 0 collapses to the 'end'
	 * child boundary.
	 */
	placeCaret(offset: number): boolean {
		const tokenElement = this.#tokenElement
		if (!tokenElement) return false
		const textElement = this.#textElement
		if (!textElement) {
			focusIfNeeded(tokenElement)
			placeAtChildBoundary(tokenElement, offset <= 0 ? 'start' : 'end')
			return true
		}
		focusIfNeeded(textElement)
		const length = textLength(textElement)
		placeAtTextOffset(textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
		return true
	}

	/** Place caret at viewport x (and optional y) within this token's scope. */
	placeCaretAtX(x: number, y?: number): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		setAtX(scope, x, y)
		return true
	}

	/** Focus this token's scope element (row in block layout). */
	focus(): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		focusIfNeeded(scope)
		return true
	}

	/** @internal Refresh token/path after a reconcile. Inert on a dead handle. */
	update(token: Token, path: TokenPath): void {
		if (this.#dead) return
		this.#token = token
		this.#path = [...path]
	}

	/** @internal Set/replace the DOM bindings (structural bind). */
	bindElements(bindings: ElementBindings): void {
		if (this.#dead) return
		this.#tokenElement = bindings.tokenElement
		this.#textElement = bindings.textElement
		this.#rowElement = bindings.rowElement
		this.#childSequenceHost = bindings.childSequenceHost
	}

	/** @internal Clear the DOM bindings (token unmounted from the DOM). */
	unbind(): void {
		if (this.#dead) return
		this.#clearElements()
	}

	/** @internal Drops DOM, marks dead. A dead handle pins nothing; no unlink needed. */
	kill(): void {
		if (this.#dead) return
		this.#clearElements()
		this.#dead = true
	}

	#clearElements(): void {
		this.#tokenElement = undefined
		this.#textElement = undefined
		this.#rowElement = undefined
		this.#childSequenceHost = undefined
	}
}
```

(Dropped: the `signals` import (`batch`/`computed`/`event`/`signal` + `Computed`/`Event`/`Signal` types), the `TokenSnapshot` type, the `TokenChange` type, the `changed` event, the `dirty` signal, the `#dead` SIGNAL (now a plain boolean), and the `address`/`text`/`dead`/`caretRect`/`placeCaretAtBoundary` members. `caretRect` removed because no caller survives. `placeCaretAtBoundary` removed because `placeCaret` is the survivor. KEPT: `id`, `token()`, `path()`, `alive()`, `element()`, `node()`, all caret/measure commands, `update`/`bindElements`/`unbind`/`kill`. `update` no longer emits, no longer batches.)

- [x] **Step 3: Drop the `TokenChange` export from `tokens/index.ts`**

In `packages/core/src/features/tokens/index.ts`, delete the line:

```ts
export type {TokenChange} from './model/LiveNode'
```

(`TokenChange` is gone from `LiveNode.ts`. `TokenHandle` (the value) export stays. `TokenChangeEntry` from `tokenIdentity` is unrelated — leave it.)

- [x] **Step 4: Run the handle/model specs**

Run, expecting full pass each:

```bash
pnpm -w exec vitest run --project core LiveNode.spec
pnpm -w exec vitest run --project core TokenHandle.spec
pnpm -w exec vitest run --project core "model/bind.spec"
pnpm -w exec vitest run --project core "model/commit.spec"
```

- [x] **Step 5: Full core suite + typecheck + encapsulation**

Run: `pnpm -F core test`
Expected: full pass — `TokenModel.#view`/`placeCaret`/`setEditable` call `handle.token()` (now plain), `commit.ts` divergence calls `handle.token().content` + `handle.path()` (Task 1), bind/commit call `update`/`bindElements`/`unbind`/`kill` (now plain). No behavior change for any production read.

Run: `pnpm run typecheck`
Expected: clean — `LiveNode.ts` exports only `TokenHandle` + `ElementBindings`; nothing imports `TokenChange`/`TokenSnapshot`. Verify no `.token`/`.element` reactive-property access broke (they were `Computed` props read as `handle.token()`/`handle.element()` — method calls — and stay method calls).

Run: `pnpm run check:encapsulation`
Expected: pass.

- [x] **Step 6: Verify the reactive plumbing is gone**

Run:

```bash
grep -n "dirty\|changed\|computed\|signal\|event\|batch\|TokenChange\|TokenSnapshot\|address\|caretRect\|placeCaretAtBoundary\|\.dead\b" packages/core/src/features/tokens/model/LiveNode.ts
```

Expected: ZERO hits — no `dirty`, no `changed`, no signals import, no `TokenChange`/`TokenSnapshot`, no `address`/`caretRect`/`placeCaretAtBoundary`, no public `dead`. (`#dead` the private boolean field is fine — the grep `\.dead\b` matches the public getter form; `#dead` won't match `\.dead`. If it does flag `#dead`, that is the private field — expected, leave it.)

- [x] **Step 7: Commit**

```bash
git commit -m "refactor(tokens): de-reactify TokenHandle — plain getters; delete dirty/changed/address/text/dead" -- packages/core/src/features/tokens/model/LiveNode.ts packages/core/src/features/tokens/index.ts
```

---

### Task 7: Full verification

- [x] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # full core suite — plain handle getters; one selection() snapshot; dead surface gone
pnpm -F storybook test       # react + vue page specs (adapters read overlay.element() + MarkInfo id/path — both unchanged by Phase 5)
pnpm run typecheck           # recursive tsc/vue-tsc — zero TokenChange/TokenSnapshot; six micro-reads gone; selection() exported
pnpm run check:encapsulation
```

- [x] **Step 2: Confirm the deletions and the new surface**

Run: `grep -rn "\.tokenAt(\|\.handles()\|\.caretFromPoint(\|\.caretRect(\|\.placeCaretAtBoundary(\|readSelection\|selectionRect\|selectionAnchor\|isSelectionCollapsed\|selectionIntersects\|selectionFocusNode" packages/core/src packages/react/markput/src packages/vue/markput/src --include="*.ts" --include="*.tsx" --include="*.vue"`
Expected: ZERO hits — the dead model surface and the six micro-reads are gone from production AND specs.

Run: `grep -rn "\.address()\|TokenChange\b\|TokenSnapshot\|handle\.changed\|\.dirty\b\|handle\.dead\|\.dead()" packages/core/src --include="*.ts"`
Expected: ZERO hits (excluding `store.tokens.changed`/`pipeline.changed`, the MODEL event, and the private `#dead` field) — the per-node reactive plumbing and `address()` are gone.

Run: `grep -n "selection\b\|SelectionSnapshot" packages/core/src/features/tokens/model/TokenModel.ts`
Expected: the new `selection()` method + the `SelectionSnapshot` type are present.

Run: `grep -n "token()\|path()\|alive()\|element()\|dirty\|computed\|signal\|event" packages/core/src/features/tokens/model/LiveNode.ts`
Expected: `token()`/`path()`/`alive()`/`element()` present as plain methods; ZERO `dirty`/`computed`/`signal`/`event`.

- [x] **Step 3: Confirm clean and report**

`git status` must be clean (everything committed task-by-task, path-scoped). Report: the core suite pass count, the storybook react/vue counts, and confirm typecheck + encapsulation guard green. State explicitly that the handle getters are now PLAIN (win-4 traded; the per-node `dirty` signal + `changed` event + `TokenChange`/`TokenSnapshot` deleted), the dead surface (`tokenAt`, `handles()`, `caretFromPoint`, `caretRect`, `placeCaretAtBoundary`, `address()`, `text()`, `dead()`) is gone, the fine-grained isolation spec is deleted, and the six selection micro-reads + the `!== false` tri-state are replaced by one `selection(): SelectionSnapshot | undefined`. Note that this phase broke no consumed public API (the deleted members had zero production callers; `selection()` is additive over `readRaw`'s migration).

---

### Task 8: Write the Phase 6 plan (phase chaining)

- [x] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase6.md` for **Phase 6 — pipeline + parse trim (2 days)** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`, Phase 6): the `(value, parser, isBlock)` watch replaces the PURITY computed (the `#reconciled` computed in `TokenModel.ts` that consume-once-reads `takePendingEdit` and mutates `#lastParsed` inside a getter — replace it with an explicit hint flow through a watch-callback pipeline entry, removing the dependence on the runtime's once-per-wave PURITY guarantee); explicit hint flow; delete `incrementalParse` + its property spec (`incrementalParse.ts` + `incrementalParse.property.spec.ts` — but KEEP `EditHint` and the bench as the regression tripwire); delete dead `preparsing/getClosestIndexes` (the Phase-6 rider). Ground the plan by reading FIRST, with fresh eyes, the POST-Phase-5 code: `packages/core/src/features/tokens/model/TokenModel.ts` (`#reconciled`/`#lastParsed`/`#parse`/`#parser` and the mount `watch` over `#reconciled`, plus the PURITY comment block), `packages/core/src/features/tokens/incrementalParse.ts` + `incrementalParse.property.spec.ts`, `packages/core/src/features/tokens/tokenIdentity.ts` (the `EditHint`/`takePendingEdit` seam), and the `preparsing/getClosestIndexes` dead code. Decide the EXACT watch-callback pipeline-entry shape and how the explicit hint threads from `ValueModel.takePendingEdit` through the new entry (no consume-once-inside-a-computed). No placeholder steps — every step shows exact code; bite-sized TDD; frequent path-scoped commits; the required plan header. The LAST task of the Phase 6 plan must be "write the Phase 7 plan" (phase chaining — Phase 7 is first-class rows, the final phase; its plan's last task is the migration completion / README shrink rider, not a Phase 8). Verification commands MUST follow this plan's Tech Stack note: `pnpm -F core test`, `pnpm -F storybook test` / `test:react` / `test:vue`, `pnpm run typecheck`, `pnpm run check:encapsulation` — NEVER `pnpm -F react test` or `pnpm -F vue test` (silent no-ops).

- [x] **Step 2: Commit the plan**

```bash
git commit -m "docs(plan): one-fresh-truth phase 6 — pipeline + parse trim" -- docs/superpowers/plans/2026-06-13-one-fresh-truth-phase6.md
```
