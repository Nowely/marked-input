# One Fresh Truth — Phase 3: One Fresh Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the always-fresh reconciled tree THE consumer read and remove the public staleness contract. Expose `tokens()` (and `at(index)`) on `TokenModel` — the latest reconciled tree the commit pipeline already keeps in its private `latest` reference, set on BOTH branches at the top of `apply`. Migrate the 6 `freshTokens()` production call sites and the ~7 core `tree()` consumer reads to `tokens()`, then DELETE `utils/freshTokens.ts` and its staleness comments. Rename the renderer-only `tree` Computed to `renderTree` and move it off the consumer surface into a separate `@markput/core/adapter` subpath import — `renderTree` is the renderer contract (reference change ⇔ the renderer must run), never consumer data. The boundary facade stops reading `#reconciled().tokens` and reads the same `latest` the pipeline keeps, so there is exactly one fresh tree.

**Architecture:** Today there are TWO trees consumers can reach and a documented rule for choosing between them:

- `tree()` (the `#pipeline.tree` signal, written ONLY by the structural branch) keeps its reference — and therefore stale content/positions — across text-path commits. Adapters subscribe to it for reference-stability render gating; that is its ONLY legitimate job. But consumers also read it as a data source (`SelectionController.focusFirst`, `MarkController.#addressInTree`/`#resolveCaptured`, `blockEdit.rowHandle`/`rowCount`, `arrowNav` sibling lookup) — they get a stale tree and must hand-bridge each token to a live handle.
- `freshTokens(store.tokens)` (`utils/freshTokens.ts`) papers over that: it maps `tree()` rows through `handleOf(token)?.token()` to swap each stale top-level token for its handle's CURRENT token. Its 18-line doc comment enumerates the exact windows where the bridge fails closed and falls back to a stale object. It has 6 production call sites — more than `tree()` has legitimate fresh reads, exactly the "the escape hatch outgrew the front door" defect the spec names.

The pipeline ALREADY keeps the one fresh truth: `let latest: Token[]` (commit.ts), assigned `latest = tokens` as the first statement of `apply` on the text branch AND the structural branch — so after any commit `latest` is the reconciled tree consistent with `value.current()`. The boundary facade independently reaches the same tree via `#reconciled().tokens` (re-running the memoized reconcile computed). Phase 3 makes `latest` the single public read:

- Add `tokens(): readonly Token[]` to the pipeline returning `latest`, mirrored onto `TokenModel` as `tokens()`; add `at(index): Token | undefined` as `tokens()[index]`.
- Repoint the boundary facade's two `#reconciled().tokens` reads (`#resolveAddress`, `#boundaryContext`) at `this.tokens()` — the same `latest`, satisfying the matrix's "boundary/position reads serve the latest reconciled tree."
- Migrate every `freshTokens(this.tokens)` / `freshTokens(store.tokens)` call to `this.tokens.tokens()` / `store.tokens.tokens()` — the fresh map is now identity (the tree IS fresh), so the bridge is gone. Migrate the `tree()` consumer reads (`focusFirst`, `rowHandle`, `rowCount` ×2, `arrowNav` sibling, `MarkController` ×2) to `tokens()`.
- DELETE `utils/freshTokens.ts`, drop its `export {freshTokens}` from `tokens/index.ts`, and delete the README staleness-contract section.
- Rename the model's `tree` Computed to `renderTree` (the `CommitPipeline.tree` field too) and re-home it: the consumer-facing `@markput/core` index stops exposing it as a consumer read; a NEW `@markput/core/adapter` subpath export surfaces the adapter SPI (`renderTree` is reached through `s.tokens.renderTree`; `keyOf`, `control`/`children`, `host.rendered()` are already adapter-only). The react/vue `Container` selectors switch `s.tokens.tree` → `s.tokens.renderTree`.

After Phase 3 the mental model is the acceptance sentence: **handles are fresh; `renderTree` is for renderers** — and `tokens()` is the always-fresh consumer read consistent with `value.current()`.

