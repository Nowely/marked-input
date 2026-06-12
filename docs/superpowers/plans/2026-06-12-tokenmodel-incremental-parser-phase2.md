# TokenModel Incremental Parser (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement Phase 2 of `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md` — stable token identity across reparses with a per-commit **changeset** (`{textChanged, added, removed, shifted}` | `full`), handles re-keyed from path to id, and a windowed incremental reparse for the typing hot path. This unblocks Phase 3 (fine-grained commit: changeset routing decides whether the renderer runs).

**Architecture:** The parser stays pure and untouched in its core (`parse(value): Token[]`, fresh objects, absolute positions). A new **identity layer** (`tokenIdentity.ts`) sits between the parse and `TokenModel.current`: it matches the fresh tree against the previous one (helped by an **edit hint** threaded from `EditController.replace` through `ValueModel`), reuses previous token *objects* where structurally identical (prefix `===` reuse), carries ids onto shifted-but-same tokens, and emits the changeset. Ids live in a `WeakMap<Token, number>` owned by the identity layer — the `Token` type and every parser spec fixture stay byte-identical. A separate, optional-fallback **windowed reparse** makes the hot path cheaper; the equivalence property test is the gate that lets it exist.

**Tech Stack:** TypeScript, custom signals, vitest in real Chromium (`pnpm -F core test`), `@faker-js/faker` (already a dev dep, already seeded in Parser.spec.ts) for the randomized equivalence property.

**Key facts from the landed codebase (verified during planning):**
- Edit range is known ONLY in `EditController.replace` (`features/edit/EditController.ts:17-29`); `ValueModel.replace` (`features/state/ValueModel.ts:26-32`) drops it; `TokenModel.current` (`features/tokens/TokenModel.ts:40-47`) is a computed that full-parses on every value change.
- `EditController.replace` is the single production write path to `value.current` — but `value.current(...)` can also be set directly (e.g. specs, `defaultValue` init), so the hint must be **consume-once** and absence must mean "full parse".
- Tokens are fresh objects each parse; `MarkupDescriptor` is already interned per Parser instance (`parser/core/MarkupRegistry.ts`) — descriptor equality is reference equality, cheap to compare.
- `preparsing/utils/findGap.ts` already computes the divergence range between two strings — the fallback hint when no edit range was recorded.
- Handles are path-keyed (`TokenModel.#handles`, `#ensureHandle` at `TokenModel.ts:171-179`, `#syncHandles` at `:377-389`).
- `filterEmptyText` runs AFTER parse in block mode (`TokenModel.ts:439-443`) — identity matching must run on the FILTERED tree (the tree handles/index actually see).
- Benchmarks: `parser.bench.ts` with `parser.bench.result.json` history (50 runs, >5% regression threshold).

**Follow-ups absorbed from the Phase 1 final review:** Task 1 (TriggerFinder hardening), Task 6's conditional extraction note, guard already hardened in `fe64a004`.

**Conventions:** repo root `/Users/ruliny/Git/marked-input`; test all `pnpm -F core test`; filtered `pnpm -w exec vitest run --project core <fragment>`; typecheck `pnpm -F core typecheck`; guard `pnpm run check:encapsulation`. Style: tabs, single quotes, no semicolons, `import type`, no trailing newline. Lint-staged runs on commit. One task per commit unless stated.

---

### Task 1: TriggerFinder hardening (Phase 1 follow-up)

**Files:**
- Modify: `packages/core/src/features/overlay/TriggerFinder.ts`
- Modify: `packages/core/src/features/overlay/TriggerFinder.spec.ts`

- [x] **Step 1: Make `tokens` required**

`TriggerFinder`'s `tokens?: TokenModel` optionality (and the index-based pseudo-range branch in `#rawRangeForMatch`) exists only for direct-construction unit tests. Change the constructor to `(private readonly tokens: TokenModel, anchor?: SelectionAnchor)` and `static find<T>(options, getTrigger, tokens: TokenModel, anchor?: SelectionAnchor)`. Delete the `if (!this.tokens) return {start: index, end: index + source.length}` branch in `#rawRangeForMatch`.

- [x] **Step 2: Mount a Store in the spec**

