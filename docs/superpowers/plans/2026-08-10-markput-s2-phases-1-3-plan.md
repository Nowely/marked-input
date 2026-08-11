# S2 Core Addressing — Implementation Plan, Phases S2.1–S2.3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first three phases of S2 Core Addressing — the anchor
projection (`anchorFor`), the pure relocation of selection state out of
`features/selection/`, and the anchor-shaped selection channel through `adopt`.

**Architecture:** S1 made the token tree the source of truth but left three
compat layers behind. Cut B removes the first: above `features/tokens/tree/`,
every position becomes a `NodeAnchor` instead of an absolute string offset. These
three phases build the mechanism (S2.1), give selection state a DOM-free home
(S2.2), and convert the commit-time selection channel (S2.3) — without cutting
any consumer over yet. Nothing here changes user-visible behavior.

**Tech Stack:** TypeScript (no build step in core — `@markput/core` ships
sources), Vitest with jsdom for unit tests and Playwright browser mode for the
storybook suites, pnpm workspaces, oxlint + oxfmt.

**Spec:** [2026-08-10-markput-s2-core-addressing-v1.md](./2026-08-10-markput-s2-core-addressing-v1.md)
(Status: Reviewed). Read §2.2 D1–D4, D10, §4.1–§4.3 before starting.