**Pending-window read matrix (the spec's governing rule — pin it, do not redesign it):**

| Read | Mid-window (structural apply awaiting bind) serves |
|---|---|
| `tokens()` / `at(i)` | the latest reconciled tree — always fresh, consistent with `value.current()` (it IS `latest`, reassigned at the top of every `apply`) |
| `handle(id)` / `handleAt(node)` / `handleOf(token)` | `undefined` (fail-closed — UNCHANGED this phase) |
| boundary/position reads (facade) | the latest reconciled tree (`tokens()` — preserves mid-window consistency with `value.current()`) |

`tokens()` is NEVER latch-gated: `latest` is reassigned before any branch decision, so it is the fresh tree in the pending window too. Only handle lookups fail closed. This is the whole behavioral contract of the phase.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full core suite). To run ONE spec: `pnpm -w exec vitest run --project core <path-or-pattern>`. Storybook page specs (the react/vue vitest projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck` (recursive `tsc --noEmit` / `vue-tsc --noEmit` across all packages — this is what catches the adapter `s.tokens.tree` → `s.tokens.renderTree` rename and the dropped `freshTokens` export). Encapsulation guard: `pnpm run check:encapsulation`. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of `.ts`/`.tsx` files**.

**Commits in a shared checkout:** other agents work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 3; §Public API → `tokens()`/`at()`; §Pending-window read matrix; "What dies" → "The public staleness contract" + "`utils/freshTokens.ts` + 6 call sites + 18 staleness comments"; "Adapter SPI moves to a separate import (`markput/adapter`)").

**Background facts (probe-verified against post-Phase-2 HEAD, do not re-derive):**

- **The pipeline's `latest` IS the fresh tree.** `commit.ts` declares `let latest: Token[] = []` and `apply` runs `latest = tokens` as its FIRST statement (before the text/structural branch decision), on every reconcile result. So `latest` is always the most recent reconciled tree, consistent with `value.current()`, fresh in the pending window too. The comment above it ("The latest RECONCILED tree — what bind projects onto the node layer. Deliberately not tree() …") already documents exactly this property. `bindAndAnnounce` binds `tokens: latest`. There is no existing accessor exposing it — Task 1 adds one.
- **`tree` is the renderer signal, written ONLY structurally.** `const tree = signal<Token[]>({initial: []})`; written only inside `commitStructural` via `tree(tokens)`. `CommitPipeline.tree: Computed<Token[]>`; `TokenModel.tree: Computed<Token[]> = this.#pipeline.tree`. Its reference-stability is the render gate the storybook `renderCount.*` specs and `TokenModel.changed.spec.ts`'s `render-count gates` describe assert (`watch(store.tokens.tree, treeSpy)` — that watch must keep watching the renderer signal, renamed `renderTree`). This signal does NOT change behavior this phase — only its NAME (`tree` → `renderTree`) and its EXPOSURE (adapter-only).
- **The 6 `freshTokens(` production call sites (grep-verified, COMPLETE):**
  - `features/selection/SelectionController.ts:143` — `#focusEmptyEditorOnClick`: `const tokens = freshTokens(this.tokens)` then checks the single-empty-text-token shape.
  - `features/keyboard/input.ts:101` — `rangeForDelete`: `adjacentMarkRange(freshTokens(store.tokens), range.start, …)`.
  - `features/keyboard/blockEdit.ts:76` — `handleDelete`: `const rows = freshTokens(store.tokens)`.
  - `features/keyboard/blockEdit.ts:137` — `handleEnter`: `const rows = freshTokens(store.tokens)`.
  - `features/block/BlockController.ts:34` — the drag-action watch: `applyDragAction(value, freshTokens(this.tokens), action, …)`.
  - `features/clipboard/ClipboardController.ts:44` — `#handleCopy`: `serializeRange(freshTokens(this.tokens), raw.range)`.
  Each becomes `…tokens.tokens()`. Each carries a staleness comment justifying the `freshTokens`-over-`tree()` choice — those comments are now wrong (there is one tree, always fresh) and are deleted/replaced with a one-line "fresh read of the reconciled tree" note where the surrounding code still benefits from a comment.
- **The ~7 core `tree()` consumer reads (grep-verified, COMPLETE; excluding `freshTokens.ts` itself):**
  - `features/selection/SelectionController.ts:67` — `focusFirst`: `const first = this.tokens.tree().at(0)`.
  - `features/tokens/MarkController.ts:30` — `#addressInTree` via `pathOf(store.tokens.tree(), token)`.
  - `features/tokens/MarkController.ts:101` — `#resolveCaptured`: `resolvePath(this.store.tokens.tree(), this.address.path)`.
  - `features/keyboard/blockEdit.ts:28` — `rowHandle`: `store.tokens.tree().at(rowIndex)`.
  - `features/keyboard/blockEdit.ts:173` — `handleBlockArrowLeftRight`: `store.tokens.tree().length`.
  - `features/keyboard/blockEdit.ts:199` — `handleArrowUpDown`: `store.tokens.tree().length`.
  - `features/keyboard/arrowNav.ts:53` — `shiftFocus`: `resolvePath(store.tokens.tree(), siblingPath)`.
  Each becomes `…tokens.tokens()`. (MarkController's two reads keep their object-identity / path-resolution semantics unchanged — `tokens()` is the same shape as `tree()`, now fresh; MarkController's full TokenAddress rework is Phase 4, NOT this phase. This phase only swaps the data source.)
- **`tokens()` vs `tree()` for these consumers is behavior-preserving-or-better.** The `tree()` reads that take `.length`/`.at(index)` (blockEdit `rowCount`, `rowHandle`) are documented "row COUNT is structural, so the render tree is never stale here" — true, but `tokens()` is also never stale, so the swap cannot regress and removes the asymmetry. The `resolvePath`/`pathOf` reads (`arrowNav`, MarkController) pass the resulting token to `placeAtAddress`/identity checks that already bridge by id — feeding them the fresh token is strictly more correct. The `freshTokens` sites slice `value.current()` by token positions and REQUIRED freshness — `tokens()` delivers it directly.
- **`freshTokens` is exported from `tokens/index.ts:10`** (`export {freshTokens} from './utils/freshTokens'`). After Phase 3 that export line is deleted. No code outside the 6 call sites imports it (grep-verified: the only `freshTokens` references are `utils/freshTokens.ts`, `tokens/index.ts`, the README, the 6 call sites, and `BlockController.spec.ts:45` which mentions it only in a comment).
- **The adapter `tree` consumers (grep-verified, COMPLETE):**
  - `packages/react/markput/src/components/Container.tsx:12` — `tokens: s.tokens.tree` in the `useMarkput` selector, mapped at lines 39-40 with `keyOf`.
  - `packages/vue/markput/src/components/Container.vue:12` — `tokens: s.tokens.tree` in the `useMarkput` selector, mapped at the template `v-for`.
  Both become `s.tokens.renderTree`. The adapters reach the model through the `Store` type (`s.tokens` is the `TokenModel`); they import nothing named `tree`/`renderTree` directly. `keyOf` is already adapter-only and stays as-is.
- **`@markput/core` exports.** Core's `package.json` exports map has `"."` → `./index.ts` and `"./styles.module.css"`. `index.ts` (the consumer surface) does NOT currently export `tree` or `keyOf` (they are reached through `Store` → `tokens`). The spec wants the renderer SPI behind a separate `@markput/core/adapter` import. Phase 3 adds a `"./adapter"` subpath export → a new `packages/core/adapter.ts` that re-exports the adapter SPI's TYPES (the `RenderTree` alias + a doc-anchor), making the adapter contract a named, documented surface. The runtime `renderTree`/`keyOf` members stay on the live `TokenModel` instance (reached via `Store`); the subpath export is the documented contract boundary, not a second instance.
- **README is updated, not rewritten.** `packages/core/src/features/tokens/README.md` still shows the pre-Phase-2 `changed: Event<Changeset>` (Phase 2 left it; the README shrink is "rolling"). Phase 3 deletes the "### The staleness contract" section (lines ~143-158, incl. the `freshTokens` bullet) and renames `tree()` → `renderTree` in the "renderer contract" block; it does NOT attempt the full ≤150-line rewrite (that is the rolling rider).
- **No `at(`/`tokens(` collision.** `TokenModel` has `tokenAt(position)` (a handle lookup) but no `tokens()` or `at()` method — both names are free. (`tokenAt` is a Phase-5 deletion target, untouched here.)

---

### Task 1: Add `tokens()`/`at()` to the pipeline and the model — pin the fresh-read contract

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts` (add the `tokens()` accessor over `latest`)
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (mirror `tokens()`; add `at()`)
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts` (pin `tokens()`/`at()` against the fresh tree, incl. the text-path freshness contract)

This task exposes the fresh read WITHOUT touching any consumer — it is purely additive, so the full suite stays green. Consumers migrate in Tasks 3-5.

- [x] **Step 1: Write the failing tests**

Append to `TokenModel.index.spec.ts`, inside the `describe('TokenModel lookups', …)` block (it already has `mountInline`). Add a new describe at the end of the file (before the final `})` of the top-level describe is fine, or as a sibling top-level describe — make it a sibling top-level describe so the `mountInline` helper is reused via import-free closure; `mountInline` is module-scoped so a sibling describe can call it):

```ts
describe('TokenModel.tokens() / at() — the fresh reconciled read', () => {
	it('tokens() returns the reconciled tree, consistent with value.current()', () => {
		const {store, container} = mountInline('hello')
		expect(store.tokens.tokens()).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		container.remove()
	})

	it('at(index) returns the token at that top-level index, undefined past the end', () => {
		const store = new Store()
		// markup config idiom verified in TokenModel.spec.ts: a Mark + an options
		// markup are BOTH required for the parser to emit mark tokens.
		store.props.set({Mark: () => null, defaultValue: 'a@[x]b', options: [{markup: '@[__value__]'}]})
		const container = document.createElement('div')
		container.append(document.createElement('span'), document.createElement('span'), document.createElement('span'))
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()

		expect(store.tokens.at(0)).toBe(store.tokens.tokens()[0])
		expect(store.tokens.at(1)?.type).toBe('mark')
		expect(store.tokens.at(99)).toBeUndefined()
		container.remove()
	})

	it('tokens() stays fresh across a text-path edit — content tracks value.current()', () => {
		const {store, container} = mountInline('hello')
		store.value.replace({start: 5, end: 5}, '!')
		// text-path commit: renderTree keeps its reference, but tokens() is the
		// reconciled latest — fresh content, consistent with the new value.
		expect(store.value.current()).toBe('hello!')
		expect(store.tokens.tokens()[0]).toMatchObject({type: 'text', content: 'hello!', position: {start: 0, end: 6}})
		container.remove()
	})

	it('tokens() is [] before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(store.tokens.tokens()).toEqual([])
	})
})
```

(The markup-config idiom is `{Mark: () => null, options: [{markup: '@[__value__]'}]}` — verified in `TokenModel.spec.ts` (both a `Mark` and an `options` markup are required for the parser to emit marks). If any mount detail drifts, read a `TokenModel.spec.ts`/`TokenModel.facade.spec.ts` mount and copy its `props.set` shape verbatim. The assertion intent is the contract; the mount boilerplate must match the codebase.)

- [x] **Step 2: Run to verify they fail**

Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Expected: the 4 new tests FAIL (`store.tokens.tokens` / `store.tokens.at` are `undefined` — not functions). All pre-existing `TokenModel lookups` tests pass.

- [x] **Step 3: Add `tokens()` to the pipeline**

In `commit.ts`, add to the `CommitPipeline` type (after the `tree` field, ~line 38):

```ts
	/** THE consumer read: the latest reconciled tree — always fresh, consistent with value.current() (it is `latest`, reassigned at the top of every apply). Never latch-gated. */
	tokens(): readonly Token[]
```

and add it to the returned object (after `tree,`, ~line 239):

```ts
		tokens: () => latest,
```

(`latest` is already in scope and reassigned first thing in `apply`; this accessor exposes it read-only.)

- [x] **Step 4: Add `tokens()`/`at()` to the model**

In `TokenModel.ts`, add directly after the `tree` field (~line 65, keep the existing `tree` field for now — it is renamed in Task 6):

```ts
	/**
	 * THE consumer read: the latest reconciled tree, always fresh and consistent
	 * with `value.current()`. Unlike `renderTree` (the renderer signal, which keeps
	 * its reference across text-path commits), `tokens()` is the pipeline's private
	 * `latest` — reassigned at the top of every apply, fresh in the pending window
	 * too. The boundary facade and every value-slicing consumer read it.
	 */
	tokens(): readonly Token[] {
		return this.#pipeline.tokens()
	}

	/** The top-level token at `index` of the fresh reconciled tree, or undefined. */
	at(index: number): Token | undefined {
		return this.#pipeline.tokens()[index]
	}
```

- [x] **Step 5: Run to verify green**

Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Expected: all tests pass, including the 4 new ones (the text-path-freshness test confirms `tokens()` reads `latest`, not the stale `tree`).

- [x] **Step 6: Full core suite (additive change — must stay green)**

Run: `pnpm -F core test`
Expected: full pass — this task added only new members, touched no consumer, renamed nothing.

- [x] **Step 7: Commit**

```bash
git commit -m "feat(tokens): expose tokens()/at() — the always-fresh reconciled read" -- packages/core/src/features/tokens/model/commit.ts packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/TokenModel.index.spec.ts
```

---

### Task 2: Repoint the boundary facade at `tokens()` — one fresh tree

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (`#resolveAddress`, `#boundaryContext`)

The facade currently reaches the reconciled tree via `#reconciled().tokens` (re-running the memoized reconcile computed). Point it at `this.tokens()` — the same `latest`, now the single public read. This satisfies the matrix's "boundary/position reads serve the latest reconciled tree" and removes the facade's independent path to a second tree object.

- [x] **Step 1: Run the facade spec to capture the green baseline**

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass (this is the pre-change baseline — the facade behavior is what Task 2 must preserve exactly).

- [x] **Step 2: Repoint the two reads**

In `TokenModel.ts`, in `#resolveAddress` (~line 263), change:

```ts
		const current = resolvePath(this.#reconciled().tokens, address.path)
```

to:

```ts
		const current = resolvePath(this.tokens(), address.path)
```

In `#boundaryContext` (~line 277), change:

```ts
			tokens: this.#reconciled().tokens,
```

to:

```ts
			tokens: this.tokens(),
```

Leave the `watch(this.#reconciled, …)` apply wiring (line 148) and the `#reconciled` computed itself UNTOUCHED — it still drives `apply`. Only the two FACADE reads move to `tokens()`. (After this, `#reconciled` is read only by the apply watch; that is correct and intended — the facade no longer re-derives the tree.)

- [x] **Step 3: Run the facade spec + selection/caret specs**

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass — `tokens()` returns the same reconciled tree the facade read before, so boundary/position reads, `resolveAddress`, and `placeCaret` are byte-for-byte equivalent.

Run: `pnpm -w exec vitest run --project core SelectionController.spec`
Expected: full pass.

- [x] **Step 4: Full core suite**

Run: `pnpm -F core test`
Expected: full pass.

- [x] **Step 5: Commit**

```bash
git commit -m "refactor(tokens): boundary facade reads tokens() — one fresh tree" -- packages/core/src/features/tokens/model/TokenModel.ts
```

---

### Task 3: Migrate the 4 non-block `freshTokens` + `tree()` consumer call sites

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardController.ts`

These four consumers each migrate either a `freshTokens(…)` call or a `tree()` read to `tokens()`, drop the now-unused `freshTokens` import, and shed the staleness comments. Disjoint files from Tasks 4-5 — commit them together.

- [x] **Step 1: `SelectionController.ts`**

Remove the `freshTokens` import (line 11): delete `import {freshTokens} from '../tokens'`.

In `focusFirst` (~line 67), change `const first = this.tokens.tree().at(0)` to:

```ts
		const first = this.tokens.at(0)
```

In `#focusEmptyEditorOnClick` (~line 143), change:

```ts
			// freshTokens, not tree(): after typing into the single empty text
			// token the tree keeps its reference (text path) — the stale ''
			// content would steal focus on every click into a non-empty editor.
			const tokens = freshTokens(this.tokens)
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
```

to:

```ts
			// The fresh reconciled tree: after typing into the single empty text
			// token, tokens() tracks value.current() (renderTree keeps its stale
			// reference — reading it would steal focus into a non-empty editor).
			const tokens = this.tokens.tokens()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
```

- [x] **Step 2: `input.ts`**

Remove the `freshTokens` import (line 11): delete `import {freshTokens} from '../tokens'`. (`import type {Token}` on line 8 stays.)

In `rangeForDelete` (~line 101), change:

```ts
	// Fresh read: adjacency compares mark POSITIONS against the live caret
	// position — tree() positions lag after text-path commits (typing right
	// before a mark, then deleting, must still swallow the whole mark).
	const adjacentMark = adjacentMarkRange(freshTokens(store.tokens), range.start, inputType.endsWith('Backward'))
```

to:

```ts
	// Fresh read: adjacency compares mark POSITIONS against the live caret
	// position; tokens() is the reconciled tree consistent with value.current()
	// (typing right before a mark, then deleting, must still swallow the mark).
	const adjacentMark = adjacentMarkRange(store.tokens.tokens(), range.start, inputType.endsWith('Backward'))
```

- [x] **Step 3: `arrowNav.ts`**

In `shiftFocus` (~line 53), change:

```ts
	const sibling = resolvePath(store.tokens.tree(), siblingPath)
```

to:

```ts
	const sibling = resolvePath(store.tokens.tokens(), siblingPath)
```

The trailing comment block at lines 58-60 mentions "A stale tree() sibling object is fine: placeAtAddress bridges it to the live handle by identity." Update its parenthetical to reflect the fresh read:

```ts
	// Address-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries. (The sibling rides along for
	// placeAtAddress's identity check; tokens() makes it the fresh object.)
```

(`arrowNav.ts` imports nothing from `'../tokens'` named `freshTokens` — only `resolvePath` from `'../tokens/tokenIndex'`; no import change.)

- [x] **Step 4: `ClipboardController.ts`**

Remove the `freshTokens` import (line 7): delete `import {freshTokens} from '../tokens'`. (`import type {TokenModel}` on line 6 stays.)

In `#handleCopy` (~line 44), change:

```ts
		// Fresh read: the copied range came from the live selection, so the
		// serialized tokens must carry live positions too (tree() lags on the
		// text path — copying right after typing would slice stale ranges).
		e.clipboardData?.setData(MARKPUT_MIME, serializeRange(freshTokens(this.tokens), raw.range))
```

to:

```ts
		// Fresh read: the copied range came from the live selection, so the
		// serialized tokens carry live positions — tokens() is the reconciled
		// tree consistent with value.current() (copy right after typing is fresh).
		e.clipboardData?.setData(MARKPUT_MIME, serializeRange(this.tokens.tokens(), raw.range))
```

- [x] **Step 5: Run the affected specs**

Run: `pnpm -w exec vitest run --project core SelectionController.spec`
Run: `pnpm -w exec vitest run --project core ClipboardController`
Expected: full pass each. (`input.ts`/`arrowNav.ts` are exercised through keyboard/block specs and the storybook page specs; the full core run in Step 6 covers them.)

- [x] **Step 6: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean — no dangling `freshTokens` import in these four files. (`freshTokens.ts` itself still exists; the export line still exists — deleted in Task 5. The remaining `blockEdit.ts`/`BlockController.ts` imports are migrated in Task 4.)

- [x] **Step 7: Commit**

```bash
git commit -m "refactor(tokens): selection/input/arrowNav/clipboard read tokens() — drop freshTokens" -- packages/core/src/features/selection/SelectionController.ts packages/core/src/features/keyboard/input.ts packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/clipboard/ClipboardController.ts
```

---

### Task 4: Migrate the block consumers — `blockEdit.ts`, `BlockController.ts`

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/block/BlockController.ts`

The two block consumers hold the remaining `freshTokens` imports (2 call sites in `blockEdit`, 1 in `BlockController`) and the three `tree()` reads (`rowHandle`, two `rowCount`). All become `tokens()`.

- [x] **Step 1: `blockEdit.ts`**

Remove the `freshTokens` import (line 11): delete `import {freshTokens} from '../tokens'`. (`import type {Token, TokenHandle}` on line 10 stays.)

In `rowHandle` (~line 28), change:

```ts
	// Row identity from the render tree, liveness from the id bridge — the
	// tree token may be a stale object after text-path commits, the handle is
	// always the current one (and undefined while a structural apply is unbound).
	const row = store.tokens.tree().at(rowIndex)
	return row ? store.tokens.handleOf(row) : undefined
```

to:

```ts
	// Row identity from the fresh reconciled tree, liveness from the id bridge:
	// tokens() carries the current row object; handleOf maps it to the live
	// handle (undefined while a structural apply is unbound — fail-closed).
	const row = store.tokens.at(rowIndex)
	return row ? store.tokens.handleOf(row) : undefined
```

In `handleDelete` (~line 76), change:

```ts
	// Fresh read: row positions slice value.current() — stale tree() positions
	// after a text-path commit would cut the wrong ranges.
	const rows = freshTokens(store.tokens)
```

to:

```ts
	// Fresh read: row positions slice value.current(); tokens() is the reconciled
	// tree consistent with the value, so the cuts hit the right ranges.
	const rows = store.tokens.tokens()
```

In `handleEnter` (~line 137), change `const rows = freshTokens(store.tokens)` to:

```ts
	const rows = store.tokens.tokens()
```

In `handleBlockArrowLeftRight` (~line 173), change:

```ts
	// Count-only read: row COUNT is structural, so the render tree is never stale here.
	const rowCount = store.tokens.tree().length
```

to:

```ts
	const rowCount = store.tokens.tokens().length
```

In `handleArrowUpDown` (~line 199), change `const rowCount = store.tokens.tree().length` to:

```ts
	const rowCount = store.tokens.tokens().length
```

NOTE: `handleDelete`/`handleEnter`/`mergeOrFocusNeighbor` pass `rows` (now `store.tokens.tokens()`, typed `readonly Token[]`) into helpers typed `rows: Token[]` (`mergeOrFocusNeighbor` ~line 281, and the `addDragRow`/`mergeDragRows`/`applyDragAction` operation signatures). If `tokens()`'s `readonly Token[]` return type triggers a `readonly`-assignability typecheck error at any call, the minimal fix is to widen those local helper/operation parameter types to `readonly Token[]` (they never mutate the array) — do NOT cast away `readonly`. Verify in Step 3; apply only where the typecheck demands it, in `blockEdit.ts`/`operations.ts` signatures.

- [x] **Step 2: `BlockController.ts`**

Remove the `freshTokens` import (line 7): delete `import {freshTokens} from '../tokens'`. (`import type {Token, TokenModel}` on line 6 stays.)

In the drag-action watch (~line 34), change:

```ts
			// Fresh read: drag operations slice the live value by row positions.
			// A plain-text row keeps block typing on the text path, so tree()
			// positions can lag the value at drop time.
			const result = applyDragAction(value, freshTokens(this.tokens), action, this.props.options())
```

to:

```ts
			// Fresh read: drag operations slice the live value by row positions;
			// tokens() is the reconciled tree consistent with value.current() at
			// drop time.
			const result = applyDragAction(value, this.tokens.tokens(), action, this.props.options())
```

(`applyDragAction`'s `rows` parameter type may need widening to `readonly Token[]` — same `readonly`-assignability note as Step 1; fix in `operations.ts` only if the typecheck demands it.)

- [x] **Step 3: Run the block specs + typecheck**

Run: `pnpm -w exec vitest run --project core BlockController`
Expected: full pass (including the Phase-1 prune test — untouched; it reads through `removedIds()`, not the tree).

Run: `pnpm run typecheck`
Expected: clean. If a `readonly Token[]` is not assignable to a `Token[]` parameter, widen that parameter to `readonly Token[]` in `blockEdit.ts`/`operations.ts` (the operation never mutates the input array — verify by reading the function body before widening). If the function DOES mutate, it must `.slice()` first; do not strip `readonly` with a cast.

- [x] **Step 4: Full core + storybook (block typing/drag run through the page specs)**

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm -F storybook test`
Expected: full pass — the block render-count gates and the empty-row gate (Phase 0) exercise `blockEdit` row typing through `tokens()` now; they assert tree-watcher/mount counts, unaffected by the read-source swap.

- [x] **Step 5: Commit**

If `operations.ts` was edited for the `readonly` widening, include it in the path list; otherwise omit it.

```bash
git commit -m "refactor(tokens): block edit + drag read tokens() — drop freshTokens" -- packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/block/BlockController.ts
```

(Add `packages/core/src/features/block/operations.ts` to the path list only if Step 3 required widening it.)

---

### Task 5: Migrate MarkController, delete `freshTokens.ts` + its export + README staleness section

**Files:**
- Modify: `packages/core/src/features/tokens/MarkController.ts`
- Delete: `packages/core/src/features/tokens/utils/freshTokens.ts`
- Modify: `packages/core/src/features/tokens/index.ts` (drop the `freshTokens` export)
- Modify: `packages/core/src/features/tokens/README.md` (delete the staleness-contract section; rename `tree()` → `renderTree` in the renderer-contract block)

MarkController holds the last two `tree()` reads. After they migrate, `freshTokens` has zero references and is deleted with its export and its 18-line staleness comment.

- [x] **Step 1: `MarkController.ts`**

In `#addressInTree` (~line 30), change:

```ts
		const path = pathOf(store.tokens.tree(), token)
```

to:

```ts
		const path = pathOf(store.tokens.tokens(), token)
```

In `#resolveCaptured` (~line 101), change:

```ts
		const current = resolvePath(this.store.tokens.tree(), this.address.path)
```

to:

```ts
		const current = resolvePath(this.store.tokens.tokens(), this.address.path)
```

(`pathOf`/`resolvePath` take `readonly Token[]`-compatible inputs — `pathOf`'s parameter is already `readonly Token[]` at line 107; `resolvePath` is read-only. No signature change. The MarkController identity/path semantics are unchanged — `tokens()` is the same tree shape, now fresh. The full re-backing of MarkController by a handle, deleting `#resolveCaptured`/`pathOf`, is Phase 4 — NOT this phase.)

- [x] **Step 2: Run MarkController.spec**

Run: `pnpm -w exec vitest run --project core MarkController.spec`
Expected: full pass — the controller resolves the same token objects (now from the fresh tree). The `MarkController.spec` continuity cases (incl. the Phase-2-amended `same-slot replacement`) read through the public `update()`/`remove()` flow, unaffected by the internal data-source swap.

- [x] **Step 3: Delete `freshTokens.ts` and its export**

Verify zero remaining references first:

```bash
grep -rn "freshTokens" packages/core/src
```

Expected: ONLY `utils/freshTokens.ts`, `tokens/index.ts:10`, `README.md`, and the `BlockController.spec.ts:45` comment. If any PRODUCTION call site remains, it was missed in Tasks 3-4 — fix it before deleting.

Delete the file:

```bash
git rm packages/core/src/features/tokens/utils/freshTokens.ts
```

In `tokens/index.ts`, delete line 10:

```ts
export {freshTokens} from './utils/freshTokens'
```

- [x] **Step 4: Update the README**

In `packages/core/src/features/tokens/README.md`:

- Delete the entire `### The staleness contract` section (the heading and its body through the `freshTokens(store.tokens)` bullet — the lines describing `tree()` as the RENDER tree, the handles-always-fresh bullet, the `handleOf` bullet, and the `freshTokens` bullet). Replace it with a tight three-line successor:

```md
### The fresh read

`tokens()` is the always-fresh reconciled tree — consistent with `value.current()`
on both commit branches (it is the pipeline's `latest`, reassigned every apply).
`renderTree` is the RENDERER signal: it keeps its reference across text-path
commits so subscribed adapters skip re-rendering — adapter-only, not consumer data.
Handles (`handle.token()`) carry current content/positions; `handleOf(token)` maps
a token to its live handle, failing closed while a structural apply awaits its bind.
```

- In the "renderer contract" block (~line 110-112), rename `tree: Computed<Token[]>` to `renderTree: Computed<Token[]>` and add a `tokens()` line above it in the consumer-read region:

```md
// consumer read
tokens() // the always-fresh reconciled tree; at(i) the token at top-level index i

// renderer contract (adapter-only — @markput/core/adapter)
renderTree: Computed<Token[]> // structural tree; reference change ⇔ renderer must run
changed: Event<void> // THE model-level detector; fires after the DOM is consistent
```

(This corrects the stale `changed: Event<Changeset>` line Phase 2 left behind — a free fix while editing this block. Do NOT attempt the full README ≤150-line rewrite; that is the rolling rider.)

- [x] **Step 5: Run + typecheck + encapsulation**

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean — `freshTokens` is gone from every import and the export; no module resolves `./utils/freshTokens` anymore.

Run: `pnpm run check:encapsulation`
Expected: pass.

- [x] **Step 6: Commit**

```bash
git commit -m "refactor(tokens): MarkController reads tokens(); delete freshTokens + staleness contract" -- packages/core/src/features/tokens/MarkController.ts packages/core/src/features/tokens/utils/freshTokens.ts packages/core/src/features/tokens/index.ts packages/core/src/features/tokens/README.md
```

(The `git rm` already staged the deletion; the path-scoped commit includes it.)

---

### Task 6: Rename `tree` → `renderTree`; expose the adapter SPI behind `@markput/core/adapter`

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts` (`CommitPipeline.tree` → `renderTree`)
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (the `tree` field → `renderTree`)
- Create: `packages/core/adapter.ts` (the adapter SPI surface)
- Modify: `packages/core/package.json` (add the `"./adapter"` subpath export)
- Modify: `packages/core/src/features/tokens/TokenModel.changed.spec.ts` (the render-count gate's `watch(store.tokens.tree, …)` → `renderTree`)
- Modify any core spec that watches/reads the renamed signal as the RENDERER contract (grep-driven)

This renames the renderer signal to `renderTree` everywhere it is the RENDERER contract (the structural signal whose reference-stability gates re-renders) and documents the adapter surface as a subpath import. Consumer DATA reads were already migrated to `tokens()` in Tasks 1-5, so the only `tree`/`renderTree` references left are renderer-contract ones.

- [x] **Step 1: Find every remaining `tree` reference**

Run:

```bash
grep -rn "\.tree\b\|\btree:\|tokens\.tree\|store\.tokens\.tree\|\.tree(" packages/core/src --include="*.ts" --include="*.tsx"
```

Triage each hit:
- **Renderer-contract reads** (`watch(store.tokens.tree, …)` in `TokenModel.changed.spec.ts`; the `CommitPipeline.tree` field; `TokenModel.tree` field; `tree(tokens)` writes in `commitStructural`; `const tree = signal(…)`) → RENAME to `renderTree`.
- **Consumer DATA reads** (`store.tokens.tree()` as a parsed-tree assertion in `TokenModel.spec.ts`, `ValueModel.spec.ts`, `Store.spec.ts`, `TokenModel.facade.spec.ts`, `TokenModel.index.spec.ts`, `MarkController.spec.ts`, `TokenHandle.spec.ts`, `SelectionController.spec.ts`) → these read the tree as DATA; migrate them to `tokens()` (they are spec reads, but the spec acceptance bar is that consumer data reads go through `tokens()`). Each `store.tokens.tree()` data assertion becomes `store.tokens.tokens()`. The ONE exception is `TokenModel.changed.spec.ts:128` `watch(store.tokens.tree, treeSpy)` — that is the RENDERER reference-stability gate and becomes `watch(store.tokens.renderTree, treeSpy)`.

(This is a mechanical sweep. The distinction is always: a `watch(…tree, …)` on the signal object = renderer gate = `renderTree`; a `…tree()` call reading the array as data = `tokens()`.)

- [x] **Step 2: Rename in `commit.ts`**

In `commit.ts`:
- The local `const tree = signal<Token[]>({initial: []})` (~line 59) → `const renderTree = signal<Token[]>({initial: []})`. Update its doc comment to refer to the renderer signal by the new name.
- `tree(tokens)` in `commitStructural` (~line 177) → `renderTree(tokens)`.
- The `CommitPipeline.tree: Computed<Token[]>` field (~line 38) → `renderTree: Computed<Token[]>` (keep the "reference changes ⇔ the renderer must run" comment).
- The returned object's `tree,` (~line 239) → `renderTree,`.

- [x] **Step 3: Rename in `TokenModel.ts`**

In `TokenModel.ts`, the field (~line 64-65):

```ts
	/** Renderer contract: reference changes ⇔ the renderer must run. */
	readonly tree: Computed<Token[]> = this.#pipeline.tree
```

becomes:

```ts
	/** Renderer contract (adapter-only — `@markput/core/adapter`): reference change ⇔ the renderer must run. NOT a consumer data read — use `tokens()`. */
	readonly renderTree: Computed<Token[]> = this.#pipeline.renderTree
```

- [x] **Step 4: Create the adapter SPI surface**

Create `packages/core/adapter.ts`:

```ts
// @markput/core/adapter — the renderer SPI, separate from the consumer surface.
//
// The renderer contract is reached on the live TokenModel via the Store
// (`store.tokens.renderTree` / `store.tokens.keyOf`); this module is the
// DOCUMENTED boundary — the type of the render tree and the handshake/key
// helpers an adapter binds to. Consumers never import this; they read
// `tokens()` for the always-fresh tree.

import type {Computed} from './src/shared/signals'
import type {Token} from './src/features/tokens'

/** The renderer signal's value: a structural snapshot whose REFERENCE change ⇔ the renderer must run. */
export type RenderTree = Computed<Token[]>
```

(This is the minimal honest surface: the adapter SPI's runtime members live on the `TokenModel` instance reached through `Store` — there is no second instance to construct. The subpath export NAMES the contract. If a later phase grows freestanding adapter helpers, they land here. Keep it small and true.)

- [x] **Step 5: Add the `"./adapter"` subpath export**

In `packages/core/package.json`, in the `exports` map, add the `"./adapter"` entry (after `"."`):

```json
  "exports": {
    ".": {
      "import": "./index.ts"
    },
    "./adapter": {
      "import": "./adapter.ts"
    },
    "./styles.module.css": "./styles.module.css"
  },
```

- [x] **Step 6: Migrate the renderer-contract spec watch + the data-read spec assertions**

In `TokenModel.changed.spec.ts`:
- Line ~128 `watch(store.tokens.tree, treeSpy)` → `watch(store.tokens.renderTree, treeSpy)` (the render-count gate — it asserts the renderer signal fires 0 times on text edits, 1 on structural; the signal is now `renderTree`).
- The DATA reads in this spec (`store.tokens.tree()[index]` at lines ~29, ~48, ~53, ~155) → `store.tokens.tokens()[index]` / `store.tokens.tokens().map(…)`.

In the remaining DATA-read specs from Step 1's triage (`TokenModel.spec.ts`, `ValueModel.spec.ts`, `Store.spec.ts`, `TokenModel.facade.spec.ts`, `TokenModel.index.spec.ts`, `MarkController.spec.ts`, `TokenHandle.spec.ts`, `SelectionController.spec.ts`), replace each `store.tokens.tree()` data read with `store.tokens.tokens()`. These are mechanical `tree()` → `tokens()` swaps on the array-as-data reads; the assertions are unchanged (same tree shape, now the fresh read). Do them spec-by-spec, running each after, to keep the diff legible.

- [x] **Step 7: Run the core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass — `renderTree` watch fires on the same schedule `tree` did (rename only); the data-read specs assert the same tree through `tokens()`.

Run: `pnpm run typecheck`
Expected: clean — no `.tree` member remains on `TokenModel`/`CommitPipeline`; the only `renderTree` references are the renderer-contract ones.

Run: `grep -rn "\.tree\b\|tokens\.tree\b" packages/core/src`
Expected: ZERO hits (every `tree` is renamed or migrated). Any remaining hit is a missed rename — fix it.

- [x] **Step 8: Commit**

```bash
git commit -m "refactor(tokens): rename tree → renderTree; expose @markput/core/adapter SPI" -- packages/core/src/features/tokens/model/commit.ts packages/core/src/features/tokens/model/TokenModel.ts packages/core/adapter.ts packages/core/package.json packages/core/src/features/tokens/TokenModel.changed.spec.ts packages/core/src/features/tokens/TokenModel.spec.ts packages/core/src/features/state/ValueModel.spec.ts packages/core/src/store/Store.spec.ts packages/core/src/features/tokens/TokenModel.facade.spec.ts packages/core/src/features/tokens/TokenModel.index.spec.ts packages/core/src/features/tokens/MarkController.spec.ts packages/core/src/features/tokens/TokenHandle.spec.ts packages/core/src/features/selection/SelectionController.spec.ts
```

(Stage only the spec files Step 6 actually edited — drop any that had no `tree()` data read. Verify with `git status` before committing.)

---

### Task 7: Migrate the adapters — `s.tokens.tree` → `s.tokens.renderTree`

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx`
- Modify: `packages/vue/markput/src/components/Container.vue`

The adapters reach the renderer signal through the `Store` (`s.tokens.renderTree`). They import nothing named `tree`; the only change is the selector key.

- [x] **Step 1: React `Container.tsx`**

In the `useMarkput` selector (~line 12), change:

```ts
		tokens: s.tokens.tree,
```

to:

```ts
		tokens: s.tokens.renderTree,
```

(The local destructured name `tokens` and its `.map` at lines 39-40 stay — it is the rendered token array, correctly sourced from the renderer signal now named `renderTree`. `keyOf` is unchanged.)

- [x] **Step 2: Vue `Container.vue`**

In the `useMarkput` selector (~line 12), change:

```ts
	tokens: s.tokens.tree,
```

to:

```ts
	tokens: s.tokens.renderTree,
```

(`result.tokens` in the template `v-for` and `result.keyOf` are unchanged.)

- [x] **Step 3: Typecheck both adapters**

Run: `pnpm run typecheck`
Expected: clean — `s.tokens.renderTree` resolves (the `Store`'s `tokens` is the `TokenModel`, which now has `renderTree`); `s.tokens.tree` no longer exists, so a missed rename would surface here.

- [x] **Step 4: Storybook page specs (the real adapter render path)**

Run: `pnpm -F storybook test`
Expected: full pass — both the react and vue render-count/remount/empty-row gates render through `s.tokens.renderTree` now. The render gating is reference-stability of the same signal (renamed), so the counts are identical.

If you want to isolate during iteration:

```bash
pnpm -F storybook test:react
pnpm -F storybook test:vue
```

- [x] **Step 5: Commit**

```bash
git commit -m "refactor(adapters): Container reads s.tokens.renderTree" -- packages/react/markput/src/components/Container.tsx packages/vue/markput/src/components/Container.vue
```

---

### Task 8: Full verification

- [x] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # full core suite — the Phase-2 baseline + the 4 tokens()/at() tests; every consumer + spec data-read now on tokens()
pnpm -F storybook test       # react + vue page specs, incl. remount + render-count + empty-row gates — UNCHANGED counts, now rendering via renderTree
pnpm run typecheck           # recursive tsc/vue-tsc — zero dangling .tree members, zero freshTokens imports, the adapter subpath resolves
pnpm run check:encapsulation
```

- [x] **Step 2: Confirm the deletions and renames landed**

Run: `grep -rn "freshTokens" packages/core/src`
Expected: ZERO hits except the `BlockController.spec.ts:45` COMMENT mention (which references the historical behavior; update that comment to say "tokens() stays the reconciled parse" if it still reads as a `freshTokens` claim, then re-grep — zero `freshTokens(` call expressions anywhere).

Run: `grep -rn "\.tree\b\|tokens\.tree\b\|s\.tokens\.tree\b" packages/core/src packages/react/markput/src packages/vue/markput/src`
Expected: ZERO hits — `tree` is fully renamed to `renderTree` (renderer) or migrated to `tokens()` (data).

Run: `grep -rn "tokens()\|renderTree\|at(" packages/core/src/features/tokens/model/TokenModel.ts`
Expected: the new `tokens()`/`at()` methods and the `renderTree` field are present.

Run: `ls packages/core/adapter.ts && grep -n "\"./adapter\"" packages/core/package.json`
Expected: the adapter module exists and the subpath export is registered.

- [x] **Step 3: Confirm clean and report**

`git status` must be clean (everything committed task-by-task, path-scoped). Report: the core suite pass count, the storybook react/vue counts, and confirm typecheck + encapsulation guard green. State explicitly that `freshTokens.ts` is deleted, `tokens()`/`at()` are the public fresh read, `renderTree` is the renamed renderer signal behind `@markput/core/adapter`, and the pending-window matrix holds (`tokens()` always fresh, handle lookups still fail-closed).

---

### Task 9: Write the Phase 4 plan (phase chaining)

- [x] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase4.md` for **Phase 4 — kill TokenAddress (semver-major)** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`, Phase 4): replace the four lookups with `handle(id)` + `handleAt(node)` only; add the `placeCaret` handle form; re-back `MarkController` by a handle (deleting `#resolveCaptured`, the `pathOf` DFS, and the justification comment), with `value`/`meta`/`slot`/`readOnly` becoming live reads of the current token and `update()` against a pending/dead id a fail-closed no-op returning `false`; delete `TokenAddress = {path, token}`, `#resolveAddress`, and the triple-duplicated `handleFor(address) + handleOf(address.token) !== handle` validity idiom from `editorContracts` and its call sites (`SelectionController.#resolveAddress`/`#applyPreferredAddress`, `placeCaret`'s address form, `arrowNav`/`blockEdit` `placeAtAddress`); ship `useMarkInfo` with `path()`/id (deleting its end-user staleness warning); pin the MarkController live-read parity tables (the spec's §MarkController semantics). Ground the plan by reading FIRST, with fresh eyes, the POST-Phase-3 code: `packages/core/src/shared/editorContracts.ts` (the `TokenAddress`/`TokenPath` types), `packages/core/src/features/tokens/model/TokenModel.ts` (`handleFor`/`handleAt`/`handleOf`/`tokenAt`/`handles`, `#resolveAddress`, `#viewOf`, `placeCaret`'s address form, the boundary facade now on `tokens()`), `packages/core/src/features/tokens/MarkController.ts` (`fromToken`/`#addressInTree`/`#resolve`/`#resolveCaptured`/`pathOf`), `packages/core/src/features/selection/SelectionController.ts` (`#resolveAddress`/`#applyPreferredAddress`/`placeAtAddress`), `packages/core/src/features/keyboard/arrowNav.ts` + `blockEdit.ts` (`placeAtAddress` call sites + `focusRow`), and the adapter `useMarkInfo` hooks (`packages/react/markput/src/lib/hooks/useMarkInfo.tsx`, `packages/vue/markput/src/lib/hooks/useMarkInfo.ts`) and the `TokenContext`/`tokenKey` providers that carry the render-time path. Decide the EXACT `handle(id)` signature and how `MarkController.fromToken` resolves an id (the adapter still hands in a render-tree token — bridge by `token.id`, the Phase-1 plain field). No placeholder steps — every step shows exact code; bite-sized TDD tasks; frequent path-scoped commits; the required plan header (Goal / Architecture / Tech Stack / Commits-in-a-shared-checkout / Spec / Background facts). The LAST task of the Phase 4 plan must be "write the Phase 5 plan" (phase chaining). Verification commands MUST follow this plan's Tech Stack note: `pnpm -F core test`, `pnpm -F storybook test` / `test:react` / `test:vue`, `pnpm run typecheck`, `pnpm run check:encapsulation` — NEVER `pnpm -F react test` or `pnpm -F vue test` (silent no-ops).

- [x] **Step 2: Commit the plan**

```bash
git commit -m "docs(plan): one-fresh-truth phase 4 — kill TokenAddress" -- docs/superpowers/plans/2026-06-13-one-fresh-truth-phase4.md
```