`TriggerFinder.spec.ts` constructs `new TriggerFinder(undefined, anchorIn(...))` in ~25 tests. Add a tiny mount helper (copy the `mountInline` pattern from `packages/core/src/features/tokens/TokenHandle.spec.ts` — Store + container + span + `host.rendered()`), build one store per test file scope (or per test — match the file's existing structure), and pass `store.tokens` as the first arg. The `anchorIn(text, offset)` helper stays — anchors remain explicit. Tests asserting the pseudo-range fallback behavior: re-point them at the real `boundaryFor`-based range using anchors created INSIDE the mounted container (so `boundaryFor` resolves), or — where a test's whole point was the tokens-less fallback — delete the test and note it in the commit message (the branch no longer exists). Do not weaken any other assertion. The "throws when no anchor node" test: `new TriggerFinder(store.tokens)` with no selection still throws (selectionAnchor() returns undefined) — verify.

- [x] **Step 3: Gates + commit**

Run: `pnpm -w exec vitest run --project core TriggerFinder` then `pnpm -F core test` — green.

```bash
git add -A packages/core
git commit -m "refactor(overlay): TriggerFinder requires TokenModel, spec mounts a real store"
```

---

### Task 2: Changeset + identity module (TDD)

The heart of Phase 2. Pure module, no DOM, fully unit-testable.

**Files:**
- Create: `packages/core/src/features/tokens/tokenIdentity.ts`
- Create: `packages/core/src/features/tokens/tokenIdentity.spec.ts`

- [x] **Step 1: Write the failing spec**

Create `tokenIdentity.spec.ts`. Use the real `Parser` (`./parser/Parser`) with markup `'@[__value__]'` to produce trees — no hand-built token mocks. Scenarios:

```ts
import {describe, expect, it} from 'vitest'

import {Parser} from './parser/Parser'
import {createIdentityTracker} from './tokenIdentity'

const parser = new Parser(['@[__value__]'])

describe('tokenIdentity', () => {
	it('first reconcile assigns fresh ids and reports full', () => {
		const tracker = createIdentityTracker()
		const next = parser.parse('he@[x]llo')
		const result = tracker.reconcile(next, undefined)
		expect(result.changeset).toEqual({kind: 'full'})
		expect(result.tokens).toHaveLength(3)
		const ids = result.tokens.map(t => tracker.idOf(t))
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
	})

	it('pure text edit: prefix reused by reference, edited token textChanged, suffix shifted with stable ids', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const [text1, mark, text2] = first
		const idText2 = tracker.idOf(text2)

		// insert 'A' inside the trailing text: 'he@[x]lAlo', edit at offset 7
		const result = tracker.reconcile(parser.parse('he@[x]lAlo'), {start: 7, end: 7, insertedLength: 1})

		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		// prefix: identical region reused by REFERENCE
		expect(result.tokens[0]).toBe(text1)
		expect(result.tokens[1]).toBe(mark)
		// edited token: new object, SAME id, listed in textChanged
		expect(result.tokens[2]).not.toBe(text2)
		expect(tracker.idOf(result.tokens[2])).toBe(idText2)
		expect(result.changeset.textChanged).toEqual([idText2])
		expect(result.changeset.added).toEqual([])
		expect(result.changeset.removed).toEqual([])
	})

	it('suffix shift: edit before a mark keeps the mark id and reports shifted', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])
		const tailId = tracker.idOf(first[2])

		// insert at offset 1 inside 'he' → mark and tail shift right by 1
		const result = tracker.reconcile(parser.parse('hAe@[x]llo'), {start: 1, end: 1, insertedLength: 1})
		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		expect(tracker.idOf(result.tokens[2])).toBe(tailId)
		expect(result.changeset.shifted).toContain(markId)
		expect(result.changeset.shifted).toContain(tailId)
		// shifted tokens are NEW objects (positions differ) with identical content
		expect(result.tokens[1]).not.toBe(first[1])
		expect(result.tokens[1].content).toBe(first[1].content)
	})

	it('structural change: deleting a mark reports removed + textChanged/merge, no id reuse for the gone mark', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])

		// delete the mark entirely: 'hello' (positions 2..6 removed)
		const result = tracker.reconcile(parser.parse('hello'), {start: 2, end: 6, insertedLength: 0})
		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		expect(result.changeset.removed).toContain(markId)
		expect(result.tokens.some(t => tracker.idOf(t) === markId)).toBe(false)
	})

	it('no hint falls back to full changeset but still matches identity via findGap', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])
		const result = tracker.reconcile(parser.parse('he@[x]llo!'), undefined)
		// without a hint the changeset must be conservative…
		expect(result.changeset.kind === 'full' || result.changeset.kind === 'delta').toBe(true)
		// …but identity should still survive for the untouched prefix (findGap fallback)
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
	})

	it('nested children: ids stable for children of an unchanged mark', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(slotParser.parse('#[ab]tail'), undefined).tokens
		const mark = first[0]
		if (mark.type !== 'mark') throw new Error('expected mark')
		const childId = tracker.idOf(mark.children[0])

		const result = tracker.reconcile(slotParser.parse('#[ab]tailX'), {start: 9, end: 9, insertedLength: 1})
		const mark2 = result.tokens[0]
		if (mark2.type !== 'mark') throw new Error('expected mark')
		expect(mark2).toBe(mark) // untouched prefix mark reused by reference
		expect(tracker.idOf(mark2.children[0])).toBe(childId)
	})
})
```

NOTE for the implementer: the fixture values above assume parser output shapes (`'he@[x]llo'` → text[0,2] mark[2,6] text[6,9] — pinned during Phase 1) and that `'#[__slot__]'` produces a mark with one text child. PIN every fixture against real parser output first (temporary failing assertion printing `tokens.map(t => [t.type, t.position, 'children' in t ? t.children.length : 0])`), and adjust offsets/expectations to reality. The CONTRACT under test (reference-reuse, id stability, changeset fields) must not be weakened.

- [x] **Step 2: Run to verify failure**

`pnpm -w exec vitest run --project core tokenIdentity` → FAIL (`createIdentityTracker` not found).

- [x] **Step 3: Implement `tokenIdentity.ts`**

```ts
import {findGap} from './preparsing'
import type {Token} from './parser/types'

export type EditHint = {
	/** Replaced range in the PREVIOUS value. */
	readonly start: number
	readonly end: number
	readonly insertedLength: number
}

export type Changeset =
	| {kind: 'full'}
	| {
			kind: 'delta'
			textChanged: number[]
			added: number[]
			removed: number[]
			shifted: number[]
	  }

export type ReconcileResult = {
	tokens: Token[]
	changeset: Changeset
}

export type IdentityTracker = {
	/**
	 * Match `next` against the previously reconciled tree. Reuses previous token
	 * objects by reference where the token (and its subtree) is byte-identical
	 * including position; carries the previous id onto tokens that are identical
	 * except for a uniform position shift. Everything else gets a fresh id.
	 * `hint` is the edit range in the previous value; when absent it is derived
	 * with findGap from the values, and the changeset degrades to `full` only
	 * when no previous tree exists or derivation is impossible.
	 */
	reconcile(next: Token[], hint: EditHint | undefined, previousValue?: string, nextValue?: string): ReconcileResult
	/** Stable id of a token from the last reconciled tree (or any reused ancestor). */
	idOf(token: Token): number
}

export function createIdentityTracker(): IdentityTracker {
	const ids = new WeakMap<Token, number>()
	let nextId = 1
	let previous: Token[] | undefined

	const ensureId = (token: Token): number => {
		let id = ids.get(token)
		if (id === undefined) {
			id = nextId++
			ids.set(token, id)
		}
		if (token.type === 'mark') token.children.forEach(ensureId)
		return id
	}

	const inherit = (from: Token, to: Token): void => {
		const id = ids.get(from)
		if (id !== undefined) ids.set(to, id)
		if (from.type === 'mark' && to.type === 'mark') {
			const len = Math.min(from.children.length, to.children.length)
			for (let i = 0; i < len; i++) inherit(from.children[i], to.children[i])
			to.children.forEach(ensureId)
		}
	}

	return {
		idOf: token => ensureId(token),

		reconcile(next, hint, previousValue, nextValue) {
			const prev = previous

			if (!prev) {
				next.forEach(ensureId)
				previous = next
				return {tokens: next, changeset: {kind: 'full'}}
			}

			const window = hint ?? hintFromValues(previousValue, nextValue)
			if (!window) {
				// No way to bound the edit: fresh ids except best-effort structural
				// prefix/suffix matching below still applies with a zero-width
				// window at position 0 → degenerates to suffix matching only.
				next.forEach(ensureId)
				previous = next
				return {tokens: next, changeset: {kind: 'full'}}
			}

			const shiftDelta = window.insertedLength - (window.end - window.start)
			const out: Token[] = next.slice()
			const textChanged: number[] = []
			const added: number[] = []
			const shifted: number[] = []
			const matchedPrev = new Set<Token>()

			// 1. Prefix: tokens entirely before the edit window are identical incl.
			//    position → reuse the previous OBJECT.
			let p = 0
			while (
				p < prev.length &&
				p < next.length &&
				prev[p].position.end <= window.start &&
				tokensEqual(prev[p], next[p])
			) {
				out[p] = prev[p]
				matchedPrev.add(prev[p])
				p++
			}

			// 2. Suffix: walk from the ends; a previous token entirely after the edit
			//    window matches a next token when shifting its positions by
			//    shiftDelta makes them identical → new object, inherited id.
			let prevTail = prev.length - 1
			let nextTail = next.length - 1
			while (
				prevTail >= p &&
				nextTail >= p &&
				prev[prevTail].position.start >= window.end &&
				tokensEqualShifted(prev[prevTail], next[nextTail], shiftDelta)
			) {
				inherit(prev[prevTail], next[nextTail])
				matchedPrev.add(prev[prevTail])
				if (shiftDelta !== 0) shifted.push(ensureId(next[nextTail]))
				else out[nextTail] = prev[prevTail]
				prevTail--
				nextTail--
			}

			// 3. Middle: same-index pairing for the残 window region — a token at the
			//    same tree slot with the same type+descriptor keeps its id and is
			//    reported as textChanged; everything else is added.
			for (let i = p; i <= nextTail; i++) {
				const candidate = prev[i]
				if (
					candidate &&
					i <= prevTail &&
					!matchedPrev.has(candidate) &&
					candidate.type === next[i].type &&
					sameDescriptor(candidate, next[i])
				) {
					inherit(candidate, next[i])
					matchedPrev.add(candidate)
					textChanged.push(ensureId(next[i]))
				} else {
					added.push(ensureId(next[i]))
				}
			}

			const removed = prev.filter(t => !matchedPrev.has(t)).map(t => ensureId(t))

			next.forEach(ensureId)
			previous = out
			return {
				tokens: out,
				changeset: {kind: 'delta', textChanged, added, removed, shifted},
			}
		},
	}

	function hintFromValues(previousValue?: string, nextValue?: string): EditHint | undefined {
		if (previousValue === undefined || nextValue === undefined) return undefined
		const gap = findGap(previousValue, nextValue)
		if (gap.left === undefined || gap.right === undefined) return undefined
		const start = gap.left
		const endInPrev = previousValue.length - gap.right
		const endInNext = nextValue.length - gap.right
		return {start, end: endInPrev, insertedLength: endInNext - start}
	}
}

function tokensEqual(a: Token, b: Token): boolean {
	return tokensEqualShifted(a, b, 0)
}

function tokensEqualShifted(a: Token, b: Token, delta: number): boolean {
	if (a.type !== b.type) return false
	if (a.content !== b.content) return false
	if (a.position.start + delta !== b.position.start || a.position.end + delta !== b.position.end) return false
	if (a.type === 'mark' && b.type === 'mark') {
		if (!sameDescriptor(a, b) || a.value !== b.value || a.meta !== b.meta) return false
		if (a.children.length !== b.children.length) return false
		return a.children.every((child, i) => tokensEqualShifted(child, b.children[i], delta))
	}
	return true
}

function sameDescriptor(a: Token, b: Token): boolean {
	if (a.type !== 'mark' || b.type !== 'mark') return true
	return a.descriptor === b.descriptor
}
```

IMPORTANT implementer notes:
- The line containing `残` is a typo guard — replace the comment text with plain English ("for the window region"); it is there to force you to read this code, not paste it blindly. Every branch must be understood and covered by a spec scenario before the commit.
- `findGap`'s exact return contract: READ `preparsing/utils/findGap.ts` and its spec first; the `{left, right}` semantics above (`right` measured from the END) must be verified, not assumed — if it returns absolute indices instead, fix `hintFromValues` accordingly and add a spec case.
- Prefix step compares `prev[p]` to `next[p]` at the SAME index — valid because an edit strictly after `prev[p].position.end` cannot change anything before it *in this grammar* only when the parse is stable; the suffix/middle steps and the Task 6 equivalence property are the safety net. If the property test finds a counterexample (e.g. an edit completing a markup whose opening segment was in the "prefix"), the prefix loop must additionally stop at the first token whose `position.end >= window.start - maxLookbehind`; derive `maxLookbehind` from the registry's longest segment length. Do NOT pre-build that machinery unless the property test demands it — let the test drive.
- `shifted` ids: per the design spec's routing rule these are TEXT-PATH (no renderer invalidation); `out[nextTail] = prev[prevTail]` reuse happens only when `shiftDelta === 0` because shifted tokens have different positions and must be new objects (the spec's "suffix keeps ids, gets shifted positions").