**Commit protocol (maintainer's, 2026-08-10):** per-task commits are code only.
The spec and this plan stay **uncommitted** until S2.1–S2.3 are complete, then get
**actualized against what was actually built** and committed last. If an
implementation step contradicts the spec, the spec is what changes — record the
divergence rather than bending the code to a document nobody has run.

**Scope of this plan:** S2.1, S2.2, S2.3 only. See "Why this plan stops at S2.3"
at the end — the remaining phases operate on code these three produce, and
writing their steps now would mean inventing it.

---

## Background you need

Read these before Task 1. Do not skip — several steps below only make sense
against them.

| File | Why |
|---|---|
| `packages/core/src/features/tokens/dom/domBoundary.ts` | The walk you are adding a second entry point to. All 154 lines. |
| `packages/core/src/features/tokens/tree/types.ts:86` | `NodeAnchor` — the four shapes: `{node, offset}`, `{before}`, `{after}`, `'start'`, `'end'`. |
| `packages/core/src/features/tokens/tree/anchors.ts` | `anchorAt` / `offsetOfAnchor` / `anchorEquals`. `offsetOfAnchor` is the inverse you assert against in Task 6. |
| `packages/core/src/features/tokens/seam/TokenModel.facade.spec.ts:1-90` | `mountWithMark()`, `mountBlock()`, `probes()` — the fixtures Task 6 reuses. Do **not** write new ones. |
| `AGENTS.md` "Testing" | `it('returns undefined when token missing')` — imperative present, no "should". |

**Two invariants that will bite you:**

1. **Never read `.position` in the new code.** That is the whole point of the
   phase (spec D1). Use `node.text().length` for text lengths and
   `anchorEquals` for comparisons. `offsetOfAnchor` is allowed **only** inside
   `tree/` and in test assertions.
2. **`TokenHandle.id` is stable; `handle.token()` is not.** `handle.token()`
   returns the *bind generation* — what the DOM currently shows. The new code
   must bridge through `ctx.find(handle.id)` to reach the live node. Reading
   `handle.token()` anywhere in `anchorFromBoundary` is a bug, not a shortcut.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `packages/core/src/features/tokens/dom/domBoundary.ts` | DOM boundary → model coordinates. Gains the anchor projection beside the numeric one. | Modify (+~85) |
| `packages/core/src/features/tokens/dom/domBoundary.spec.ts` | Unit gate for the anchor projection. | **Create** |
| `packages/core/src/features/tokens/dom/DomModel.ts` | DOM↔model facade. Gains `anchorFor` and the context fields it needs. | Modify (+~20) |
| `packages/core/src/features/tokens/seam/TokenModel.ts` | The single entry point consumers use. Gains `anchorFor` delegation. | Modify (+~12) |
| `packages/core/src/features/tokens/seam/TokenModel.facade.spec.ts` | Pinned boundary tables. Gains the equivalence property. | Modify (+~30) |
| `packages/core/src/features/tokens/tree/selection.ts` | DOM-free selection state: anchors, derived range, `remap`. | **Create** (~100) |
| `packages/core/src/features/tokens/tree/selection.spec.ts` | DOM-free selection gate. | **Create** (~230) |
| `packages/core/src/features/tokens/dom/SelectionDriver.ts` | Selection DOM I/O: listeners, caret application, editable policy. | **Create** (~250) |
| `packages/core/src/features/tokens/dom/SelectionDriver.spec.ts` | Mounted selection gate. | **Create** (~300) |
| `packages/core/src/features/selection/SelectionController.ts` | Composition shell over the two new modules. Deleted at S2.9. | Modify (356 → ~30) |
| `packages/core/src/features/selection/SelectionController.spec.ts` | Redistributed into the three homes above. | **Delete** |
| `packages/core/src/features/tokens/tree/types.ts` | Tree contracts. `Anchors` in, `SelectionRange` out, `selectionAfter` added. | Modify |
| `packages/core/src/features/tokens/tree/adopt.ts` | Adoption. Resolves the selection channel pre-mutation. | Modify (+~14) |
| `packages/core/src/features/tokens/tree/valueBoundary.ts` | Capture site. Reads anchors instead of a range. | Modify (~3) |
| `packages/core/src/features/tokens/index.ts` | Token layer barrel. | Modify |

---

# Phase S2.1 — `anchorFor`, the anchor projection

Spec §4.1. Built alongside `rawPositionFromBoundary`; **no production consumer**
until S2.4. Behavior of the numeric path must not change at all.

### Task 1: Context type and skeleton

**Files:**
- Modify: `packages/core/src/features/tokens/dom/domBoundary.ts`
- Modify: `packages/core/src/features/tokens/dom/DomModel.ts:104-118`
- Modify: `packages/core/src/features/tokens/seam/TokenModel.ts` (after `boundaryFor`, ~line 323)
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/tokens/dom/domBoundary.spec.ts`:

```ts
import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../../store/Store'

/** Inline fixture: text "he" [0,2], mark "@[x]" [2,6], text "llo" [6,9]. */
function mountWithMark() {
	const store = new Store()
	store.props.set({
		defaultValue: 'he@[x]llo',
		options: [{markup: '@[__value__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, text1, mark, text2}
}

describe('anchorFor', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined for a node outside the container', () => {
		const {store} = mountWithMark()
		const orphan = document.createElement('span')
		expect(store.tokens.anchorFor(orphan, 0)).toBeUndefined()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: FAIL — `store.tokens.anchorFor is not a function`.

- [ ] **Step 3: Add the context type and the skeleton**

In `domBoundary.ts`, add these imports to the existing import block:

```ts
import type {Id, NodeAnchor, TreeNode} from '../tree/types'
```

Then append after the `BoundaryContext` type declaration:

```ts
/**
 * What the ANCHOR projection needs on top of {@link BoundaryContext}: a bridge
 * from a bound handle's stable id to the LIVE node, and the live roots.
 *
 * Deliberately NOT `tokenOf` — that answers with the BIND GENERATION (spec S1
 * D9), whose positions describe what the DOM is showing rather than what the
 * tree holds. The anchor projection never forms an absolute coordinate, so it
 * wants identity, not coordinates (spec D2/D4).
 */
export type AnchorContext = BoundaryContext & {
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find). NOT latch-gated: ids outlive the bind window. */
	find(id: Id): TreeNode | undefined
	/** The bound view for a live node's id, if any. */
	viewOfId(id: Id): TokenView | undefined
}

/**
 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree.
 *
 * The anchor projection of the same walk {@link rawPositionFromBoundary}
 * numerically projects. No absolute coordinate is formed anywhere on this path,
 * which is why it is correct during the adopt→bind window where the numeric one
 * is not (spec D4).
 */
export function anchorFromBoundary(
	_ctx: AnchorContext,
	_node: Node,
	_offset: number,
	_affinity: 'before' | 'after' = 'after'
): NodeAnchor | undefined {
	return undefined
}
```

- [ ] **Step 4: Wire it through DomModel**

In `DomModel.ts`, add to the `DomModelDeps` type (after `boundHandles`):

```ts
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find) — NOT latch-gated. */
	find(id: number): TreeNode | undefined
	/** Latch-gated id → handle (TokenModel.handle), for the bound-view lookup. */
	handleById(id: number): TokenHandle | undefined
```

Add the import: `import type {TreeNode} from '../tree/types'`
and extend the imports from `./domBoundary` with `anchorFromBoundary` and
`AnchorContext`.

Add a private context builder next to `#boundaryContext`:

```ts
	#anchorContext(): AnchorContext {
		return {
			...this.#boundaryContext(),
			roots: () => this.deps.roots(),
			find: id => this.deps.find(id),
			viewOfId: id => {
				const handle = this.deps.handleById(id)
				return handle ? this.#view(handle) : undefined
			},
		}
	}

	/** Map a DOM boundary (node, offset) to a node anchor in the live tree. */
	anchorFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): NodeAnchor | undefined {
		return anchorFromBoundary(this.#anchorContext(), node, offset, affinity)
	}
```

Add `import type {NodeAnchor} from '../tree/types'` to the same import.

- [ ] **Step 5: Wire it through TokenModel**

In `TokenModel.ts`, add the three new deps to the `#dom = new DomModel({…})` block:

```ts
		roots: () => this.#tree.roots(),
		find: id => this.find(id),
		handleById: id => this.handle(id),
```

And add the public delegation immediately after `boundaryFor`:

```ts
	/**
	 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree.
	 *
	 * NO PRODUCTION CALLER until S2.4 — this is a pre-cutover phase built
	 * alongside the live path (spec §11, S2.1). `untracked` for the reason
	 * {@link find} documents: the walk reads node text signals and an event
	 * handler must not subscribe to them.
	 */
	anchorFor(node: Node, offset: number, affinity?: 'before' | 'after'): NodeAnchor | undefined {
		return untracked(() => this.#dom.anchorFor(node, offset, affinity))
	}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Verify nothing else moved**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens && pnpm run typecheck`
Expected: PASS, same counts as before the change.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.ts \
        packages/core/src/features/tokens/dom/domBoundary.spec.ts \
        packages/core/src/features/tokens/dom/DomModel.ts \
        packages/core/src/features/tokens/seam/TokenModel.ts
git commit -m "feat(tokens): add the anchor projection skeleton beside the numeric one"
```

---

### Task 2: Container boundaries

**Files:**
- Modify: `packages/core/src/features/tokens/dom/domBoundary.ts`
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('anchorFor')`:

```ts
	it('returns start for a boundary in an empty document', () => {
		const store = new Store()
		store.props.set({defaultValue: ''})
		const container = document.createElement('div')
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()
		expect(store.tokens.anchorFor(container, 0)).toBe('start')
	})

	it('anchors a container boundary before the first root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 0)).toEqual({before: roots[0]})
	})

	it('anchors a container boundary past the last child after the last root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 3)).toEqual({after: roots[2]})
	})

	it('resolves an interior container boundary by affinity', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 1, 'before')).toEqual({after: roots[0]})
		expect(store.tokens.anchorFor(container, 1, 'after')).toEqual({before: roots[1]})
	})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: FAIL ×4 — each receives `undefined`.

- [ ] **Step 3: Implement the container branch**

In `domBoundary.ts`, replace the skeleton body's first line and add the helper:

```ts
export function anchorFromBoundary(
	ctx: AnchorContext,
	node: Node,
	offset: number,
	affinity: 'before' | 'after' = 'after'
): NodeAnchor | undefined {
	if (ctx.container && node === ctx.container) {
		return fromContainerAnchor(ctx.roots(), offset, affinity)
	}

	return undefined
}

/** Mirrors {@link fromContainerBoundary}: same branches, anchors instead of positions. */
function fromContainerAnchor(
	roots: readonly TreeNode[],
	offset: number,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	if (roots.length === 0) return 'start'
	if (offset <= 0) return {before: roots[0]}
	if (offset >= roots.length) return {after: roots[roots.length - 1]}
	return affinity === 'before' ? {after: roots[offset - 1]} : {before: roots[offset]}
}
```

Rename the unused parameters (`_ctx` → `ctx` etc.) in the signature.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.ts \
        packages/core/src/features/tokens/dom/domBoundary.spec.ts
git commit -m "feat(tokens): anchor container boundaries"
```

---

### Task 3: Text-surface boundaries

**Files:**
- Modify: `packages/core/src/features/tokens/dom/domBoundary.ts`
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
	it('anchors a text-surface boundary to the live node and a local offset', () => {
		const {store, text1} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text1.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[0], offset: 1})
	})

	it('anchors the second text surface with an offset local to ITS node, not the document', () => {
		const {store, text2} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		// The document position here is 7; the anchor must say 1.
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[2], offset: 1})
	})

	it('returns undefined for a boundary that splits a surrogate pair', () => {
		const store = new Store()
		store.props.set({defaultValue: '\u{1F600}a'})
		const container = document.createElement('div')
		const surface = document.createElement('span')
		container.append(surface)
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()
		const textNode = surface.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toBeUndefined()
	})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts -t "text-surface\|second text surface\|surrogate"`
Expected: FAIL ×2 (the surrogate case passes vacuously — the body still returns
`undefined` for everything; that is fine, it becomes meaningful in Step 3).

- [ ] **Step 3: Implement the lookup and the text branch**

Replace the `return undefined` tail of `anchorFromBoundary` with:

```ts
	const lookup = ctx.locate(node)
	if (lookup?.kind !== 'token') return undefined

	// The IDENTITY bridge (spec D2/D3): `handle.id` is generation-independent, so
	// this reaches the LIVE node. Reading `ctx.tokenOf(lookup.node)` here would
	// reach the bind generation and reintroduce the coordinate space this
	// projection exists to avoid.
	const owner = ctx.find(lookup.node.handle.id)
	if (!owner) return undefined

	const textElement = lookup.node.textElement
	if (textElement?.contains(node)) {
		// bind sets `textElement` only for text tokens (bind.ts:158), so the narrow
		// cannot fail in practice; `undefined` is the non-throwing answer per §6.
		if (owner.kind !== 'text') return undefined
		const local = textOffsetWithin(textElement, node, offset)
		if (local === undefined) return undefined
		// D4's second fail-closed condition: the offset is local to the node's own
		// text, so it is correct even mid-window UNLESS that text shrank.
		return local <= owner.text().length ? {node: owner, offset: local} : undefined
	}

	return undefined
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.ts \
        packages/core/src/features/tokens/dom/domBoundary.spec.ts
git commit -m "feat(tokens): anchor text-surface boundaries to live nodes"
```

---

### Task 4: Child-sequence and token-shell boundaries

**Files:**
- Modify: `packages/core/src/features/tokens/dom/domBoundary.ts`
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`

**Read first:** `fromTokenChildBoundary` (`domBoundary.ts:93-116`). Its last line
inverts affinity — `'before'` yields `position.start`, not `.end`. That reads
backwards and is load-bearing. Preserve it verbatim.

- [ ] **Step 1: Write the failing tests**

Add a nested fixture above `describe`:

```ts
/** Nested fixture: '@[a @[b] c]' — an outer slot mark with a child sequence host. */
function mountNested() {
	const store = new Store()
	store.props.set({
		defaultValue: '@[a @[b] c]',
		options: [{markup: '@[__slot__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const outer = document.createElement('mark')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	host.style.display = 'contents'
	host.append(before, inner, after)
	outer.append(host)
	container.append(outer)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	const outerId = store.tokens.nodes()[0].id
	host.replaceChildren()
	const ref = store.tokens.children(outerId)
	ref(host)
	outer.append(host)
	host.append(before, inner, after)
	store.host.rendered()
	return {store, container, outer, host, before, inner, after}
}
```

Then the cases:

```ts
	it('anchors a child-sequence boundary at index 0 before the owner', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[0]
		expect(store.tokens.anchorFor(host, 0)).toEqual({before: outer})
	})

	it('anchors a child-sequence boundary past the last child after the owner', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[0]
		expect(store.tokens.anchorFor(host, 3)).toEqual({after: outer})
	})

	it('resolves an interior child boundary to its two neighbours by affinity', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[0]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const [first, second] = outer.children()
		expect(store.tokens.anchorFor(host, 1, 'before')).toEqual({after: first})
		expect(store.tokens.anchorFor(host, 1, 'after')).toEqual({before: second})
	})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts -t "child"`
Expected: FAIL ×3 — each receives `undefined`.

- [ ] **Step 3: Implement the child branch**

Insert into `anchorFromBoundary`, immediately after the `owner` lookup and
**before** the text branch:

```ts
	if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
		return fromChildAnchor(ctx, node, offset, owner, affinity)
	}
```

and after the text branch:

```ts
	if (node === lookup.node.tokenElement) {
		return fromChildAnchor(ctx, lookup.node.tokenElement, offset, owner, affinity)
	}
```

Then add the two helpers:

```ts
/** The `<=0` / `>=childCount` / interior split both element branches share. */
function fromChildAnchor(
	ctx: AnchorContext,
	element: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	const childCount = element.childNodes.length
	if (offset <= 0) return {before: owner}
	if (offset >= childCount) return {after: owner}
	return childBoundaryAnchor(ctx, element, offset, owner, affinity)
}

/** Mirrors {@link fromTokenChildBoundary}, including its inverted-affinity fallback. */
function childBoundaryAnchor(
	ctx: AnchorContext,
	tokenElement: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	if (owner.kind === 'text') {
		const textElement = ctx.viewOfId(owner.id)?.textElement
		if (!textElement || textLength(textElement) === 0) return {before: owner}
	}

	const beforeView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const afterView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (beforeView && afterView) {
		const beforeNode = ctx.find(beforeView.handle.id)
		const afterNode = ctx.find(afterView.handle.id)
		if (beforeNode && afterNode) {
			return affinity === 'before' ? {after: beforeNode} : {before: afterNode}
		}
	}

	// INVERTED, and preserved verbatim from `fromTokenChildBoundary`'s last line:
	// 'before' answers with the owner's START. It reads backwards; it is the
	// behavior the pinned table gates.
	return affinity === 'before' ? {before: owner} : {after: owner}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.ts \
        packages/core/src/features/tokens/dom/domBoundary.spec.ts
git commit -m "feat(tokens): anchor child-sequence and token-shell boundaries"
```

---

### Task 5: Mark-presentation and row boundaries

**Files:**
- Modify: `packages/core/src/features/tokens/dom/domBoundary.ts`
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
	it('anchors a mark presentation descendant by affinity', () => {
		const {store, mark} = mountWithMark()
		const markNode = store.tokens.nodes()[1]
		const inner = mark.firstChild
		if (!inner) throw new Error('expected mark presentation content')
		expect(store.tokens.anchorFor(inner, 0, 'after')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 0, 'before')).toEqual({after: markNode})
	})

	it('returns undefined inside an editable descendant of a mark', () => {
		const {store, mark} = mountWithMark()
		const editable = document.createElement('span')
		editable.contentEditable = 'true'
		const inner = document.createTextNode('z')
		editable.append(inner)
		mark.append(editable)
		expect(store.tokens.anchorFor(inner, 0)).toBeUndefined()
	})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts -t "mark presentation\|editable descendant"`
Expected: FAIL on the first (`undefined` vs an anchor); the second passes
vacuously and becomes meaningful after Step 3.

- [ ] **Step 3: Implement the two remaining branches**

Append before the final `return undefined`:

```ts
	if (owner.kind === 'mark' && lookup.node.tokenElement.contains(node)) {
		if (hasEditableAncestorBefore(node, lookup.node.tokenElement)) {
			return undefined
		}
		return affinity === 'after' ? {before: owner} : {after: owner}
	}

	if (lookup.node.rowElement && node === lookup.node.rowElement) {
		return offset <= 0 ? {before: owner} : {after: owner}
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.ts \
        packages/core/src/features/tokens/dom/domBoundary.spec.ts
git commit -m "feat(tokens): anchor mark-presentation and row boundaries"
```

---

### Task 6: The equivalence property — the phase gate

**Files:**
- Modify: `packages/core/src/features/tokens/seam/TokenModel.facade.spec.ts`

This is S2.1's real gate (spec §7.2). It reuses the existing `mountWithMark`,
`mountBlock` and `probes` in that file — do not duplicate them.

- [ ] **Step 1: Write the property**

Inside the existing `for (const [name, mount] of […])` loop in
`describe('TokenModel facade boundary behavior (pinned from dual-run parity)')`,
add a third `it`:

```ts
		/**
		 * S2.1's gate (spec §7.2): the two projections of ONE walk must agree.
		 * `offsetOfAnchor` is the inverse of the anchor shapes, so composing it with
		 * the anchor projection must reproduce the numeric one for EVERY probe,
		 * `undefined` included.
		 *
		 * Conditioned on a settled tree, and that is not a weakening: inside the
		 * adopt→bind window the two MUST disagree — the numeric path adds a stale
		 * `position.start` while the anchor path stays node-local (spec D4). These
		 * fixtures mount and render synchronously, so no window is open here.
		 *
		 * DELETED BY S2.6 together with `boundaryFor`.
		 */
		it(`anchorFor agrees with boundaryFor on every probe — ${name}`, () => {
			const {store, container} = mount()
			let probed = 0
			let defined = 0
			for (const [node, nodeIndex, offset] of probes(container)) {
				for (const affinity of ['before', 'after'] as const) {
					probed++
					const label = `${node.nodeName}#${nodeIndex}@${offset}/${affinity}`
					const numeric = store.tokens.boundaryFor(node, offset, affinity)
					const anchor = store.tokens.anchorFor(node, offset, affinity)
					if (numeric === undefined) {
						expect.soft(anchor, label).toBeUndefined()
						continue
					}
					defined++
					expect.soft(anchor, label).toBeDefined()
					if (anchor === undefined) continue
					expect.soft(store.tokens.offsetOf(anchor), label).toBe(numeric)
				}
			}
			expect(probed).toBeGreaterThan(0)
			// Non-vacuous guard: a run where every probe answered `undefined` would
			// pass the loop above while proving nothing.
			expect(defined).toBeGreaterThan(0)
		})
```

- [ ] **Step 2: Run it**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/seam/TokenModel.facade.spec.ts`
Expected: PASS (both fixtures).

If it fails, the failure label names the exact probe. Compare that branch of
`anchorFromBoundary` against the same branch of `rawPositionFromBoundary` — the
bug is a branch mismatch, not a missing feature. **Do not adjust the numeric
path.** It is pinned and this phase must not change it.

- [ ] **Step 3: Verify the numeric path is untouched**

Run: `git diff --stat packages/core/src/features/tokens/dom/domBoundary.ts`
Expected: additions only in the region below `rawPositionFromBoundary`. Then:

```bash
git diff packages/core/src/features/tokens/dom/domBoundary.ts | grep '^-' | grep -v '^---'
```
Expected: only the skeleton's `_ctx`/`_node`/`_offset`/`_affinity` signature line
and its `return undefined`. Any other removed line means the numeric walk was
edited — revert it.

- [ ] **Step 4: Full gate**

Run: `pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`
Expected: PASS, 1324 passed / 7 todo plus the 15 new cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/seam/TokenModel.facade.spec.ts
git commit -m "test(tokens): pin anchorFor against boundaryFor on every probe"
```

---

### Task 7: Fail-closed conditions (D4)

**Files:**
- Test: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`

The code for these already exists from Tasks 3 and 5. This task proves both
branches are reachable — an untested guard is one AGENTS.md tells you to delete,
so if a case here cannot be constructed, say so rather than keeping the guard.

- [ ] **Step 1: Write the tests**

```ts
	it('returns undefined when the bound node has left the live tree', () => {
		const {store, text2} = mountWithMark()
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		// Replace the whole value: every previous node dies, the DOM is not re-rendered.
		store.api.setValue('different')
		expect(store.tokens.anchorFor(textNode, 1)).toBeUndefined()
	})

	it('returns undefined when the local offset exceeds the live node text', () => {
		const {store, text1} = mountWithMark()
		const textNode = text1.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		// Grow the DOM text without telling the model: the surface now offers an
		// offset the live node cannot honour.
		textNode.data = 'he-much-longer'
		expect(store.tokens.anchorFor(textNode, 12)).toBeUndefined()
	})
```

- [ ] **Step 2: Run them**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/dom/domBoundary.spec.ts`
Expected: PASS (15 tests).

If either fails, **do not add a guard to make it pass.** Report which condition
could not be constructed — the spec's §6 table would then be claiming a case that
cannot occur, and it should lose the row instead.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/tokens/dom/domBoundary.spec.ts
git commit -m "test(tokens): gate anchorFor's two fail-closed conditions"
```

**S2.1 exit check:** `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check` all green; `anchorFor` has no production caller (`grep -rn 'anchorFor' packages --include='*.ts*' | grep -v spec` shows only the three declarations).

---

# Phase S2.2 — Pure move: selection state out of `features/selection/`

Spec §4.2, D10, §11 S2.2. **No behavior change.** `#generation`, the derived
numeric `range`, `placeAtHandle` and the four `#anchors(undefined)` writes move
**verbatim**; they are retired at S2.5/S2.6, not here.

**The discipline that makes this phase reviewable:** `git diff --stat` must read
as a move. If you find yourself improving something, stop — that is a different
commit.

### Task 8: Move the state half to `tree/selection.ts`

**Files:**
- Create: `packages/core/src/features/tokens/tree/selection.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/tokens/index.ts`

- [ ] **Step 1: Create the module by moving code**

Create `tree/selection.ts` containing, moved **verbatim** from
`SelectionController.ts` including every comment: `Anchors` (line 12), `#anchors`
(15-29), `#generation` (31-42), `range` (44-60), `position` (62-71),
`isAllSelected` (73-77), `select` (127-134), `repair` (136-154), `anchors`
(156-162), `selectAll` (121-125), and `placeAtHandle`'s **anchor construction
only** (187-194, the `const anchor: NodeAnchor = …` expression) as
`selectNode(node, boundary)`.

Wrap them in the factory from spec §4.2:

```ts
export type Anchors = {anchor: NodeAnchor; head: NodeAnchor}

export type SelectionDeps = {
	offsetOf(anchor: NodeAnchor): number
	anchorAt(offset: number): NodeAnchor
	value(): string
	find(id: Id): TreeNode | undefined
}

export type Selection = {
	/**
	 * THE stored anchors, as a SIGNAL rather than a getter: the controller's
	 * `#anchors` watch (`SelectionController.ts:102-111`) needs something to watch,
	 * and it must be the anchors and not the derived `range` — at a shared boundary
	 * `range` dedupes on `shallow` and the watch never fires (8 browser assertions).
	 * `anchors()` is a read of this signal, which is why both are here.
	 */
	readonly stored: Signal<Anchors | undefined>
	readonly range: Computed<Range | undefined>
	readonly position: WritableComputed<number | undefined>
	readonly isAllSelected: Computed<boolean>
	anchors(): Anchors | undefined
	select(anchor: NodeAnchor, head?: NodeAnchor): boolean
	selectNode(node: TreeNode, boundary: 'start' | 'end'): boolean
	selectAll(): void
	repair(result: TransactionResult): void
}

export function createSelection(deps: SelectionDeps): Selection { … }
```

Every `this.tokens.X` becomes `deps.X`. Nothing else changes.

`#generation` stays private to the factory — it has exactly one writer (`repair`)
and one reader (`range`), both inside. It is retired at S2.6.

- [ ] **Step 2: Reduce `SelectionController` to a shell over it**

`SelectionController` keeps its constructor signature and its DOM half, and
delegates the state half:

```ts
	readonly #state = createSelection({
		offsetOf: anchor => this.tokens.offsetOf(anchor),
		anchorAt: offset => this.tokens.anchorAt(offset),
		value: () => this.tokens.value(),
		find: id => this.tokens.find(id),
	})

	readonly range = this.#state.range
	readonly position = this.#state.position
	readonly isAllSelected = this.#state.isAllSelected
	anchors() { return this.#state.anchors() }
	select(anchor: NodeAnchor, head?: NodeAnchor) { return this.#state.select(anchor, head) }
	repair(result: TransactionResult) { this.#state.repair(result) }
	selectAll() { this.#state.selectAll() }
```

`placeAtHandle` keeps its liveness check and `#applySelection` re-apply, calling
`this.#state.selectNode(node, boundary)` for the anchor.

The `#anchors` **watch** (lines 102-111) stays in the controller and now watches
`this.#state.stored`, keeping its whole comment verbatim. It must be `stored`
and not `range`: that comment records 8 browser assertion failures across three
focus specs when the watch is put on the derived range instead.

- [ ] **Step 3: Export from the token layer barrel**

In `features/tokens/index.ts`, add:

```ts
export {createSelection} from './tree/selection'
export type {Anchors, Selection, SelectionDeps} from './tree/selection'
```

- [ ] **Step 4: Run the suite**

Run: `pnpm -w exec vitest run packages/core && pnpm run typecheck`
Expected: PASS, **exactly the same case count as before** — this is a move.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/selection.ts \
        packages/core/src/features/selection/SelectionController.ts \
        packages/core/src/features/tokens/index.ts
git commit -m "refactor(tokens): move selection state into tree/selection.ts (pure move)"
```

---

### Task 9: Move the DOM half to `dom/SelectionDriver.ts`

**Files:**
- Create: `packages/core/src/features/tokens/dom/SelectionDriver.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts`

- [ ] **Step 1: Create the driver by moving code**

Move verbatim from `SelectionController.ts`: `isUserSelecting` (79),
`#isPlacingCaret` (81), the `host.onMounted` body (88-112),
`#applyEditablePolicy` (115-119), `#applySelection` (200-220), `#placeAt`
(230-237), `#focusEmptyEditorOnClick` (239-249), `#trackUserSelecting` (251-280),
`#trackSelection` (282-346), `focusFirst` (164-168), `readRaw` (170-172), and the
module-level `anchorTarget` (349-355).

Constructor deps, in the `DomModel` pull-closure style:

```ts
export type SelectionDriverDeps = {
	selection: Selection            // the tree half from Task 8
	host: Host
	readOnly(): boolean
	changed: Event<TokenDelta>
	current(): readonly Token[]
	handleAt(node: Node): TokenHandle | 'control' | undefined
	handle(id: number): TokenHandle | undefined
	handleOf(token: Token | undefined): TokenHandle | undefined
	domSelection(): SelectionSnapshot | undefined
	setEditable(options: {editable: boolean; readOnly: boolean}): void
	placeCaret(rawPosition: number): boolean
	selectRange(start: number, end: number): boolean
	offsetOf(anchor: NodeAnchor): number
	anchorAt(offset: number): NodeAnchor
}
```

- [ ] **Step 2: Reduce `SelectionController` to composition**

It now constructs both halves and re-exports their members. Target: ~30 lines,
no logic of its own. Keep the file where it is — it cannot be deleted until
`TokenModel` owns the tree (spec §11 S2.2).

- [ ] **Step 3: Run the suite**

Run: `pnpm -w exec vitest run packages/core && pnpm run typecheck`
Expected: PASS, same case count.

- [ ] **Step 4: Verify it reads as a move**

Run: `git diff --stat HEAD~1`
Expected: added lines in `SelectionDriver.ts` ≈ removed lines in
`SelectionController.ts`, modulo import headers.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/dom/SelectionDriver.ts \
        packages/core/src/features/selection/SelectionController.ts
git commit -m "refactor(tokens): move selection DOM I/O into dom/SelectionDriver.ts (pure move)"
```

---

### Task 10: Redistribute the spec file

**Files:**
- Create: `packages/core/src/features/tokens/tree/selection.spec.ts`
- Create: `packages/core/src/features/tokens/dom/SelectionDriver.spec.ts`
- Modify: `packages/core/src/features/tokens/dom/domBoundary.spec.ts`
- Delete: `packages/core/src/features/selection/SelectionController.spec.ts`

Move cases **verbatim**, changing only the import path and the receiver. A case
that changes its assertion is not a move — flag it instead.

| From `SelectionController.spec.ts` | To |
|---|---|
| `describe('position')` (:166-198), `describe('isAllSelected')` (:200-222), `describe('caret repair …')` (:472-557), `describe('controlled caret …')` (:559-620), `it('exposes range')` (:89), `it('range starts undefined')` (:94) | `tree/selection.spec.ts` |
| `it('repeated placement …')` (:98), `it('repeated selectAll applies to the DOM once')` (:115), `it('places at a mark whose start equals …')` (:130), `it('repeated position write notifies once')` (:145), `it('position undefined write is no-op …')` (:157), `describe('selectAll')` (:224), `describe('lifecycle wiring')` (:255), `describe('restoration via tokens.changed')` (:265), `describe('isUserSelecting → contentEditable')` (:358), `describe('empty-editor click handler')` (:382) | `dom/SelectionDriver.spec.ts` |
| `describe('boundary mapping')` (:402-470) — 6 cases that were always `boundaryFor` tests | `dom/domBoundary.spec.ts` |

- [ ] **Step 1: Count the baseline**

Run: `pnpm -w exec vitest run packages/core/src/features/selection --reporter=verbose 2>&1 | tail -5`
Write the number down. It is the number Step 4 must reproduce.

- [ ] **Step 2: Move the cases**

Carry the fixtures each group needs (`enableStructuralStore`, `mountInline`,
`mountStructuralInline`, `mountStructuralInlineMark`,
`mountStructuralNestedWithChildSequence`) into the files that use them. Duplicate
a fixture rather than inventing a shared helper — that is a later cleanup, not
this commit.

- [ ] **Step 3: Delete the old file**

```bash
git rm packages/core/src/features/selection/SelectionController.spec.ts
```

- [ ] **Step 4: Verify no case was lost**

Run: `pnpm -w exec vitest run packages/core --reporter=verbose 2>&1 | tail -5`
Expected: the same total as Step 1's baseline plus S2.1's new cases. **A lower
number means a case was dropped — find it before committing.**

- [ ] **Step 5: Verify the four named gates survive**

For each, confirm the case exists in its new home and still fails when its
mechanism is broken (spec §7.1):

| Mechanism | Named gate | New home |
|---|---|---|
| `#anchors` value equality | "repeated selectAll applies to the DOM once" | `SelectionDriver.spec.ts` |
| `#generation` | "keeps node and offset when the edit is outside the anchor…" | `tree/selection.spec.ts` |
| the `#anchors` watch | the 8 browser assertions (react/vue focus specs) | unmoved |
| the node disambiguator | "places at a mark whose start equals the previous text node end…" | `SelectionDriver.spec.ts` |

- [ ] **Step 6: Full gate and commit**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
git add -A packages/core/src/features
git commit -m "test(tokens): redistribute selection specs to their new homes"
```

---

# Phase S2.3 — The selection channel becomes anchor-shaped

Spec D3, §4.3. **The ordering is the entire correctness argument:** the
pre-adoption offsets must be read between `adopt.ts:47` (`const prev =
tree.roots()`) and `adopt.ts:140` (the mutating `batch`). Anything later reads
positions adoption already rewrote and double-shifts the caret.

### Task 11: `Anchors` and `selectionAfter` on the result

**Files:**
- Modify: `packages/core/src/features/tokens/tree/types.ts:94-152`
- Modify: `packages/core/src/features/tokens/tree/adopt.ts:39-205`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/features/tokens/tree/adopt.spec.ts`:

```ts
	it('resolves selectionAfter from PRE-adoption offsets', () => {
		// 'hello' with a caret at offset 2, then 'X' inserted at 2.
		const tree = createTokenTree([createTextToken('hello')])
		const roots = tree.roots()
		if (roots[0].kind !== 'text') throw new Error('expected a text root')
		const before = {anchor: {node: roots[0], offset: 2}, head: {node: roots[0], offset: 2}}
		const result = adopt(
			tree,
			{start: 2, end: 2, insertedLength: 1},
			[createTextToken('heXllo')],
			before
		)
		// Right affinity: the caret lands AFTER the inserted text — offset 3, not 2 and not 4.
		expect(textAnchorOf(result.selectionAfter?.anchor).offset).toBe(3)
		expect(textAnchorOf(result.selectionAfter?.head).offset).toBe(3)
	})
```

(`textAnchorOf` and `createTokenTree` are already imported in that file; see its
existing `map` cases at `:527-549` for the idiom.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts -t "selectionAfter"`
Expected: FAIL — `selectionAfter` does not exist on the result.

- [ ] **Step 3: Change the types**

In `tree/types.ts`, add above `TransactionResult`:

```ts
/** A stored selection as two node anchors (spec D3). Replaces `SelectionRange`. */
export type Anchors = {readonly anchor: NodeAnchor; readonly head: NodeAnchor}
```

Delete `SelectionRange` (:94-100) and change the two result fields:

```ts
	/**
	 * The selection as it stood BEFORE this adoption (spec D7/D3), or `undefined`
	 * when there was none. Captured by `createBoundary`'s `fold`, the single funnel
	 * every live adoption runs through, because adoption mutates stored positions
	 * in place.
	 */
	selectionBefore: Anchors | undefined
	/**
	 * `selectionBefore` carried across this adoption. Resolved INSIDE `adopt`, from
	 * offsets read before the mutating batch — a consumer cannot compute this
	 * itself, because by the time it holds the result the positions have moved
	 * (spec D3). Applying it is the whole of `remap`.
	 */
	selectionAfter: Anchors | undefined
	/** Valid for PRE-adoption offsets only (spec D7). Called by `adopt` alone. */
	map(offset: number): NodeAnchor
```

- [ ] **Step 4: Implement in `adopt`**

Change the signature (`adopt.ts:39-44`) to `selectionBefore?: Anchors`, add
`offsetOfAnchor` to the `./anchors` import, and insert immediately after
`const delta = …` (`:48`) — **above** the `batch` at `:140`:

```ts
		// PRE-MUTATION, and that is the whole of D3: the batch below rewrites node
		// `position` fields in place, so an offset formed after it describes the new
		// coordinate space and `map` would shift it a SECOND time. `prev` is read at
		// :47 and these two lines are the only chance to read the old space.
		const beforeOffsets = selectionBefore && {
			anchor: offsetOfAnchor(prev, selectionBefore.anchor),
			head: offsetOfAnchor(prev, selectionBefore.head),
		}
```

Then after `const map = …` (`:202`):

```ts
		const selectionAfter = beforeOffsets && {
			anchor: map(beforeOffsets.anchor),
			head: map(beforeOffsets.head),
		}
```

and add `selectionAfter` to the returned object.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: PASS. The five existing `map` cases pass **unmodified** — `map` did not
change, which is this phase's own evidence that the semantics did not.

- [ ] **Step 6: Falsify the ordering**

Temporarily move the `beforeOffsets` block below the `batch(…)` call.

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts -t "selectionAfter"`
Expected: **FAIL** — the caret lands at 4 instead of 3.

If it still passes, D3's hazard analysis is wrong and this task's premise is
wrong. Stop and report rather than proceeding. Then restore the block above the
batch.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/tokens/tree/types.ts \
        packages/core/src/features/tokens/tree/adopt.ts \
        packages/core/src/features/tokens/tree/adopt.spec.ts
git commit -m "feat(tokens): resolve the selection channel inside adopt, pre-mutation"
```

---

### Task 12: Capture anchors at the boundary and apply them in `remap`

**Files:**
- Modify: `packages/core/src/features/tokens/tree/valueBoundary.ts:43-50,62-72`
- Modify: `packages/core/src/features/tokens/tree/selection.ts`
- Modify: `packages/core/src/features/tokens/seam/TokenModel.ts:29-34,511`
- Modify: `packages/core/src/features/tokens/tree/valueBoundary.spec.ts:373-396`

- [ ] **Step 1: Change the capture**

In `valueBoundary.ts`, change the dep type and the `fold` capture:

```ts
	/** Pre-adoption selection capture (spec D7/D3), in ANCHORS. */
	selection?: () => Anchors | undefined
```

`fold`'s body is unchanged — `const selectionBefore = deps.selection?.()` already
just forwards whatever it gets.

- [ ] **Step 2: Change `SelectionPort` and the thunk**

In `TokenModel.ts`, `SelectionPort.range()` becomes `anchors()`:

```ts
export interface SelectionPort {
	/** Pre-adoption capture (spec D7/D3), in the TREE's coordinate space. */
	anchors(): Anchors | undefined
	/** Post-adoption repair (spec D7/D3): applies `selectionAfter`. */
	repair(result: TransactionResult): void
}
```

and the boundary dep at `:511` becomes `selection: () => this.selectionPort().anchors()`.

- [ ] **Step 3: Simplify `remap`**

In `tree/selection.ts`, the moved `repair` becomes an application:

```ts
	/**
	 * Post-adoption caret repair (spec D7/D3). `adopt` already resolved the anchors
	 * from pre-mutation offsets, so this applies rather than computes — the
	 * ordering hazard D3 describes is unrepresentable here.
	 */
	repair(result: TransactionResult): void {
		// Unconditional: positions move whether or not there is a selection, and
		// `range` derives from fields no signal covers (spec D3). Retired at S2.6
		// with the derived numeric range.
		generation(generation() + 1)
		const next = result.selectionAfter
		if (!next) return
		select(next.anchor, next.head)
	}
```

- [ ] **Step 4: Update the four boundary assertions**

In `valueBoundary.spec.ts:373-396`, `{start: 2, end: 2}` becomes the anchor pair
the fixture's selection thunk now supplies. Read each case first — three assert a
value and one asserts `undefined`; only the three change.

- [ ] **Step 5: Run the full suite**

Run: `pnpm test && pnpm run typecheck`
Expected: PASS. Watch specifically for `SelectionController.spec`'s cases now
living in `tree/selection.spec.ts` — "maps a caret inside the edited region to
the end of the inserted text" and "captures an 'end' anchor in TREE space, not
against the props value" are the two that would catch a mistake here.

- [ ] **Step 6: Manual verification**

Start the React storybook: `pnpm run dev:sb:react`. In a controlled story, type
in the middle of the text and confirm the caret does not jump forward by an extra
character. Repeat in a story with a mark before the caret.

- [ ] **Step 7: Full gate and commit**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
git add packages/core/src/features
git commit -m "refactor(tokens): capture the selection as anchors across the commit boundary"
```

---

## Why this plan stops at S2.3

S2.4–S2.9 are specified (spec §11) but not planned here, and that is deliberate
rather than an omission:

- **S2.4** rewrites `SelectionDriver.sync`, a file that does not exist until
  Task 9 lands. Its diff depends on how the move actually splits.
- **S2.5** converts eleven consumers onto `anchorFor` + `domAnchors`. Several
  conversions (`OverlayMatch.range`, `rangeForDelete`'s adjacency walk) have open
  questions the spec flags as "to be confirmed" — they are answered by reading
  the code S2.4 produces, not by guessing now.
- **S2.6–S2.9** are deletions and rewirings whose scope is exactly "what has no
  callers left", which is only knowable once S2.5 lands.

Writing steps for them now would mean inventing code and calling it a plan. Plan
the next phase when its input exists — this matches the S1 precedent of per-phase
plans (`docs/tree-core-decisions.md`).

**Before starting S2.4, re-read spec §4.4 and confirm it still describes the
files Task 9 produced.** If the move landed differently, amend the spec first.
