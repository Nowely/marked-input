# b0 Simplifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the b0 review's 45 ranked, adversarially-verified simplifications across 36 tasks as a series of small, independently-revertible, green-at-each-boundary commits.

**Architecture:** Behavior-preserving refactor of the `@markput/core` token model and the React/Vue adapters. No new behavior. Each task collapses mirrored state, inlines single-consumer indirection, deletes dead/unreachable code, lifts duplicated adapter logic into core, or trims dead public/internal surface. Breaking public-API changes are in scope (the branch already ships `!` commits); they are flagged per task.

**Tech Stack:** TypeScript (dependency-free core), React adapter, Vue adapter, Vitest, pnpm workspaces.

---

## Decisions locked before coding

- **Breaking changes are approved.** Public-surface removals (overlay `createMarkFromOverlay`, `DragAction`/`DragActions`/`RawSelection` re-exports, `MarkInfo.key`, signal-barrel re-exports) land as explicit `!` commits, never buried as "internal cleanup".
- **`MarkInfo` is reduced to `{ depth, hasNestedMarks }` — `id`, `path`, AND `key` are all dropped (#38 + #12, folded into Task T23).** Verified across the whole repo: `id` and `path` have **zero** code consumers (no core/adapter/app/storybook/spec reads them); `depth` (18 reads) and `hasNestedMarks` (16 reads) are load-bearing; `key` has a single consumer (a `console.log` debug object in one story). `id`/`path` were added speculatively by `feat(adapters)!: useMarkInfo ships id/path` when `TokenAddress` was deleted, but no caller materialized — so per AGENTS.md ("don't add public surface without a current caller") they are dead surface, consistent with this branch's deletion of `MarkSnapshot`/`findToken`/`TokenContext`. `path` survives only as `toMarkInfo`'s internal input (it computes `depth = path.length - 1`), not as a returned field. Website prose listing these fields is already stale (still mentions the deleted `address`) and is fixed as part of T23.
- **This is a refactor, not greenfield TDD.** The safety net is the EXISTING spec suite. The discipline per task: (1) confirm the guarding spec is green on the current tree, (2) make the change, updating in the SAME task any spec that imports a removed/renamed symbol, (3) confirm the guarding spec + typecheck are green, (4) commit. Do not leave a caller (including specs) referencing a removed symbol across a commit boundary.

## Per-task protocol (applies to EVERY task below)

Each task lists **Findings**, **Files**, **Change**, **Guard specs**, **Commit**. Execute these five steps for every task:

- [ ] **Step A — Baseline green:** Run the task's Guard specs and confirm PASS before touching code.
  `pnpm -w exec vitest run <guard spec paths>`
- [ ] **Step B — Make the change** exactly as described under **Change** (including any spec edits the change names).
- [ ] **Step C — Verify focused:** Re-run the Guard specs (PASS) and `pnpm run typecheck` (no errors).
- [ ] **Step D — Verify wide (at the END of each numbered Phase only):** `pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`. Run `pnpm run format` / `pnpm run lint` to fix if needed.
- [ ] **Step E — Commit** with the given message (append the trailer below).

**Commit trailer (every commit):**
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

You are on branch `b0` (not the default `next`) — commit directly on `b0`.

---

# Phase 1 — Identity core (`tokenIdentity.ts`)

> These three tasks edit the same file and MUST land in order (T1 → T2 → T3).

### Task T1: Collapse the `ids` WeakMap into the stamped `token.id`

**Findings:** #1 (high)

**Files:**
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts`

**Change:** The tracker maintains a `WeakMap<Token,number>` AND writes `token.id` in lockstep (the self-described "Phase 1 shim"). Make `token.id` the single source.

1. Delete the WeakMap declaration:
```ts
const ids = new WeakMap<Token, number>()
```

2. Replace `ensureId` with (note the `?? (assign)` so TS narrows the return to `number`):
```ts
	const ensureId = (token: Token): number => {
		const id = token.id ?? (token.id = nextId++)
		if (token.type === 'mark') token.children.forEach(ensureId)
		return id
	}
```

3. Replace `inherit` with:
```ts
	const inherit = (from: Token, to: Token): void => {
		if (from.id !== undefined) to.id = from.id
		if (from.type === 'mark' && to.type === 'mark') {
			const len = Math.min(from.children.length, to.children.length)
			for (let i = 0; i < len; i++) inherit(from.children[i], to.children[i])
			to.children.forEach(ensureId)
		}
	}
```

4. Replace `idFor`:
```ts
		idFor: token => token.id,
```

5. In `tryDescend`, replace:
```ts
				const id = ids.get(prevMark)
				if (id !== undefined) ids.set(nextMark, id)
```
with:
```ts
				if (prevMark.id !== undefined) nextMark.id = prevMark.id
```

6. Rewrite the now-stale "Phase 1 shim" comment inside `ensureId` to a one-liner: `// token.id is the single identity source; allocate only on first sight so the nextId sequence is stable.`

**Guard specs:**
```
packages/core/src/features/tokens/tokenIdentity.spec.ts
packages/core/src/features/tokens/tokenIdentity.property.spec.ts
packages/core/src/features/tokens/TokenModel.spec.ts
packages/core/src/features/tokens/model/bind.spec.ts
packages/core/src/features/tokens/model/commit.spec.ts
```

**Commit:** `refactor(tokens): collapse the identity WeakMap into token.id — one identity source`

---

### Task T2: Unify the two descend-or-text match tails + inline `tokensEqual`

**Findings:** #9 (low), #34 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts`

**Change:**

1. **#34** — At line ~280 the top-level prefix loop calls the single-use wrapper `tokensEqual(prev[p], next[p])`. Replace that call with `tokensEqualShifted(prev[p], next[p], 0)` (matching the other three call sites), then delete the wrapper:
```ts
function tokensEqual(a: Token, b: Token): boolean {
	return tokensEqualShifted(a, b, 0)
}
```

2. **#9** — The "refused-descend → text, else descend" rule is duplicated between the slot-child middle (`pairSlotChildren`'s final `for` loop) and the top-level middle (`reconcile`'s `for (let i = p; i <= nextTail; i++)`). Extract a closure over the shared `changes`/`structural`/`tryDescend`/`inherit` scope inside `reconcile`:
```ts
		// Pair an id-matched (a,b): descend if possible, else inherit + report as
		// a text change (a refused-descend MARK renders framework props → structural).
		const matchOrText = (a: Token, b: Token, path: TokenPath): void => {
			if (a.type === 'mark' && b.type === 'mark' && tryDescend(a, b, path)) return
			inherit(a, b)
			if (b.type === 'mark') structural = true
			changes.push({id: ensureId(b), token: b, path, kind: 'text'})
		}
```
   - In `pairSlotChildren`'s tail `for (let i = lo; i <= hi; i++)` loop, replace the descend/inherit/push body with `matchOrText(prevKids[i], kids[i], [...basePath, i])`.
   - In the top-level middle loop, replace the inner descend/inherit/push (the branch taken when `candidate` matches) with `matchOrText(candidate, token, [i])`; keep the `else { collectChanges(token, [i], 'add'); structural = true }` arm inline.
   - `matchOrText` must be declared before `pairSlotChildren`/`tryDescend` use it (hoisted `const` arrow — declare it near the top of `reconcile`, after `collectChanges`). Since `tryDescend` references `pairSlotChildren` and vice-versa, keep all three as `const` arrows in the existing mutual-reference order; `matchOrText` only calls `tryDescend`/`inherit`/`ensureId`, all in scope.

**Guard specs:** (must include the nested-refusal regression pin from commit `d84c88e9`)
```
packages/core/src/features/tokens/tokenIdentity.spec.ts
packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

**Commit:** `refactor(tokens): dedupe the descend-or-text match tail; inline tokensEqual`

---

### Task T3: Reduce `keyOf` to the stamped id; drop the unreachable `idOf` fallback

**Findings:** #15 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`

**Change:** Every token `keyOf` ever sees is a render-tree token (id-stamped by reconcile, asserted by `bind.ts` and the identity property spec), so the `?? this.#identity.idOf(token)` arm is dead. `Token.id` is declared `id?: number`, so a bare `token.id` won't typecheck against the `number` return — assert the invariant:
```ts
	/**
	 * Adapter SPI: the framework key of a render-tree token — its stable identity
	 * id. Every token an adapter renders comes from the reconciled tree, so the id
	 * is always present (bind.ts throws loud otherwise). Arrow property: adapters
	 * pass it around unbound.
	 */
	readonly keyOf = (token: Token): number => token.id as number
```
Keep `IdentityTracker.idOf` (used ~40× by the identity specs as an id oracle); it just stops being referenced from production. Remove the now-unused `#identity` reference ONLY if nothing else uses it — `#identity.idFor` and `#identity.reconcile` are still used by the pipeline/`#reparse`, so `#identity` stays; only the `idOf` call site is removed.

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.spec.ts
packages/core/src/features/tokens/tokenIdentity.spec.ts
packages/storybook/src/pages/renderCount.react.spec.tsx
```

**Commit:** `refactor(tokens): keyOf reads the stamped id; drop the dead idOf fallback`

> **End of Phase 1 — run Step D (wide verify).**

---

# Phase 2 — TokenModel facade

### Task T4: Add `TokenModel.handleOf(token)`, collapse 4 id-bridges, drop `at()`

**Findings:** #2 (medium), #7 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts`

**Change:**

1. In `TokenModel`, add the owner method (note `Token | undefined` — `focusFirst` passes `current()[0]`, undefined on an empty editor):
```ts
	/** The live handle for a render-tree token, or undefined (no id / mid-window / dead). */
	handleOf(token: Token | undefined): TokenHandle | undefined {
		return token?.id === undefined ? undefined : this.handle(token.id)
	}
```
2. Have `#viewOf` delegate to it:
```ts
	#viewOf(token: Token): TokenView | undefined {
		const handle = this.handleOf(token)
		return handle ? this.#view(handle) : undefined
	}
```
3. Delete `at(index)` and its doc comment:
```ts
	at(index: number): Token | undefined {
		return this.#pipeline.current()[index]
	}
```
4. Update `SelectionController.focusFirst` (currently `this.tokens.at(0)` + manual id guard):
```ts
	focusFirst(): void {
		const handle = this.tokens.handleOf(this.tokens.current()[0])
		if (handle && this.placeAtHandle(handle, 'start')) return
		this.host.container()?.focus()
	}
```
5. In `blockEdit.ts`, replace the two open-coded `token.id === undefined ? undefined : store.tokens.handle(token.id)` bridges (the `rowHandle` helper at ~27-28 and the `focusRow` mark branch at ~155-159) with `store.tokens.handleOf(<token>)`. Where the source token comes from `store.tokens.at(rowIndex)`, change it to `store.tokens.current()[rowIndex]` and feed `handleOf`.
6. In `arrowNav.shiftFocus`, replace:
```ts
	const sibling = resolvePath(store.tokens.current(), siblingPath)
	if (sibling?.id === undefined) return false
	const siblingHandle = store.tokens.handle(sibling.id)
	if (!siblingHandle) return false
```
with:
```ts
	const sibling = resolvePath(store.tokens.current(), siblingPath)
	const siblingHandle = store.tokens.handleOf(sibling)
	if (!siblingHandle) return false
```
7. In `TokenModel.index.spec.ts`, delete the entire `it()` block that exercises `at()` (the finding pins it at lines ~122-137 — verify the block boundaries before deleting) and adjust the surrounding `describe` header that referenced `at`. The bare `handle(id)` method stays (specs still call it).

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.index.spec.ts
packages/core/src/features/selection/SelectionController.spec.ts
packages/core/src/features/keyboard/blockEdit.spec.ts
packages/core/src/features/keyboard/arrowNav.spec.ts
```
(If a named keyboard spec does not exist, run the directory: `pnpm -w exec vitest run packages/core/src/features/keyboard`.)

**Commit:** `refactor(tokens): add handleOf(token), collapse 4 id-bridges; drop at()`

---

### Task T5: `TokenModel.placeCaret` delegates the handle form to `TokenHandle.placeCaret`

**Findings:** #18 (medium)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`

**Change:** The handle branch of `placeCaret` re-implements `TokenHandle.placeCaret` and carries a dead `?? tokenElement` fallback + an always-true `textElement` guard. `TokenHandle.placeCaret` already fails closed on a dead/unbound handle. Replace the handle branch:
```ts
	placeCaret(target: number | {handle: TokenHandle; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)
		return target.handle.placeCaret(target.offset)
	}
```
Delete the now-unused branch body (the `if (!handle.alive())` / `bindings` / mark-vs-text-surface block). Verify no import becomes unused (`focusIfNeeded`, `placeAtChildBoundary`, `placeAtTextOffset` are still used elsewhere in the file — `#placeAtRawPosition`/`selectRange` — keep them).

**Note on offset semantics:** `TokenHandle.placeCaret` clamps a finite offset to `[0, textLength]` and treats `Infinity → end`; the deleted `TokenModel` branch used `target.offset <= 0 ? 'start' : 'end'` for surfaceless marks and a raw `placeAtTextOffset(textElement, target.offset)` for text. The sole production caller (`SelectionController.#applyPreferredHandle`) passes `rawPosition - handle.token().position.start`, an in-range offset, so behavior is preserved. Confirm via the guard specs.

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.facade.spec.ts
packages/core/src/features/tokens/model/TokenHandle.spec.ts
packages/core/src/features/selection/SelectionController.spec.ts
```

**Commit:** `refactor(tokens): placeCaret delegates the handle form to TokenHandle.placeCaret`

---

### Task T6: `TokenView.token` — read `handle.token()` instead of snapshotting

**Findings:** #16 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`
- Modify: `packages/core/src/features/tokens/boundary.ts`

**Change:** `TokenView.token` is written in `#view` then only ever re-validated through `#tokenOf`. Read the live handle directly:

1. In `TokenModel`, make `#tokenOf` read the handle:
```ts
	#tokenOf(view: TokenView): Token | undefined {
		return view.handle.alive() ? view.handle.token() : undefined
	}
```
2. Remove the `token` field from the literal `#view` builds:
```ts
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, ...bindings}
	}
```
3. In `boundary.ts`, drop `readonly token: Token` from the `TokenView` type and reword the `tokenOf` doc comment (it currently says "Views carry `handle.token()` by construction" — change to "reads the handle's live token"). Keep the `token: Token` import if still referenced (it is, by `BoundaryContext`).

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.facade.spec.ts
packages/core/src/features/tokens/TokenModel.spec.ts
```

**Commit:** `refactor(tokens): TokenView reads the live handle token; drop the snapshot field`

---

### Task T7: Drop the duplicated `SelectionSnapshot.collapsed` flag

**Findings:** #13 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.facade.spec.ts` (and any other spec asserting `selection().collapsed`)

**Change:** `SelectionSnapshot.collapsed` always equals `anchor.isCollapsed` (both `sel.isCollapsed`). Remove the top-level field.

1. In the `SelectionSnapshot` type, delete the `collapsed` member and its JSDoc; in `selection()` delete the `collapsed: sel.isCollapsed,` line.
2. In `SelectionController.#trackUserSelecting`, change the one reader:
```ts
		if (this.tokens.selection()?.anchor.isCollapsed !== false) this.isUserSelecting(false)
```
3. Update the JSDoc on `selection()` that enumerates `collapsed` among the fields. Rewrite spec assertions that read `selection().collapsed` to `selection().anchor.isCollapsed`.

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.facade.spec.ts
packages/core/src/features/selection/SelectionController.spec.ts
```

**Commit:** `refactor(tokens): drop SelectionSnapshot.collapsed (== anchor.isCollapsed)`

---

### Task T8: `TokenView` intersects `ElementBindings` instead of re-declaring its fields

**Findings:** #24 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/boundary.ts`

**Change:** `#view` already spreads `...bindings`, so pin the type to the bindings shape. Replace the four duplicated field lines:
```ts
import type {ElementBindings, TokenHandle} from './model/TokenHandle'
// ...
export type TokenView = ElementBindings & {
	readonly handle: TokenHandle
}
```
(If Task T6 already removed `token`, the intersection is just `ElementBindings & {handle}`. If T6 is somehow skipped, add `readonly token: Token` to the intersection.) Confirm the `ElementBindings` fields (`tokenElement` required; `textElement`/`rowElement`/`childSequenceHost` optional, all `readonly`) match what consumers read — they do.

**Guard specs:**
```
packages/core/src/features/tokens/TokenModel.facade.spec.ts
```
(plus `pnpm run typecheck` is the real gate here)

**Commit:** `refactor(tokens): TokenView intersects ElementBindings`

> **End of Phase 2 — run Step D (wide verify).**

---

# Phase 3 — commit / bind pipeline

### Task T9: `commitText` — one entry array instead of parallel `updates[]`+`patches[]`

**Findings:** #10 (medium)

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts`

**Change:** Fold the surface onto the update entry (set only for the text-kind path) and drop the `patches` array + its derived `content`. Replace the `commitText` body's two arrays and two loops:
```ts
	function commitText(changes: readonly TokenChangeEntry[], removedIds: readonly number[]): boolean {
		const updates: {handle: TokenHandle; token: Token; path: TokenPath; surface?: HTMLElement}[] = []
		for (const change of changes) {
			const handle = deps.nodes.get(change.id)
			if (change.kind === 'update') {
				if (!handle) continue
				updates.push({handle, token: change.token, path: change.path})
				continue
			}
			// kind 'text' on the text branch is always a TEXT token — resolve its surface.
			if (!handle) return false
			const surface = handle.node()?.textElement
			if (!surface) return false
			updates.push({handle, token: change.token, path: change.path, surface})
		}

		batch(() => {
			for (const {handle, token, path, surface} of updates) {
				handle.update(token, path)
				if (surface && surface.textContent !== token.content) surface.textContent = token.content
			}
		})
		if (VERIFY_DOM) assertAligned()
		lastRemovedIds = removedIds
		changed()
		return true
	}
```
(Each token id maps to a distinct surface, so per-entry interleaving equals the prior two-pass version; the surface miss still aborts before the first mutation.)

> Do NOT remove the `batch()` wrapper here — that is Task T10.

**Guard specs:**
```
packages/core/src/features/tokens/model/commit.spec.ts
packages/core/src/features/tokens/TokenModel.changed.spec.ts
```

**Commit:** `refactor(tokens): commitText uses one entry array with an optional surface`

---

### Task T10: Remove the inert empty-loop `batch()` wrappers — ⛔ ABANDONED (reverted `f3c4adbc`)

> **Outcome:** Attempted (`4b24245d`) then **reverted**. The wrappers are NOT inert: removing the `bind()` batch drops the first-mount `changed` announcement from 2→1 (`TokenModel.changed.spec.ts` "the first bind announces full"), bisected to `4b24245d`. The 2nd announcement drives SelectionController's caret re-placement on `rendered()` — an observable behavior change, so finding #21's "none observable" verdict was wrong. The batches are load-bearing for `changed`-event coalescing and stay. **Do not retry.**

**Findings:** #21 (low) — rejected on test evidence

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts`
- Modify: `packages/core/src/features/tokens/model/bind.ts`

**Change:** `TokenHandle` has provably zero reactivity, so these `batch()` calls wrap zero signal writes and defer nothing.

1. In `commit.ts` `commitText`, unwrap the `batch(() => { ... })` (run the loop directly) and delete the now-false comment about "one batch so subscribers flush against a consistent DOM". Remove the `batch` import if it becomes unused **in this file** (it does — `commitStructural`/`apply` don't use it).
2. In `bind.ts` `bind`, unwrap the outer `batch(() => { ... })` around the two loops — **keep both loops exactly as-is**, only the wrapper goes. Delete the "commits as ONE batch, so handle `changed` watchers flush" sentence from the doc comment (and the inline comment). Remove the now-unused `batch` import.

**Guard specs:**
```
packages/core/src/features/tokens/model/bind.spec.ts
packages/core/src/features/tokens/model/commit.spec.ts
packages/core/src/features/tokens/TokenModel.spec.ts
```

**Commit:** `refactor(tokens): drop inert batch() wrappers left from the reactive-handle era`

---

### Task T11: Trim three dead internal exports

**Findings:** #39 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/model/bind.ts`
- Modify: `packages/core/src/features/tokens/index.ts`
- Modify: `packages/core/src/features/tokens/parser.bench.ts`

**Change:** All internal (none reach the public package entry), so zero semver impact.
1. `bind.ts`: un-`export` `BindResult` (no importer) — keep it as a local type used by `bind`'s return; `BindInput` stays exported.
2. `tokens/index.ts`: remove the `Parser` re-export line and the `SelectionSnapshot` re-export from the barrel (no importer of either through the barrel; types remain at their declaration sites — `Parser` at `./parser/Parser`, `SelectionSnapshot` at `./model/TokenModel`).
3. `parser.bench.ts`: change its `Parser` import to come directly from `./parser/Parser` (since the barrel no longer re-exports it).

Run `grep -rn "from '.*tokens'" packages` first to confirm no in-repo consumer imports `Parser` or `SelectionSnapshot` *through the tokens barrel* before removing.

**Guard specs:**
```
packages/core/src/features/tokens/model/bind.spec.ts
```
(plus `pnpm run typecheck` and `pnpm -w exec vitest run packages/core/src/features/tokens/parser.bench.ts` to confirm the bench still resolves)

**Commit:** `chore(tokens): drop dead internal re-exports (BindResult, barrel Parser/SelectionSnapshot)`

> **End of Phase 3 — run Step D (wide verify).**

---

# Phase 4 — SelectionController

### Task T12: Inline the three single-use private placement wrappers

**Findings:** #17 (low)

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts`

**Change:** `#placeExtended`, `#applyPreferredHandle`, `#resolveHandle` are each called exactly once. Inline them, **preserving the ordering `#applyRange` depends on** (the `#preferredHandle` write must precede the `range()` write).

1. `#placeExtended` → inline into `#applyRange`: replace `this.#placeExtended(clamped)` with `this.tokens.selectRange(clamped.start, clamped.end)`. Delete `#placeExtended`.
2. `#resolveHandle` → fold into `placeAtHandle`:
```ts
	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		if (!handle.alive()) return false
		const position = handle.token().position
		const pos = boundary === 'end' ? position.end : position.start
		this.#preferredHandle = handle
		if (!this.range({start: pos, end: pos})) this.#applyRange()
		return true
	}
```
   Delete `#resolveHandle`.
3. `#applyPreferredHandle` → fold into `#placeCollapsed`:
```ts
	#placeCollapsed(rawPosition: number): boolean {
		const handle = this.#preferredHandle
		this.#preferredHandle = undefined
		if (handle?.alive() && this.tokens.placeCaret({handle, offset: rawPosition - handle.token().position.start}))
			return true
		return this.tokens.placeCaret(rawPosition)
	}
```
   Delete `#applyPreferredHandle`.

**Guard specs:**
```
packages/core/src/features/selection/SelectionController.spec.ts
```

**Commit:** `refactor(selection): inline three single-use placement wrappers`

---

### Task T13: Delete the write-only-in-production `position` computed

**Findings:** #14 (low)

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/edit/EditController.ts`
- Modify: `packages/core/src/features/selection/SelectionController.spec.ts`
- Modify: `packages/core/src/store/README.md` (if it documents `position`)

**Change:** `position`'s getter has no production reader; only its spec reads it. The sole production *writer* is `EditController`.
1. In `EditController.ts:~27`, replace `this.selection.position(caret)` (the write) with `this.selection.range({start: caret, end: caret})` (`caret` is always defined at that site).
2. Delete the `position` computed from `SelectionController`.
3. In `SelectionController.spec.ts`, delete the `position` `describe`/`it` block, and rewrite the ~8 test sites that use `position(n)` as a caret-set helper to `range({start: n, end: n})` and reads of `position()` to `range()?.start`.
4. Remove the `position` bullet from `store/README.md` if present.

Do **not** re-add `position` as a facade method (that would be a lateral rewrite).

**Guard specs:**
```
packages/core/src/features/selection/SelectionController.spec.ts
packages/core/src/features/edit/EditController.spec.ts
```
(run `pnpm -w exec vitest run packages/core/src/features/edit packages/core/src/features/selection` if a named EditController spec isn't present)

**Commit:** `refactor(selection): remove the unread position computed; EditController writes range`

> **End of Phase 4 — run Step D (wide verify).**

---

# Phase 5 — keyboard

### Task T14: Empty-row Backspace reuses `operations.deleteDragRow`

**Findings:** #6 (medium)

**Files:**
- Modify: `packages/core/src/features/block/operations.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`

**Change:** `blockEdit.handleDelete` inlines a byte-for-byte copy of the row-delete transform.
1. In `operations.ts`, `export` `deleteDragRow` and widen its param to `readonly Token[]` (it only reads; siblings already use `readonly Token[]`):
```ts
export function deleteDragRow(value: string, rows: readonly Token[], index: number): string {
```
2. In `blockEdit.handleDelete`, replace the inlined slice math that reproduces the delete transform with `deleteDragRow(value, rows, blockIndex)` (import it from `../block/operations` — `blockEdit` already imports from that module). **Keep the bespoke caret math inline** (it differs from `caretAfterDrag`'s delete branch — do not replace that).

**Guard specs:**
```
packages/core/src/features/keyboard/blockEdit.spec.ts
packages/core/src/features/block/operations.spec.ts
```
(fallback: `pnpm -w exec vitest run packages/core/src/features/keyboard packages/core/src/features/block`)

**Commit:** `refactor(keyboard): empty-row delete reuses operations.deleteDragRow`

---

### Task T15: Drop the dead `isBlock()` re-check and `shiftFocus`'s unused return

**Findings:** #26 (low), #37 (low)

**Files:**
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`

**Change:**
1. **#26** — `enableArrowNav` returns unconditionally at `if (store.props.layout.isBlock()) return` (line 10). The inner `if (store.props.layout.isBlock()) return` inside the Ctrl/Cmd+A branch (line 19) can never fire (nothing between mutates layout). Delete line 19.
2. **#37** — `shiftFocus` returns `boolean` that neither caller reads. Change its signature to `: void` and replace `return <expr>` exits with bare `return` (the final `return store.selection.placeAtHandle(...)` becomes `store.selection.placeAtHandle(...); return`). No call-site changes (`shiftFocus(store, e, 'prev')` already discards the value).

**Guard specs:**
```
packages/core/src/features/keyboard/arrowNav.spec.ts
```
(fallback: `pnpm -w exec vitest run packages/core/src/features/keyboard`)

**Commit:** `refactor(keyboard): drop dead isBlock re-check and shiftFocus's unused return`

---

### Task T16: `inputRange` returns `Range`; use DOM `StaticRange`

**Findings:** #32 (low), #35 (low)

**Files:**
- Modify: `packages/core/src/features/keyboard/inputRange.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`

**Change:**
1. **#35** — Delete the local `InputTargetRange` type and annotate the param that receives `event.getTargetRanges()` output as the standard DOM `StaticRange` (a field-superset of the four read fields; no cast needed).
2. **#32** — Change `rawRangeFromInputEvent` to return `Range | undefined` directly instead of wrapping it in `RawSelection`: the target branch returns `{start, end}`; the fallback returns `this.readRaw()?.range` (or the equivalent already in scope). Drop the `.range` hop at both call sites (`input.ts`, `blockEdit.ts`). The `direction` field was never consumed here. `RawSelection` stays the contract for real selection reads elsewhere.

Confirm with `pnpm run typecheck` that no other caller relied on the old wrapper shape.

**Guard specs:**
```
packages/core/src/features/keyboard/input.spec.ts
packages/core/src/features/keyboard/blockEdit.spec.ts
```
(fallback: `pnpm -w exec vitest run packages/core/src/features/keyboard`)

**Commit:** `refactor(keyboard): inputRange returns Range; use DOM StaticRange`

> **End of Phase 5 — run Step D (wide verify).**

---

# Phase 6 — overlay (breaking)

### Task T17: `OverlayController.choose(value, meta)`; delete `createMarkFromOverlay` and the `select` event indirection

**Findings:** #4 (medium, breaking), #5 (medium, breaking)

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Delete: `packages/core/src/features/overlay/createMarkFromOverlay.ts`
- Modify: `packages/core/src/features/overlay/index.ts`
- Modify: `packages/core/index.ts`
- Modify: `packages/react/markput/src/lib/hooks/useOverlay.tsx`
- Modify: `packages/vue/markput/src/lib/hooks/useOverlay.ts`
- Modify: `packages/core/src/features/overlay/OverlayController.spec.ts`
- Modify: `packages/website/...` (README/docs mention of `createMarkFromOverlay`, if any — grep)

**Change:** Today both adapters build a throwaway full `MarkToken` via `createMarkFromOverlay`, fire `overlay.select({mark, match})`, and a watcher re-derives `annotate(markup, {value, meta})`. Collapse the whole round-trip onto the state owner.

1. In `OverlayController`, add:
```ts
	/** Commit the active overlay match as an annotation of (value, meta), then close. */
	choose(value: string, meta?: string): void {
		const match = this.match()
		if (!match) return
		const markup = match.option.markup
		if (!markup) return
		this.edit.replace(match.range, annotate(markup, {value, meta}))
		this.match(undefined)
	}
```
2. Delete the `readonly select = event<{mark: Token; match: OverlayMatch}>()` field and the entire `watch(this.select, overlayEvent => { ... })` block in the constructor. Remove the now-unused `Token` import if nothing else needs it (the `slot`/`position` computeds don't; verify). `annotate` stays imported.
3. Delete `createMarkFromOverlay.ts`; remove its line from `overlay/index.ts`; remove `createMarkFromOverlay` from the `packages/core/index.ts` overlay export line (keep `filterSuggestions, navigateSuggestions`).
4. React `useOverlay.tsx`:
```ts
	const select = useCallback((value: {value: string; meta?: string}) => overlay.choose(value.value, value.meta), [overlay])
```
   Remove the `createMarkFromOverlay` import and the `match` dependency from `select`'s deps (it no longer reads `match`). `match` is still returned in the handler object, so keep the `useMarkput` read of it.
5. Vue `useOverlay.ts`:
```ts
	const select = (value: {value: string; meta?: string}) => store.overlay.choose(value.value, value.meta)
```
   Remove the `createMarkFromOverlay` import.
6. `OverlayController.spec.ts:140` calls `store.overlay.select({mark, match})`. Rewrite that test to drive `store.overlay.choose(value, meta)` and assert the same resulting `value.current()` / replacement. Remove any spec-local `createMarkFromOverlay` usage.

**Guard specs:**
```
packages/core/src/features/overlay/OverlayController.spec.ts
```
(plus storybook overlay flows: `pnpm -w exec vitest run packages/storybook/src/pages/Overlay` if present, and `pnpm run typecheck` across adapters)

**Commit:** `refactor(overlay)!: OverlayController.choose replaces the createMarkFromOverlay round-trip`

> **End of Phase 6 — run Step D (wide verify).**

---

# Phase 7 — parser

### Task T18: Delete the dead `Parser.hasSegments()`

**Findings:** #20 (medium)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/Parser.ts`

**Change:** `hasSegments` is net-new b0 surface with zero callers ("kept for Phase 7"; Phase 7 was detached). Grep `grep -rn "hasSegments" packages | grep -v dist` → confirm only the definition (and possibly its own spec). Delete the method + docstring (finding pins lines ~176-190) and any dedicated spec block.

**Guard specs:**
```
packages/core/src/features/tokens/parser/Parser.spec.ts
```

**Commit:** `chore(tokens): delete dead Parser.hasSegments (no caller)`

---

### Task T19: Remove the write-only `MarkupRegistry.markups` field

**Findings:** #41 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/core/MarkupRegistry.ts`

**Change:** Grep `grep -rn "\.markups" packages/core/src/features/tokens/parser` to confirm the field is never read. Delete the field declaration and the `this.markups = markups` assignment; the constructor already uses the `markups` parameter directly.

**Guard specs:**
```
packages/core/src/features/tokens/parser/Parser.spec.ts
```

**Commit:** `chore(tokens): drop write-only MarkupRegistry.markups field`

---

### Task T20: `SegmentMatcher.initializeDual` — drop unreachable guard, simplify comparator

**Findings:** #27 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/core/SegmentMatcher.ts`

**Change:** The `dynamics` array only holds non-string tuples, so the line-~102 string-branch guard is unreachable; the sort comparator's string branches are likewise dead. Delete the unreachable string guard and collapse the comparator to:
```ts
		entries.sort((a, b) => b.pattern.length - a.pattern.length)
```
(Coverage confirms the string branches are uncovered; `pattern.length` was always the effective key.) Minimal zero-risk subset if uncertain: delete only the unreachable line-102 guard.

**Guard specs:**
```
packages/core/src/features/tokens/parser/core/SegmentMatcher.spec.ts
packages/core/src/features/tokens/parser/Parser.spec.ts
```

**Commit:** `refactor(tokens): drop SegmentMatcher's unreachable string-branch guards`

---

### Task T21: Hoist the duplicated `getOrCreate<K,V>` helper

**Findings:** #29 (low)

**Files:**
- Create: `packages/core/src/features/tokens/parser/utils/getOrCreate.ts`
- Modify: `packages/core/src/features/tokens/parser/core/PatternMatcher.ts`
- Modify: `packages/core/src/features/tokens/parser/core/MarkupRegistry.ts`

**Change:** Both files define an identical private `getOrCreate`. Create one shared leaf util (one-function-per-file, matching `getSegmentIndex.ts`):
```ts
export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
	let value = map.get(key)
	if (value === undefined) {
		value = create()
		map.set(key, value)
	}
	return value
}
```
(Match the exact signature of the existing copies — verify the parameter order/names in `PatternMatcher.ts` before writing.) Import it in both files and delete both local definitions.

**Guard specs:**
```
packages/core/src/features/tokens/parser/Parser.spec.ts
packages/core/src/features/tokens/parser/core/SegmentMatcher.spec.ts
```

**Commit:** `refactor(tokens): hoist duplicated getOrCreate into parser/utils`

---

### Task T22: Trim the `Parser` convenience API + empty `ParseOptions` plumbing

**Findings:** #19 (low, internal — Parser is not in the public package entry)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/Parser.ts`
- Modify: `packages/core/src/features/tokens/parser/types.ts`
- Modify: `packages/core/src/features/tokens/parser/Parser.spec.ts`
- Modify: `packages/core/src/features/tokens/parser/README.md` (if it documents the removed API)

**Change:** Production uses only `new Parser(markups).parse(...)` (`TokenModel` + `denote`). First grep every removed member across all packages/specs to confirm no non-spec consumer:
`grep -rn "\.transform\|\.escape\|\.unescape\|\.stringify\|Parser.parse\|ParseOptions\|parseOptions" packages | grep -v dist`.
Then remove from `Parser`: the static `parse`/`stringify`, instance `transform`/`escape`/`unescape`/`stringify`, the `parseOptions` field, the constructor's `ParseOptions` param + spread. `Parser` reduces to `{ constructor(markups), parse }`. Delete the empty `ParseOptions` interface from `types.ts`. Trim the corresponding `Parser.spec.ts` blocks and the README mentions.

If any removed member turns out to have a non-spec consumer, **stop and reduce scope** to just the empty `ParseOptions` + `parseOptions` field (the zero-doc-impact subset).

**Guard specs:**
```
packages/core/src/features/tokens/parser/Parser.spec.ts
packages/core/src/features/tokens/parser/utils/denote.spec.ts
packages/core/src/features/tokens/parser/utils/annotate.spec.ts
```

**Commit:** `chore(tokens): trim unused Parser convenience API and empty ParseOptions`

> **End of Phase 7 — run Step D (wide verify).**

---

# Phase 8 — adapters (React/Vue parity)

### Task T23: Reduce `MarkInfo` to `{depth, hasNestedMarks}`; lift `toMarkInfo` into core

**Findings:** #3 (medium), #12 (low, breaking), #38 (low, breaking)

**Files:**
- Modify: `packages/core/src/shared/editorContracts.ts`
- Create: `packages/core/src/shared/toMarkInfo.ts` (or co-locate in `editorContracts.ts`, next to the `MarkInfo` type — `import type {Token}` is erased, so no runtime cycle)
- Modify: `packages/core/index.ts` (export `toMarkInfo`)
- Modify: `packages/react/markput/src/lib/hooks/useMarkInfo.tsx`
- Modify: `packages/vue/markput/src/lib/hooks/useMarkInfo.ts`
- Modify: `packages/storybook/src/pages/Nested/Nested.react.stories.tsx` (drop the `key:` line in the `InteractiveMark` debug `console.log`, ~line 165)
- Modify: `packages/website/src/content/docs/development/architecture.md` (~line 454), `packages/website/src/content/docs/guides/nested-marks.md`, `packages/website/src/content/docs/guides/dynamic-marks.md` (~line 100) — prose listing `id`/`path`/`key`/`address`

**Evidence (already gathered — re-confirm with grep before editing):**
`grep -rEn "(mark|info)\.(id|path|key)\b" packages | grep -v dist` → expect only the single `mark.key` debug line in `Nested.react.stories.tsx`. `id` and `path` have zero code reads anywhere; `depth`/`hasNestedMarks` are the only fields consumers use.

**Change:**
1. Reduce the `MarkInfo` interface in `editorContracts.ts` to exactly:
```ts
export type MarkInfo = {
	/** Nesting level: a top-level mark has depth 0. */
	readonly depth: number
	/** Whether this mark directly contains other marks. */
	readonly hasNestedMarks: boolean
}
```
   (Drop `id`, `path`, `key`.)
2. **#3** — Add a dep-free constructor next to the type. `path` is an INPUT (used to compute `depth`), not a returned field; with `id` gone there is no id guard to keep:
```ts
export function toMarkInfo(token: Token, path: TokenPath): MarkInfo {
	if (token.type !== 'mark') throw new Error('toMarkInfo: token is not a mark')
	return {
		depth: path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
	}
}
```
   (`Token` via `import type` from `../features/tokens`; `TokenPath` is local to `editorContracts.ts`.)
3. Export `toMarkInfo` from `packages/core/index.ts`.
4. React hook collapses to:
```tsx
export const useMarkInfo = (): MarkInfo => {
	const {token, path} = useTokenContext()
	return toMarkInfo(token, path)
}
```
   Optionally keep a hook-named context guard before the call (`if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')`) for a friendlier message — behavior-equivalent; no spec asserts the strings. Remove the old `token.id === undefined` guard (nothing reads id now).
5. Vue hook collapses identically (read `{token, path}` from `contextRef.value`, then `return toMarkInfo(token, path)`; drop the id guard).
6. In `Nested.react.stories.tsx`, delete the `key: mark.key,` line from the `console.log` object (lines ~162-166 keep `depth` and `hasNestedMarks`).
7. Update the website prose to list only `depth` and `hasNestedMarks` (and drop the stale `address`/`id`/`path`/`key` mentions). If the repo has an API-doc generation step (it does — see prior `docs(website): regenerate api` commits), regenerate the `api/interfaces/...`/`api/functions/useMarkInfo.md` rather than hand-editing the generated files.

**Guard specs:**
```
packages/storybook/src/pages/Nested/nested.react.spec.tsx
packages/storybook/src/pages/Nested/nested.vue.spec.ts
```
(`pnpm run typecheck` across all three packages is the main gate — it will flag any remaining `.id`/`.path`/`.key` read.)

**Commit:** `refactor(adapters)!: reduce MarkInfo to {depth, hasNestedMarks}; lift toMarkInfo into core`

---

### Task T24: Lift the `useMarkput` selector→snapshot loop into core `readSelected`

**Findings:** #8 (low)

**Files:**
- Create: `packages/core/src/shared/readSelected.ts` (or co-locate in an existing shared module)
- Modify: `packages/core/index.ts` (export `readSelected` + relocate `Selectable`/`ObjectSelector` types)
- Modify: `packages/react/markput/src/lib/hooks/useMarkput.ts`
- Modify: `packages/vue/markput/src/lib/hooks/useMarkput.ts`

**Change:** Both adapters duplicate the identical read logic (typeof-function fast path + `for-in` object spread with `isReactive` check) and the `Selectable`/`ObjectSelector` types.
1. Move the read logic into core as `readSelected(target): unknown` (uses `isReactive` + `SignalValues`, both already in core). Move `Selectable`/`ObjectSelector` types **structurally unchanged** so the published `.d.ts` is identical. Export from `packages/core/index.ts`.
2. React: `const derived = computed(() => readSelected(target))` — keep the `useSyncExternalStore` bridge.
3. Vue: `const getValue = () => readSelected(target)` — keep the `effect`/`shallowRef` bridge.
Each adapter keeps only its genuinely framework-specific reactive bridge. Preserve the exported `useMarkput` signature (it is re-exported from both adapter barrels).

**Guard specs:** (the render-count specs exercise selector behavior)
```
packages/storybook/src/pages/renderCount.react.spec.tsx
packages/storybook/src/pages/renderCount.vue.spec.ts
```

**Commit:** `refactor(adapters): lift the useMarkput read loop into core readSelected`

---

### Task T25: `useMark` drops `readOnly` from deps; dedupe React Block/DropIndicator selectors

**Findings:** #23 (low), #28 (low)

**Files:**
- Modify: `packages/react/markput/src/lib/hooks/useMark.tsx`
- Modify: `packages/react/markput/src/components/DropIndicator.tsx`
- Modify: `packages/react/markput/src/components/Block.tsx`

**Change:**
1. **#23** — In `useMark.tsx`, drop `readOnly` from the `useMemo` dep array: `useMemo(() => CoreMarkController.fromToken(store, token), [store, token])`. **Keep** the `useMarkput(s => s.props.readOnly)` subscription line (it drives the re-render; `MarkController` reads `readOnly` lazily, so the retained controller is behaviorally identical).
2. **#28 / DropIndicator** — Collapse the two `useMarkput` calls into one object selector (`tokens` is non-reactive, so the merged selector subscribes to exactly the same single `dropPosition` signal):
```tsx
	const {dropPosition, tokens} = useMarkput(s => ({dropPosition: s.block.get(token).state.dropPosition, tokens: s.tokens}))
```
3. **#28 / Block** — Bind `const blockStore = s.block.get(token)` once inside a function-body selector and read `isDragging` off it (matching its `BlockMenu`/`DragHandle` siblings) instead of calling `s.block.get(token)` twice:
```tsx
	const {blockStore, action, Component, slotProps, isDragging} = useMarkput(s => {
		const blockStore = s.block.get(token)
		return {blockStore, action: s.block.action, Component: s.slots.blockComponent, slotProps: s.slots.blockProps, isDragging: blockStore.state.isDragging}
	})
```
   (Adjust the destructured field names to match the current `Block.tsx` selector — verify before editing.)

**Guard specs:**
```
packages/storybook/src/pages/renderCount.react.spec.tsx
```

**Commit:** `refactor(react): drop needless MarkController rebuild; dedupe Block/DropIndicator selectors`

---

### Task T26: Vue drag-row components use `computed()` for the control ref

**Findings:** #22 (low)

**Files:**
- Modify: `packages/vue/markput/src/components/BlockMenu.vue`
- Modify: `packages/vue/markput/src/components/DragHandle.vue`
- Modify: `packages/vue/markput/src/components/DropIndicator.vue`

**Change:** Replace the hand-rolled lazy memo `let x; const get = () => { x ??= store.tokens.control([props.blockIndex]); return x }` with idiomatic Vue:
```ts
const controlRef = computed(() => store.tokens.control([props.blockIndex]))
```
Bind via `:ref="controlRef.value"` (DropIndicator, direct) or call `controlRef.value(el)` inside the existing `setPanelRef`/`setMenuRef` wrapper (DragHandle/BlockMenu). Add the `computed` import to `BlockMenu.vue` and `DropIndicator.vue` (`DragHandle.vue` already imports it). This is a **pure structural simplification, not a bug fix** — a control registration's `ownerPath` is never read in core, so the prior stale-`blockIndex` was harmless; `control()` is index-tagged so a fresh registration on `blockIndex` change is correct.

**Guard specs:** (Vue block/drag storybook flows)
```
packages/storybook/src/pages/renderCount.vue.spec.ts
```
(plus the Vue block/drag browser spec if present; `pnpm run typecheck` for the Vue package)

**Commit:** `refactor(vue): express the drag-row control ref with computed()`

---

### Task T27: Extract the Vue `$el` unwrap helper

**Findings:** #42 (low — borderline; include for the two existing copies)

**Files:**
- Create: `packages/vue/markput/src/lib/unwrapEl.ts`
- Modify: `packages/vue/markput/src/components/Container.vue`
- Modify: `packages/vue/markput/src/components/Block.vue`

**Change:** Both ref callbacks duplicate the null-safe component-instance `$el` unwrap. Extract:
```ts
export const unwrapEl = (el: unknown): HTMLElement | null => {
	const ref = el as {$el?: HTMLElement} | HTMLElement | null
	return (ref && '$el' in ref ? ref.$el : ref) as HTMLElement | null
}
```
Both callbacks become `const element = unwrapEl(el)` followed by their distinct store call (`store.host.container(element)` / `blockStore.attachContainer(...)`). Match the exact unwrap expression currently in the two files before extracting.

**Guard specs:** (`pnpm run typecheck` for Vue + the Vue base storybook spec)
```
packages/storybook/src/pages/Base/Base.vue.spec.ts
```

**Commit:** `refactor(vue): extract the shared $el unwrap helper`

> **End of Phase 8 — run Step D (wide verify).**

---

# Phase 9 — dead exports, barrels, misc

### Task T28: Drop the consumer-less public re-exports `DragAction` / `DragActions` / `RawSelection`

**Findings:** #11 (low, breaking)

**Files:**
- Modify: `packages/core/index.ts`
- Modify: `packages/website/src/content/docs/development/architecture.md` (stale public-type row, ~line 223)

**Change:** Grep `grep -rn "DragAction\b\|DragActions\b\|RawSelection\b" packages --include="*.ts" --include="*.tsx" --include="*.vue" | grep -v dist | grep -v "/src/"` to confirm no adapter/app/storybook/website import. Then remove `DragAction`, `DragActions` from the `index.ts` type re-export block, and remove `RawSelection` from wherever it is re-exported in `index.ts` (the underlying type definitions in `shared/types.ts` / `shared/editorContracts.ts` stay — they are used internally). Update the architecture doc's public-types row.

**Guard specs:** (`pnpm run typecheck` + `pnpm run build` across packages — this is an export-surface change)

**Commit:** `chore(core)!: drop consumer-less public re-exports DragAction/DragActions/RawSelection`

---

### Task T29: Drop the unconsumed signal-primitive barrel re-exports (`untracked`, `trigger`)

**Findings:** #43 (low, breaking-ish — vendored signals lib API)

**Files:**
- Modify: `packages/core/src/shared/classes/index.ts`
- Modify: `packages/core/src/shared/signals/index.ts`

**Change:** Two-file edit (the original single-file proposal would break the build):
1. In `classes/index.ts`, delete the two `../signals` re-export lines, leaving only `export {KeyGenerator} from './KeyGenerator'`. (Confirm: `Store.ts` imports only `KeyGenerator` from this barrel.)
2. In `signals/index.ts`, drop `trigger` from the export list. To also drop `untracked`, you MUST remove it from BOTH `signals/index.ts:~10` AND the `classes/index.ts` re-export (step 1 already removes the classes copy) — otherwise the classes barrel breaks typecheck. The symbols stay **defined** inside the signals module; they just leave the surfaced barrels.

Grep `grep -rn "untracked\|trigger" packages/core/src | grep -v dist | grep -v "signals/"` first to confirm only `ValueModel`'s internal `untracked` use (which imports from `../../shared/signals/index.js` directly, not the barrel — verify) remains.

**Guard specs:** (`pnpm run typecheck` + `pnpm -w exec vitest run packages/core/src/features/state/ValueModel.spec.ts`)

**Commit:** `chore(core): drop unconsumed signal-primitive barrel re-exports`

---

### Task T30: Inline single-consumer slot indirection

**Findings:** #30 (low)

**Files:**
- Modify: `packages/core/src/features/slots/index.ts`
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Delete: `packages/core/src/features/slots/resolveOptionSlot.ts`
- Modify: `packages/core/src/features/slots/resolveSlot.ts`
- Modify: `packages/core/src/features/slots/README.md`

**Change:**
1. `resolveOverlaySlot` barrel hop: import it directly from `'../slots/resolveSlot'` in `OverlayController.ts` and drop it from the `slots/index.ts` barrel (matching the in-module convention).
2. `resolveOptionSlot.ts` (6 lines, one caller): move its function body into `resolveSlot.ts` (its sole consumer, lines ~4/47/64), drop the import, delete the file. Remove or fold its bullet in `slots/README.md`.

**Guard specs:**
```
packages/core/src/features/slots/resolveSlot.spec.ts
```
(fallback: `pnpm -w exec vitest run packages/core/src/features/slots packages/core/src/features/overlay`)

**Commit:** `refactor(slots): inline single-consumer resolveOptionSlot and resolveOverlaySlot hop`

---

### Task T31: Relocate `dragUtils`/`menuUtils` from `shared/` into their block owner

**Findings:** #31 (low)

**Files:**
- Delete: `packages/core/src/shared/utils/dragUtils.ts`
- Delete: `packages/core/src/shared/utils/menuUtils.ts`
- Modify: `packages/core/src/features/block/BlockStore.ts`

**Change:** Both files live under `shared/utils/` but `BlockStore.ts` is the only consumer. Inline the five trivial pure functions into `BlockStore.ts` (consistent with `BlockStore` already inlining equivalent containment logic at `#onContainerDragLeave`), preserving their doc comments, and delete the two files + the two imports. Keep it a pure structural commit (no behavior change).
- First grep `grep -rn "dragUtils\|menuUtils\|isClickOutside\|isEscapeKey" packages | grep -v dist` to confirm `BlockStore` is the sole importer and that the function names don't collide with existing locals in `BlockStore.ts`.

**Guard specs:**
```
packages/core/src/features/block/BlockStore.spec.ts
```
(fallback: `pnpm -w exec vitest run packages/core/src/features/block`)

**Commit:** `refactor(block): inline block-only drag/menu utils into BlockStore`

---

### Task T32: Delete `addDragRow`'s unreachable empty-rows guard

**Findings:** #25 (low)

**Files:**
- Modify: `packages/core/src/features/block/operations.ts`

**Change:** Both callers guarantee `rows.length >= 1` (`applyDragAction` substitutes `[EMPTY_TEXT_TOKEN]` for the `add` action; `blockEdit` reaches `addDragRow` only after `findActiveRow`). Delete the dead first line of `addDragRow`:
```ts
	if (rows.length === 0) return value + newRowContent
```
Keep the load-bearing `EMPTY_TEXT_TOKEN` substitution in `applyDragAction`.

**Guard specs:**
```
packages/core/src/features/block/operations.spec.ts
```

**Commit:** `chore(block): drop addDragRow's unreachable empty-rows guard`

---

### Task T33: `textOffsets` reuses the shared `nextText` walker

**Findings:** #33 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/textOffsets.ts`
- Modify: `packages/core/src/shared/checkers/domGuards.ts` (only if `nextText` needs exporting)

**Change:** `textOffsets.ts` defines a private `nextTextNode` using the fragile `instanceof Text` form; `caret.ts` already uses a shared `nextText` (the more robust `nodeType === 3` form). Confirm `nextText` is exported from its module (`grep -rn "nextText" packages/core/src/shared`), then delete the private `nextTextNode`, import the shared `nextText`, and replace its 4 call sites. Production behavior identical; strictly more robust in test envs.

**Guard specs:**
```
packages/core/src/features/tokens/caret.spec.ts
packages/core/src/features/tokens/TokenModel.facade.spec.ts
```
(plus any `textOffsets` spec: `pnpm -w exec vitest run packages/core/src/features/tokens`)

**Commit:** `refactor(tokens): textOffsets reuses the shared nextText walker`

---

### Task T34: `getCaretIndex` direct returns; un-export `setAtElement` + delete its dead finite-offset path

**Findings:** #36 (low), #44 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/caret.ts`
- Modify: `packages/core/src/features/tokens/caret.spec.ts`

**Change:**
1. **#36** — Collapse `getCaretIndex`'s write-once `position` accumulator to direct returns:
```ts
export function getCaretIndex(element: HTMLElement): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return 0
	const range = selection.getRangeAt(0)
	const preCaretRange = range.cloneRange()
	preCaretRange.selectNodeContents(element)
	preCaretRange.setEnd(range.endContainer, range.endOffset)
	return preCaretRange.toString().length
}
```
   (Match the existing variable/scope names; verify the current body before replacing.)
2. **#44** — `setAtElement`'s sole production caller is `setAtX`, which always passes `Infinity`; the finite-offset walking path is production-dead, and the symbol is exported only for its own spec (`caret.spec.ts` does `import * as caretDom from './caret'`). Un-`export` `setAtElement` (make it module-private; `setAtX` is in the same file). **In the same commit**, delete or fold the `caret.spec.ts` block that imports it via `caretDom.setAtElement` into `setAtX` testing (un-exporting without this breaks the build). Prefer deleting the dead finite-offset path entirely. Clean up any stale README line listing `setAtElement`/`caretDom`.

**Guard specs:**
```
packages/core/src/features/tokens/caret.spec.ts
```

**Commit:** `refactor(tokens): simplify getCaretIndex; un-export dead setAtElement path`

---

### Task T35: `findGap` — drop the dead `Gap` export and speculative default params

**Findings:** #40 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/utils/findGap.ts`

**Change:** The sole caller (`tokenIdentity.hintFromValues`) and all tests already pass two strings. Drop the `= ''` defaults so the signature is `(previous: string, current: string)`, and un-`export` the `Gap` type (keep it as a local return type). No call-site changes needed.

**Guard specs:**
```
packages/core/src/features/tokens/utils/findGap.spec.ts
packages/core/src/features/tokens/tokenIdentity.spec.ts
```

**Commit:** `chore(tokens): drop findGap's dead Gap export and default params`

---

### Task T36: Fix stale docs / naming residue

**Findings:** #45 (low)

**Files:**
- Modify: `packages/core/src/features/tokens/caret.ts`
- Modify: `packages/core/src/features/tokens/parser/constants.ts`
- Modify: `packages/core/src/features/tokens/parser/utils/toString.ts`
- Modify: `packages/core/src/features/tokens/parser/utils/annotate.ts`

**Change:** Comments only — no code change.
1. `caret.ts` `findTextBoundary` doc: replace the `CaretModel` reference with the real callers — "Used by `placeAtTextOffset` / `placeRangeAcrossSurfaces` — needs the empty-Text fallback so freshly-mounted empty surfaces still accept a caret."
2. `parser/constants.ts`: drop the "legacy Parser" framing and the dangling `../Parser/constants.ts` cross-reference; describe the Value/Meta/Slot placeholder tokens the parser recognizes.
3. Replace residual `ParserV2` mentions with the real class name `Parser` in `constants.ts`, `toString.ts` (~lines 8/10/16), and `annotate.ts` (~line 5).

**Guard specs:** (docs-only — `pnpm run typecheck` + `pnpm run lint:check` suffice; no behavior to test)

**Commit:** `docs(tokens): fix stale CaretModel/legacy-Parser/ParserV2 references`

> **End of Phase 9 — run Step D (wide verify), then run the full gate once more: `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`.**

---

## Coverage map (all 45 findings → tasks)

| Finding | Task | Finding | Task | Finding | Task |
|--------|------|--------|------|--------|------|
| #1 | T1 | #16 | T6 | #31 | T31 |
| #2 | T4 | #17 | T12 | #32 | T16 |
| #3 | T23 | #18 | T5 | #33 | T33 |
| #4 | T17 | #19 | T22 | #34 | T2 |
| #5 | T17 | #20 | T18 | #35 | T16 |
| #6 | T14 | #21 | T10 | #36 | T34 |
| #7 | T4 | #22 | T26 | #37 | T15 |
| #8 | T24 | #23 | T25 | #38 | T23 |
| #9 | T2 | #24 | T8 | #39 | T11 |
| #10 | T9 | #25 | T32 | #40 | T35 |
| #11 | T28 | #26 | T15 | #41 | T19 |
| #12 | T23 | #27 | T20 | #42 | T27 |
| #13 | T7 | #28 | T25 | #43 | T29 |
| #14 | T13 | #29 | T21 | #44 | T34 |
| #15 | T3 | #30 | T30 | #45 | T36 |

## Self-review notes (for the executor)

- **Sequencing dependencies:** T1→T2→T3 (same file); T4 before/with T7-related spec edits; T9 before T10 (T10 removes the `batch` T9 still uses). T23 folds #3 + #12 + #38 into one contract change (`MarkInfo` → `{depth, hasNestedMarks}`). Within a phase, tasks are otherwise independent.
- **Grep-before-delete is mandatory** on every dead-code/un-export task (T11, T18, T19, T22, T23, T28, T29, T31, T32, T33, T35) — the task names the grep; run it and paste evidence into the commit body if anything is non-obvious.
- **One finding flagged "confirm intent" in review remains:** #43 (signals barrel) is included per the "breaking changes approved" decision but is part of the vendored signals lib's documented API — if you want to preserve that lib's surface verbatim, skip T29 (it is the only fully-optional task). (#38 was the other; it is now actioned in T23 after verifying `id`/`path` have zero consumers.)
- **One review finding was unverified** (the `parity: adapter index barrels re-export` verifier overflowed its output budget) and is intentionally NOT in this plan. If you want the last 1%, manually diff the React/Vue `src/index.ts` barrels for re-exports with no external consumer and add a follow-up task.