- [x] **Step 4: Iterate until the spec is green, then full suite**

`pnpm -w exec vitest run --project core tokenIdentity` → PASS. `pnpm -F core test` → green (nothing wires it yet).

- [x] **Step 5: Commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): identity tracker — stable ids and changesets across reparses"
```

---

### Task 3: Edit-hint plumbing (ValueModel → TokenModel)

**Files:**
- Modify: `packages/core/src/features/state/ValueModel.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.ts`
- Test: extend `packages/core/src/features/tokens/tokenIdentity.spec.ts` or a new `TokenModel.changeset.spec.ts`

- [x] **Step 1: Failing spec**

New file `packages/core/src/features/tokens/TokenModel.changeset.spec.ts` (mount pattern from `TokenHandle.spec.ts`):

```ts
it('exposes a changeset signal that is delta after edit.replace and full after direct value set', () => {
	// mount inline 'hello' with a mark parser (mountWithMark pattern from TokenModel.facade.spec.ts)
	// 1) store.edit.replace({start: 5, end: 5}, '!')  → tokens.changeset().kind === 'delta'
	// 2) store.value.current('completely different') → tokens.changeset().kind === 'full'
	// 3) ids: capture tracker id of the mark via tokens.idOf(token) before+after a tail edit → equal
})
```

Write it as real code; pin against actual store API (`store.edit.replace` exists — see `features/edit/EditController.ts`).

- [x] **Step 2: ValueModel records the hint**

In `ValueModel.replace(range, replacement)`: before `this.current(next)`, store the hint:

```ts
	#pendingEdit: {start: number; end: number; insertedLength: number} | undefined

	/** Consume-once hint describing the most recent replace(); undefined for direct sets. */
	takePendingEdit(): {start: number; end: number; insertedLength: number} | undefined {
		const hint = this.#pendingEdit
		this.#pendingEdit = undefined
		return hint
	}
```

with `this.#pendingEdit = {start: normalizedRangeStart, end: normalizedRangeEnd, insertedLength: replacement.length}` set inside `replace` right before `this.current(next)` (read the file; `replace` receives the already-normalized range — verify against `EditController.replace`'s normalization of negative end). A direct `value.current(x)` write leaves `#pendingEdit` undefined → full parse.

Also add, for the findGap fallback (Task 2's `reconcile` accepts `previousValue/nextValue`):

```ts
	#previousValue: string | undefined

	/** Value as it was before the most recent current() change. */
	previousValue(): string | undefined {
		return this.#previousValue
	}
```

maintained by capturing `this.#previousValue = this.current()` at the top of `replace()` AND via a `watch(this.current, (_, old) => { this.#previousValue = old })` for direct sets — read how `watch` exposes the old value in `shared/signals` (the TokenHandle spec asserts watch passes `(value, oldValue)`) and pick the single mechanism that covers both paths without double-capture; document the choice.

- [x] **Step 3: TokenModel pipeline**

In `TokenModel`: add `readonly #identity = createIdentityTracker()` and a `#changeset` signal. Rework `current`:

```ts
	readonly #reconciled: Computed<ReconcileResult> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		const parsed = parser ? parser.parse(value) : [createTextToken(value)]
		const tokens = this.props.layout.isBlock() ? filterEmptyText(parsed) : parsed
		const hint = this.value.takePendingEdit()
		return this.#identity.reconcile(tokens, hint, this.value.previousValue?.(), value)
	})

	readonly current: Computed<Token[]> = computed(() => this.#reconciled().tokens)

	/** Changeset of the latest reconcile — Phase 3's routing input. */
	changeset(): Changeset { return this.#reconciled().changeset }

	/** Stable identity of a token in the current tree. */
	idOf(token: Token): number { return this.#identity.idOf(token) }
```

CAUTION — purity: `takePendingEdit()` mutates inside a computed. That is acceptable here ONLY because the computed re-runs exactly once per value change (verify: nothing else invalidates `#reconciled` — parser changes also re-run it, in which case the hint is already consumed or absent and full-parse identity matching still works). Document this with a comment. If the signals library re-runs computeds speculatively (read `shared/signals/signal.ts` to confirm it does not), this is safe; if it does, move the consume into a `watch(value.current, ...)` instead and report the deviation.

Note: when the markup options change (`#parser` recomputes), the previous tree's descriptors no longer match (`sameDescriptor` is reference equality) — identity naturally degrades to added/removed, which is correct. Add a spec case if cheap.

- [x] **Step 4: Suite + commit**

Full suite green (existing parse behavior unchanged — `current()` returns the reconciled tree whose objects are equal-or-reused; the facade parity tables must still pass UNCHANGED — they assert positions/values, not identity).

```bash
git add -A packages/core
git commit -m "feat(tokens): edit hints flow from ValueModel into identity reconciliation with a changeset signal"
```

---

### Task 4: Re-key handles by id

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.ts` (`#ensureHandle`, `#syncHandles`, `handleFor`)
- Modify: `packages/core/src/features/tokens/TokenHandle.ts` (key type/doc only, if anything)
- Test: extend `packages/core/src/features/tokens/TokenHandle.spec.ts`

- [x] **Step 1: Failing spec**

Add to `TokenHandle.spec.ts`:

```ts
it('handle survives a structural shift that changes its path (id-keyed identity)', () => {
	// Block-layout mount with two rows (copy the existing dead-handle test mount).
	// Get the handle for ROW 2's token. Insert a new row ABOVE it via
	// store.edit.replace at position 0 (prepend 'new\n\n' — match the block
	// separator from the existing fixture). After rendered():
	//  - the same handle object now reports address().path [2]→[shifted index]
	//  - handle.dead() === false
	//  - changed fired {kind: 'moved'} (not unmounted)
	// Under path-keying this is impossible (old path key dies); under id-keying
	// the handle follows the token.
})
```

Write as real code; pin the block fixture against the existing one in this spec file.

- [x] **Step 2: Re-key**

In `TokenModel`:
- `#handles` key becomes the identity id (`Map<number, TokenHandle>`).
- `#ensureHandle(node)`: `const id = this.#identity.idOf(node.address.token)` → get-or-create by id. The `TokenHandle` constructor's `key` param: it currently holds `pathKey(node.path)` and is used for `host.nodeByKey(key)` lookups — **the DOM index is still path-keyed** (byPath). Resolve the seam: `HandleHost.nodeByKey` becomes `nodeForId(id: number): TokenNode | undefined`, implemented in TokenModel by a new per-commit `#byId: Map<number, TokenNode>` built in `#commit()` alongside the handle sync (`for (const node of result.byPath.values()) byId.set(this.#identity.idOf(node.address.token), node)`). TokenHandle stores its `id: number` instead of a string key. Keep the rest of the handle untouched.
- `#syncHandles()`: iterate `#handles` by id against `#byId` — present → `sync(node, node.address.token)` (the existing text/moved event logic now fires `moved` precisely when a shifted token kept its id — exactly the spec's contract); absent → `kill()` + delete.
- `handleFor(address)`: resolve node via `#byPath` (path from the address), then `#ensureHandle(node)` — unchanged externally.

- [x] **Step 3: Suite + commit**

`pnpm -w exec vitest run --project core TokenHandle` green (including the OLD dead-handle test — a removed token's id vanishes from `#byId`, so the kill path is preserved), full suite green, typecheck clean.

```bash
git add -A packages/core
git commit -m "feat(tokens): handles keyed by stable token identity — survive path shifts"
```

---

### Task 5: Equivalence property test (the gate for everything)

**Files:**
- Create: `packages/core/src/features/tokens/tokenIdentity.property.spec.ts`

- [x] **Step 1: Write the property test (it should PASS already — it gates Task 6)**

Seeded faker (same pattern as `Parser.spec.ts:1`), e.g. 200 iterations in CI-tolerable time:

```ts
// Property: for ANY document and ANY single edit,
//   reconcile(parse(next), hint).tokens deep-equals parse(next)
//   (ignoring identity — compare type/content/position/value/meta/children recursively)
// and ids are: stable for suffix-shifted tokens, fresh for added tokens,
// gone for removed tokens.
//
// Generator: build a random document from segments: plain words, valid marks
// '@[word]', partial/broken markup fragments ('@[', ']', '@'). Apply a random
// edit: insert/delete/replace a random slice (crossing token boundaries
// allowed, including edits that COMPLETE or BREAK a markup — the adversarial
// cases for the prefix heuristic). Reconcile with the true hint; assert
// equivalence. Log the seed on failure.
```

Write it as real code. Structure: a `deepTokenEqual(a, b)` helper (or `expect(strip(a)).toEqual(strip(b))` where `strip` removes nothing — tokens carry no id field, so plain `toEqual` between reconciled and fresh-parsed trees works directly — verify and prefer that).

- [x] **Step 2: Run it repeatedly**

`pnpm -w exec vitest run --project core tokenIdentity.property` — run at least 3 times (different seeds per run if the harness allows; otherwise bump iteration count once locally to 1000). ANY failure is a Task 2 algorithm bug: minimize the counterexample, add it as a named regression case in `tokenIdentity.spec.ts`, fix (the plan's predicted fix: prefix loop must stop `maxLookbehind` before the window — see Task 2 notes), re-run.

- [x] **Step 3: Commit**

```bash
git add -A packages/core
git commit -m "test(tokens): randomized equivalence property for identity reconciliation"
```

---

### Task 6: Windowed incremental reparse (the performance payoff)

Until now every keystroke still costs a full `parser.parse`. This task adds the windowed fast path, gated by Task 5's property.

**Files:**
- Create: `packages/core/src/features/tokens/incrementalParse.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.ts` (`#reconciled` uses it)
- Test: extend the property spec to ALSO assert windowed output ≡ full parse

- [x] **Step 1: Extend the property spec first**

Same generator as Task 5, asserting `incrementalParse(parser, prevTokens, prevValue, nextValue, hint)` deep-equals `parser.parse(nextValue)`. Failing (module doesn't exist).

- [x] **Step 2: Implement `incrementalParse.ts`**

Strategy (stabilization-checked window):

```ts
export function incrementalParse(
	parser: Parser,
	prev: readonly Token[],
	prevValue: string,
	nextValue: string,
	hint: EditHint
): Token[] {
	// 1. Choose a window: expand [hint.start, hint.end] to the boundaries of the
	//    top-level prev tokens it touches, then widen by one whole top-level
	//    token on each side (typing can merge with a neighbour).
	// 2. windowNext = corresponding range in nextValue (shift the right edge by
	//    insertedLength - (end - start)).
	// 3. Reparse ONLY nextValue.slice(windowStartNext, windowEndNext); offset the
	//    resulting positions by windowStartNext.
	// 4. STABILIZATION CHECK: the reparse of the window must reproduce, at the
	//    window edges, tokens that butt exactly against the untouched prefix
	//    (prev tokens before the window, positions unchanged) and the shifted
	//    suffix (prev tokens after, positions += delta). Concretely: the first
	//    reparsed token must start exactly at windowStartNext and the last must
	//    end exactly at windowEndNext, AND windowStartNext must coincide with a
	//    prev top-level boundary, AND no reparsed token is a partial/broken
	//    match that could have continued beyond the window (check: reparse a
	//    slightly larger window — width × 2 — and compare; equal → stable).
	// 5. Unstable → widen ×2 and retry; window covers everything → return
	//    parser.parse(nextValue) (full fallback; correctness never depends on
	//    incrementality — design spec guarantee).
	// 6. Stable → return [...prefixPrevTokens, ...reparsedWindowTokens,
	//    ...suffixPrevTokensShiftedByDelta] — suffix tokens REBUILT as new
	//    objects with shifted positions (identity layer will inherit ids).
}
```

Implement fully (the doubling-compare in step 4 is the simple, provably-conservative stabilization check: if reparsing 2× the window yields the same tokens inside the original window with the same edge alignment, accept; budget at most 3 widenings before full fallback). Position-shifting a Token subtree needs a `shiftToken(token, delta): Token` helper — recursive, new objects, shifted `position`/`slot` ranges.

- [x] **Step 3: Wire into TokenModel behind the hint**

In `#reconciled`: when `hint` exists AND a previous value/tree are available → `incrementalParse(...)`, else `parser.parse(value)`. The identity reconcile runs on the result either way (it doesn't care who produced the tree). Keep a module-level escape hatch: `const INCREMENTAL = true` constant (flag) so Phase 3 debugging can A/B quickly.

- [x] **Step 4: Property green ×3, suite, bench**

Property spec green on repeated runs (same escalation as Task 5 if not). Full suite green. Add the benchmark (next task runs it).

```bash
git add -A packages/core
git commit -m "feat(tokens): windowed incremental reparse with stabilization fallback"
```

---

### Task 7: Incremental-typing benchmark

**Files:**
- Modify: `packages/core/src/features/tokens/parser.bench.ts`

- [x] **Step 1: Add the benchmark**

Mirror the existing `bench()` structure (read the file): a 500-mark document; benchmark (a) full `parser.parse(value)` per keystroke vs (b) `incrementalParse` with a one-char tail insert hint and (c) a one-char middle insert. Use the existing `generateComparisonText(500)` fixture.

- [x] **Step 2: Run and record**

`pnpm run bench` (or `pnpm -F core run test:bench` — check package.json). Gate (from the design spec's phasing table): the incremental path must show a clear win on the 500-mark typing case — report the numbers. `parser.bench.result.json` is updated automatically; commit it.

```bash
git add -A packages/core
git commit -m "bench(tokens): incremental typing benchmark — windowed reparse vs full parse"
```

If the win does NOT materialize (window overhead dominates), say so honestly in the report — Phase 3's value does not depend on it (changeset routing is the payoff); flag `INCREMENTAL = false` as an option and let the controller decide.

---

### Task 8: TokenModel size check + docs

**Files:**
- Possibly create: `packages/core/src/features/tokens/` extraction modules
- Modify: `packages/core/src/features/tokens/README.md`

- [x] **Step 1: Size check (conditional extraction from the Phase 1 final review)**

`wc -l packages/core/src/features/tokens/TokenModel.ts` — if > ~600 lines after Tasks 3–6, extract the cohesive selection-read cluster (`readSelection`/`selectedContent`/`selectionRect`/`selectionAnchor`/`isSelectionCollapsed`/`selectionIntersects`/`selectionFocusNode`) into `selectionReads.ts` (free functions, TokenModel delegates) — mechanical, suite-gated. If ≤ 600, skip and note it.

- [x] **Step 2: README**

Update `features/tokens/README.md`: identity tracker (ids, WeakMap, reconcile), changeset vocabulary + the ROUTING RULE quote from the design spec (`textChanged`/`shifted` → text path; `added`/`removed` → renderer), edit-hint flow, incremental window strategy + fallback guarantee, `idOf`/`changeset()` API.

- [x] **Step 3: Gates + commit**

Full suite + typecheck + `pnpm run check:encapsulation` green.

```bash
git add -A packages/core
git commit -m "docs(tokens): identity, changeset and incremental-parse documentation"
```

---

### Task 9: hand off to Phase 3 planning

Phase 2 is not done until Phase 3 is planned — the chain from the Phase 1 plan continues.

- [x] **Step 1: Verify all Phase 2 gates**

`pnpm -F core test && pnpm -F core typecheck && pnpm run check:encapsulation` — green. Equivalence property green across repeated runs. Bench numbers recorded. All checkboxes in Tasks 1–8 ticked.

- [x] **Step 2: Write the Phase 3 implementation plan**

Using the **superpowers:writing-plans** skill, write the Phase 3 (fine-grained commit) plan against the now-landed codebase, from the design spec section "Phase 3 — fine-grained commit": changeset routing in `#commit()` (`textChanged`/`shifted` → patch path with CONDITIONAL textContent writes; `added`/`removed` → `structureInvalidated` renderer contract), `reconcileTextSurfaces` dissolution, dev-mode divergence detector, render-count specs (text edit → 0 renderer invocations, structural → 1), React adapter subscription. Save to `docs/superpowers/plans/YYYY-MM-DD-tokenmodel-finegrained-commit-phase3.md`.

**Phase 3's plan ENDS THE CHAIN — no Phase 4 handoff task.** Its final task is the design spec's overall completion check (all three phase gates green).

- [x] **Step 3: Commit the Phase 3 plan**

```bash
git add docs/superpowers/plans/
git commit -m "docs(tokens): Phase 3 implementation plan — fine-grained commit"
```

---

## Done criteria (gates from the design spec)

- Identity: prefix `===` reuse, suffix id-stable with shifted positions, changeset `{textChanged, added, removed, shifted}` with `full` fallback ✓ (Tasks 2–3)
- Handles id-keyed, surviving structural shifts; dead-handle contract intact ✓ (Task 4)
- Equivalence property: randomized edits, incremental ≡ full parse — the spec's "correctness never depends on incrementality" ✓ (Tasks 5–6)
- `parser.bench.ts` shows the incremental-typing win (or an honest report that it doesn't, with the flag documented) ✓ (Task 7)
- Handoff: Phase 3 plan written and committed ✓ (Task 9)
