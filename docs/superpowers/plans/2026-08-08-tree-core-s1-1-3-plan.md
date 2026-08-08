# Tree Core S1.1–S1.3 Implementation Plan

> **STATUS: EXECUTED (2026-08-09), commits `12ead317..6fbe8e88` on `b0`.**
> This document is kept as the historical record. **Do not treat its code
> blocks as correct** — execution and review found real defects in several of
> them. The shipped behavior is in `packages/core/src/features/tokens/tree/`
> and the spec (`2026-08-08-markput-s1-tree-core-v2.md`) is the design source
> of truth. Notable divergences found while building:
>
> - **Task 5's counterexample is inert.** Deleting the prefix window bound
>   leaves all four of its tests green (the surrounding texts merge, so the
>   walk stops on content anyway). The binding case is `'@[a](m)'`×3 with the
>   middle mark deleted; that test was added during execution.
> - **Task 6's `adoptInto` had a latent bug**: the equal-child-count branch
>   paired without checking `descriptor`, so a mark kept its old descriptor
>   while taking new value/meta — breaking output equivalence. Shipped code
>   uses one gated pairing helper for every sibling list.
> - **Task 7's drafted identity property is false.** It selected nodes via
>   `result.shifted` and asserted `b.start + delta`; a Task 6 fix put
>   middle-region nodes into `shifted` at fresh parser positions (45/500
>   violations). The shipped property re-derives the prefix/suffix runs from
>   two fresh parses instead.
> - **Task 8's `tx` composition had a critical ordering bug** (found in
>   review): sorting by `start` alone let a zero-length op at the same offset
>   move the splice cursor backwards, silently resurrecting or duplicating
>   content while returning `true`. Fixed by breaking ties on `end`.
> - `TokenTree.roots` must be declared `Signal<readonly TreeNode[]>`;
>   `ReturnType<typeof signal<…>>` resolves to `Signal<T | undefined>` and
>   produced 50+ typecheck errors.
> - `MarkNode.slot.content` was dropped entirely (unread mirrored state).
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tree-core foundation — internal node types, TokenTree with
projections, and the adoption + transaction layer — per spec
`2026-08-08-markput-s1-tree-core-v2.md` (v2.1, Reviewed) phases S1.1–S1.3.

**Architecture:** New modules in `packages/core/src/features/tokens/tree/`,
built **alongside** the live pipeline (spec §11 transition mechanics — nothing
existing is modified or deleted; the live path is untouched until S1.6a).
Persistent nodes with signal content; `adopt(tree, window, parsed)` is the one
identity mechanism; transactions lower every edit to a projection splice and
hand `{next, window}` to a CommitSink.

**Tech Stack:** TypeScript, project signal system (`shared/signals`), existing
`Parser`/`annotate`/`createTextToken`, Vitest (+ `@faker-js/faker` for
property specs).

**Prerequisites (blockers for execution, not for plan review):**
- Branch decision: recommended — merge `b0` → `next` first, implement on a
  fresh branch. The rewrite builds on the consolidated token layer living on
  `b0`.
- Spec is the source of truth on any conflict; deviations noted inline:
  (a) no per-node `content: Computed` — content is derived on demand by
  `join`/`snapshot` (spec's intent "derived, never stored" is preserved;
  a stored computed has no consumer in S1.1–S1.3); (b) mark `slot` is a plain
  mutable field like `position` (reactivity granularity for slot reads is an
  S1.7 concern).

**Conventions:** test names imperative-present without "should"; specs next to
source as `*.spec.ts`; `pnpm -w exec vitest run <path>` for focused runs;
conventional-commit messages. Every task ends green (typecheck + focused
tests). **Before every commit run `pnpm run format`** — the plan's snippets
are close to but not byte-identical with oxfmt output, and the husky
pre-commit hook (lint-staged → lint + format) rejects unformatted/unlintable
staged files; formatting first keeps the committed state deterministic.

---

### Task 1 (S1.1): Types & contracts

**Files:**
- Create: `packages/core/src/features/tokens/tree/types.ts`
- Test: `packages/core/src/features/tokens/tree/types.spec.ts`

- [ ] **Step 1: Write the type-level test**

```ts
// packages/core/src/features/tokens/tree/types.spec.ts
import {describe, expectTypeOf, it} from 'vitest'

import type {Token} from '../parser/types'
import type {CommitSink, Id, NodeAnchor, TransactionResult, TreeNode, Window} from './types'

describe('tree contract types', () => {
	it('models the spec §2.3/§4.1 shapes', () => {
		expectTypeOf<Id>().toEqualTypeOf<number>()
		expectTypeOf<Window>().toEqualTypeOf<{start: number; end: number; insertedLength: number}>()
		// NodeAnchor: text offsets, boundary forms, document edges
		const start: NodeAnchor = 'start'
		const end: NodeAnchor = 'end'
		expectTypeOf(start).toMatchTypeOf<NodeAnchor>()
		expectTypeOf(end).toMatchTypeOf<NodeAnchor>()
		// TransactionResult is the single change feed
		expectTypeOf<TransactionResult['removed']>().toEqualTypeOf<Id[]>()
		expectTypeOf<TransactionResult['map']>().toMatchTypeOf<(offset: number) => NodeAnchor>()
		expectTypeOf<CommitSink['commit']>().toMatchTypeOf<(next: string, window: Window) => boolean>()
		// A TreeNode is a TextNode or MarkNode discriminated by `kind`
		expectTypeOf<TreeNode['kind']>().toEqualTypeOf<'text' | 'mark'>()
		// Snapshot mapping speaks parser Token
		expectTypeOf<Token['type']>().toEqualTypeOf<'text' | 'mark'>()
	})
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/types.spec.ts`
Expected: FAIL — `./types` module not found.

- [ ] **Step 3: Implement the types**

```ts
// packages/core/src/features/tokens/tree/types.ts
import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/** Replaced range in the PREVIOUS projection plus inserted length (spec D2). */
export type Window = {start: number; end: number; insertedLength: number}

export type TreeNode = TextNode | MarkNode

/**
 * One structure (spec D11): the same objects flow through adoption and out of
 * the public reads. Signal fields are the reactive read; adoption is the only
 * supported writer — direct setter calls from consumers are unsupported and
 * break the round-trip invariant (documented, not runtime-policed).
 * `position`/`slot` are plain fields written only by adoption (spec D3).
 */
export interface TextNode {
	readonly kind: 'text'
	readonly id: Id
	readonly text: Signal<string>
	position: {start: number; end: number}
}

export interface MarkNode {
	readonly kind: 'mark'
	readonly id: Id
	readonly descriptor: MarkupDescriptor
	readonly value: Signal<string>
	readonly meta: Signal<string | undefined>
	readonly children: Signal<TreeNode[]>
	slot: {content: string; start: number; end: number} | undefined
	position: {start: number; end: number}
}

/** Spec §2.3 addressing model. Mark interiors are addressed via slot text nodes. */
export type NodeAnchor =
	| {node: TextNode; offset: number}
	| {before: TreeNode}
	| {after: TreeNode}
	| 'start'
	| 'end'

/** Spec D9: the single change feed adoption emits. */
export interface TransactionResult {
	structural: boolean
	/** structural OR updated contains a MarkNode — compat snapshot renderer routes on this. */
	render: boolean
	added: {node: TreeNode; path: number[]}[]
	removed: Id[]
	updated: TreeNode[]
	shifted: TreeNode[]
	selectionBefore: {start: number; end: number} | undefined
	/** Valid for PRE-adoption offsets only (spec D7). */
	map(offset: number): NodeAnchor
}

/** Spec D5: transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	commit(next: string, window: Window): boolean
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/types.spec.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/types.ts packages/core/src/features/tokens/tree/types.spec.ts
git commit -m "feat(tree): S1.1 node, anchor, TransactionResult and CommitSink contracts"
```

---

### Task 2 (S1.2): buildTree, createTokenTree, join

**Files:**
- Create: `packages/core/src/features/tokens/tree/tree.ts`
- Test: `packages/core/src/features/tokens/tree/tree.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/features/tokens/tree/tree.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__](__meta__)', '#[__slot__]'])

describe('createTokenTree', () => {
	it('builds nodes mirroring the parsed token stream with fresh ids', () => {
		const tree = createTokenTree(parser.parse('he@[x](m)llo'))
		const roots = tree.roots()
		expect(roots.map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		const ids = roots.map(n => n.id)
		expect(new Set(ids).size).toBe(3)
		expect(roots[0]).toMatchObject({position: {start: 0, end: 2}})
	})

	it('projects the value as the exact source string', () => {
		const source = 'he@[x](m)llo #[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		expect(tree.value()).toBe(source)
	})

	it('value() tracks content-signal writes reactively', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const first = tree.roots()[0]
		if (first.kind !== 'text') throw new Error('expected text root')
		first.text('world')
		expect(tree.value()).toBe('world')
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/tree.spec.ts`
Expected: FAIL — `./tree` not found.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/features/tokens/tree/tree.ts
import type {Computed, Signal} from '../../../shared/signals'
import {computed, signal} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {Id, MarkNode, TextNode, TreeNode} from './types'

export interface TokenTree {
	// NOT ReturnType<typeof signal<...>> — instantiation picks the last overload
	// (Signal<T | undefined>) and poisons every consumer with `| undefined`
	// (proven: 50+ typecheck errors). Spec §4.1 prescribes this exact type.
	readonly roots: Signal<TreeNode[]>
	readonly value: Computed<string>
	/** Internal id allocator — shared by build and adopt so ids never collide. */
	readonly alloc: () => Id
	readonly buildNode: (token: Token) => TreeNode
}

export function createTokenTree(initial: Token[]): TokenTree {
	let nextId = 1
	const alloc = (): Id => nextId++

	const buildNode = (token: Token): TreeNode => {
		if (token.type === 'text') {
			const node: TextNode = {
				kind: 'text',
				id: alloc(),
				text: signal({initial: token.content}),
				position: {...token.position},
			}
			return node
		}
		const node: MarkNode = {
			kind: 'mark',
			id: alloc(),
			descriptor: token.descriptor,
			value: signal({initial: token.value}),
			meta: signal({initial: token.meta}),
			children: signal({initial: token.children.map(buildNode)}),
			slot: token.slot ? {...token.slot} : undefined,
			position: {...token.position},
		}
		return node
	}

	const roots = signal({initial: initial.map(buildNode)})

	const value = computed(() => joinNodes(roots()))

	return {roots, value, alloc, buildNode}
}

/** The string projection: mirrors parser/utils/toString over live nodes. */
export function joinNodes(nodes: readonly TreeNode[]): string {
	let result = ''
	for (const node of nodes) {
		if (node.kind === 'text') {
			result += node.text()
			continue
		}
		const children = node.children()
		const slot = node.descriptor.hasSlot
			? children.length > 0
				? joinNodes(children)
				: node.slot?.content
			: undefined
		result += annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot})
	}
	return result
}
```

Note: `signal({initial: token.meta})` — `initial: undefined` is the
no-initial overload; that is fine, the signal starts `undefined`. If the
signal factory's `Signal<T | undefined>` typing fights `Signal<string |
undefined>` here, use `signal<string | undefined>({initial: token.meta})`
explicitly.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/tree.spec.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/tree.ts packages/core/src/features/tokens/tree/tree.spec.ts
git commit -m "feat(tree): S1.2 TokenTree build and join projection"
```

---

### Task 3 (S1.2): snapshot + round-trip property

**Files:**
- Create: `packages/core/src/features/tokens/tree/snapshot.ts`
- Test: `packages/core/src/features/tokens/tree/snapshot.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/features/tokens/tree/snapshot.spec.ts
import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {annotate} from '../parser/utils/annotate'
import {snapshot, stripIds} from './snapshot'
import {createTokenTree} from './tree'

const markups = ['@[__value__](__meta__)', '#[__slot__]'] as const
const parser = new Parser([...markups])

function randomValue(): string {
	const parts: string[] = []
	for (let i = 0; i < faker.number.int({min: 1, max: 5}); i++) {
		// Single roll, not chained boolean else-ifs — oxlint no-dupe-else-if fires
		// on the duplicated condition text otherwise (denyWarnings: true).
		const roll = faker.number.int({min: 0, max: 2})
		if (roll === 0) {
			parts.push(faker.string.alpha({length: {min: 0, max: 6}}))
		} else if (roll === 1) {
			parts.push(annotate('@[__value__](__meta__)', {value: faker.string.alpha(3), meta: faker.string.alpha(2)}))
		} else {
			parts.push(annotate('#[__slot__]', {slot: faker.string.alpha({length: {min: 0, max: 4}})}))
		}
	}
	return parts.join('')
}

describe('snapshot', () => {
	it('reproduces the parsed token stream (ids stripped), fixture case', () => {
		const source = 'he@[x](m)llo #[a]'
		const parsed = parser.parse(source)
		const tree = createTokenTree(parsed)
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(source)))
	})

	it('round-trips parse(join(tree)) for 200 generated documents', () => {
		for (let i = 0; i < 200; i++) {
			const source = randomValue()
			const tree = createTokenTree(parser.parse(source))
			expect(tree.value()).toBe(source)
			expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(source)))
		}
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/snapshot.spec.ts`
Expected: FAIL — `./snapshot` not found.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/features/tokens/tree/snapshot.ts
import type {MarkToken, TextToken, Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {joinNodes} from './tree'
import type {TreeNode} from './types'

/** Materialize plain Token snapshots (compat read shape). Ids included. */
export function snapshot(nodes: readonly TreeNode[]): Token[] {
	return nodes.map(snapshotNode)
}

function snapshotNode(node: TreeNode): Token {
	if (node.kind === 'text') {
		const token: TextToken = {
			type: 'text',
			content: node.text(),
			position: {...node.position},
			id: node.id,
		}
		return token
	}
	const children = node.children()
	const childTokens = snapshot(children)
	const slotContent = node.descriptor.hasSlot
		? children.length > 0
			? joinNodes(children)
			: node.slot?.content
		: undefined
	const content = annotate(node.descriptor.markup, {
		value: node.value(),
		meta: node.meta(),
		slot: slotContent,
	})
	const token: MarkToken = {
		type: 'mark',
		content,
		position: {...node.position},
		id: node.id,
		descriptor: node.descriptor,
		value: node.value(),
		meta: node.meta(),
		slot: node.slot ? {...node.slot, content: slotContent ?? node.slot.content} : undefined,
		children: childTokens,
	}
	return token
}

/** Deep-comparison helper for the equivalence properties: parsed tokens carry no ids. */
export function stripIds(tokens: readonly Token[]): Token[] {
	return tokens.map(token => {
		const {id: _id, ...rest} = token
		if (rest.type === 'mark') return {...rest, children: stripIds(rest.children)} as Token
		return rest as Token
	})
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/snapshot.spec.ts && pnpm run typecheck`
Expected: PASS. If a generated case fails, the failing `source` string prints
in the assertion diff — minimize and keep it as a named fixture, then fix.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/snapshot.ts packages/core/src/features/tokens/tree/snapshot.spec.ts
git commit -m "feat(tree): S1.2 Token snapshot mapping with round-trip property"
```

---

### Task 4 (S1.3): gapWindow

**Files:**
- Create: `packages/core/src/features/tokens/tree/gapWindow.ts`
- Test: `packages/core/src/features/tokens/tree/gapWindow.spec.ts`

Port of the `hintFromValues` policy (see `tokenIdentity.ts:344-361` on the
current branch — the file still exists until S1.6d). Uses the existing
`findGap` util.

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/features/tokens/tree/gapWindow.spec.ts
import {describe, expect, it} from 'vitest'

import {gapWindow} from './gapWindow'

describe('gapWindow', () => {
	it('derives the replaced range for a middle edit', () => {
		expect(gapWindow('hello', 'heXYllo')).toEqual({start: 2, end: 2, insertedLength: 2})
	})
	it('clamps overlapping prefix/suffix (aa → aaa)', () => {
		expect(gapWindow('aa', 'aaa')).toEqual({start: 2, end: 2, insertedLength: 1})
	})
	it('handles prepend (previous value is a suffix of the next)', () => {
		expect(gapWindow('bc', 'abc')).toEqual({start: 0, end: 0, insertedLength: 1})
	})
	it('handles full replacement', () => {
		expect(gapWindow('abc', 'xyz')).toEqual({start: 0, end: 3, insertedLength: 3})
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/gapWindow.spec.ts`
Expected: FAIL — `./gapWindow` not found.

- [ ] **Step 3: Implement (ported policy, same math as hintFromValues)**

```ts
// packages/core/src/features/tokens/tree/gapWindow.ts
import {findGap} from '../utils/findGap'
import type {Window} from './types'

/**
 * Boundary-reset window: common prefix/suffix of the two projections.
 * findGap contract: `left` = first diverging index (undefined when previous
 * is a prefix of next); `right` = ABSOLUTE exclusive end of the gap in the
 * PREVIOUS value (undefined when previous is a suffix of next).
 */
export function gapWindow(previousValue: string, nextValue: string): Window {
	const gap = findGap(previousValue, nextValue)
	const prefix = gap.left ?? previousValue.length
	const suffix = gap.right === undefined ? previousValue.length : previousValue.length - gap.right
	const clampedSuffix = Math.min(suffix, Math.min(previousValue.length, nextValue.length) - prefix)
	const start = prefix
	const end = previousValue.length - clampedSuffix
	const insertedLength = nextValue.length - clampedSuffix - start
	return {start, end, insertedLength}
}
```

Check the import path: `features/tokens/utils/findGap.ts` (used by
tokenIdentity today) → from `tree/` it is `../utils/findGap`. Verify with
`ls packages/core/src/features/tokens/utils/`. If `gapWindow('aa','aaa')`
disagrees with the test, compare against `hintFromValues('aa','aaa')` in a
scratch — the ported math must match it exactly; the test values above were
derived from that function's clamp comment.

- [ ] **Step 4: Run tests**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/gapWindow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/gapWindow.ts packages/core/src/features/tokens/tree/gapWindow.spec.ts
git commit -m "feat(tree): S1.3 gap-derived adoption window (ported hintFromValues policy)"
```

---

### Task 5 (S1.3): adopt — window-bounded prefix/suffix walks

**Files:**
- Create: `packages/core/src/features/tokens/tree/adopt.ts`
- Test: `packages/core/src/features/tokens/tree/adopt.spec.ts`

The heart. Spec §4.2 is normative — the window bounds on both walks are
load-bearing (the repeated-content counterexample below is the regression
test for the defect the spec verification proved).

- [ ] **Step 1: Write failing tests (incl. the counterexample)**

```ts
// packages/core/src/features/tokens/tree/adopt.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {adopt} from './adopt'
import {snapshot, stripIds} from './snapshot'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__](__meta__)', '#[__slot__]'])

/** Build a tree, apply an exact-window edit, adopt, return {tree, result, before}. */
function editAndAdopt(source: string, start: number, end: number, text: string) {
	const tree = createTokenTree(parser.parse(source))
	const before = tree.roots()
	const next = source.slice(0, start) + text + source.slice(end)
	const result = adopt(tree, {start, end, insertedLength: text.length}, parser.parse(next))
	return {tree, result, before, next}
}

describe('adopt: prefix/suffix walks', () => {
	it('interior text edit retains every node and writes one content signal', () => {
		const {tree, result, before} = editAndAdopt('he@[x](m)llo', 10, 10, 'Z') // inside "llo"
		expect(tree.roots().map(n => n.id)).toEqual(before.map(n => n.id))
		expect(result.structural).toBe(false)
		expect(result.updated.map(n => n.id)).toEqual([before[2].id])
		expect(result.shifted).toEqual([])
	})

	it('suffix nodes shift positions without signal writes', () => {
		const {tree, result, before} = editAndAdopt('he@[x](m)llo', 0, 0, 'AB')
		expect(tree.roots()[1].id).toBe(before[1].id)
		expect(tree.roots()[1].position).toEqual({start: 4, end: 11})
		expect(result.shifted.map(n => n.id)).toContain(before[1].id)
	})

	it('deleting the second of two identical marks removes THAT mark (window bounds)', () => {
		// x@[a](m)x@[a](m)x — tokens: x[0,1] mark[1,8] x[8,9] mark[9,16] x[16,17].
		// Delete exactly the second mark: window {9,16} → 'x@[a](m)xx'.
		const source = 'x@[a](m)x@[a](m)x'
		const {tree, result, before} = editAndAdopt(source, 9, 16, '')
		const after = tree.roots()
		expect(after[0].id).toBe(before[0].id)
		expect(after[1].id).toBe(before[1].id) // first mark survives — NOT the second
		expect(result.removed).toContain(before[3].id) // the second mark is the removed one
		// The two 'x' texts around the deleted mark merge into one 'xx' — a middle-region
		// outcome (identity there is best-effort); output equivalence is the hard assertion:
		expect(stripIds(snapshot(after))).toEqual(stripIds(parser.parse('x@[a](m)xx')))
	})

	it('output equals a fresh parse after any of the above', () => {
		const {tree, next} = editAndAdopt('he@[x](m)llo', 2, 9, '@[y](n)')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(next)))
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: FAIL — `./adopt` not found.

- [ ] **Step 3: Implement adopt (walks + middle stub via rebuild)**

Implement the full skeleton with prefix/suffix walks per spec §4.2; for this
task the middle region is handled by the simplest correct policy — rebuild
(fresh nodes) — refined into pairing/descend in Task 6. Output equivalence
holds already; identity inside the window improves in Task 6.

```ts
// packages/core/src/features/tokens/tree/adopt.ts
import {batch} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {collectIds, shiftPositions, snapshotNodeEquals} from './adoptUtils'
import type {TokenTree} from './tree'
import type {NodeAnchor, TransactionResult, TreeNode, Window} from './types'

export function adopt(tree: TokenTree, window: Window, parsed: Token[]): TransactionResult {
	const prev = tree.roots()
	const delta = window.insertedLength - (window.end - window.start)

	const added: {node: TreeNode; path: number[]}[] = []
	const removed: number[] = []
	const updated: TreeNode[] = []
	const shifted: TreeNode[] = []
	const out: TreeNode[] = []

	batch(() => {
		// 1. Prefix: byte/position-equal AND entirely before the window (spec §4.2 —
		// the window bound is load-bearing on repeated content).
		let p = 0
		while (
			p < prev.length &&
			p < parsed.length &&
			prev[p].position.end <= window.start &&
			snapshotNodeEquals(prev[p], parsed[p], 0)
		) {
			out.push(prev[p])
			p++
		}

		// 2. Suffix: equal under +delta AND entirely after the window.
		let prevTail = prev.length - 1
		let nextTail = parsed.length - 1
		const suffix: TreeNode[] = []
		while (
			prevTail >= p &&
			nextTail >= p &&
			prev[prevTail].position.start >= window.end &&
			snapshotNodeEquals(prev[prevTail], parsed[nextTail], delta)
		) {
			shiftPositions(prev[prevTail], delta)
			if (delta !== 0) shifted.push(prev[prevTail])
			suffix.unshift(prev[prevTail])
			prevTail--
			nextTail--
		}

		// 3. Middle (Task 5 policy: rebuild — refined to pairing in Task 6).
		for (let i = p; i <= nextTail; i++) {
			const node = tree.buildNode(parsed[i])
			added.push({node, path: [i]})
			out.push(node)
		}
		for (let i = p; i <= prevTail; i++) collectIds(prev[i], removed)

		out.push(...suffix)
		tree.roots(out)
	})

	const structural = added.length > 0 || removed.length > 0
	const render = structural || updated.some(n => n.kind === 'mark')

	const map = (offset: number): NodeAnchor => resolveMappedAnchor(out, offset, window, delta)

	return {structural, render, added, removed, updated, shifted, selectionBefore: undefined, map}
}

/** Pre-adoption offset → post-adoption anchor (spec D7). */
function resolveMappedAnchor(roots: readonly TreeNode[], offset: number, window: Window, delta: number): NodeAnchor {
	const mapped =
		offset <= window.start ? offset
		: offset >= window.end ? offset + delta
		: window.start + window.insertedLength
	return anchorAt(roots, mapped)
}

/** Right-affinity resolution: the last text node (document order) containing the offset. */
export function anchorAt(roots: readonly TreeNode[], offset: number): NodeAnchor {
	let best: {node: TreeNode & {kind: 'text'}; local: number} | undefined
	let containing: TreeNode | undefined
	const visit = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			if (node.position.start <= offset && offset <= node.position.end) {
				if (node.kind === 'text') best = {node, local: offset - node.position.start}
				else {
					containing = node
					visit(node.children())
				}
			}
		}
	}
	visit(roots)
	if (best) return {node: best.node, offset: best.local}
	if (containing) return {after: containing}
	return offset <= 0 ? 'start' : 'end'
}
```

```ts
// packages/core/src/features/tokens/tree/adoptUtils.ts  (Create, same task)
import type {Token} from '../parser/types'
import type {TreeNode} from './types'

/** Mirror of tokensEqualShifted over (node, parsed token). */
export function snapshotNodeEquals(node: TreeNode, token: Token, delta: number): boolean {
	if (node.position.start + delta !== token.position.start) return false
	if (node.position.end + delta !== token.position.end) return false
	if (node.kind === 'text') return token.type === 'text' && node.text() === token.content
	if (token.type !== 'mark') return false
	if (node.descriptor !== token.descriptor) return false
	if (node.value() !== token.value || node.meta() !== token.meta) return false
	const children = node.children()
	if (children.length !== token.children.length) return false
	if ((node.slot?.content ?? undefined) !== (token.slot?.content ?? undefined)) return false
	return children.every((child, i) => snapshotNodeEquals(child, token.children[i], delta))
}

/** Recursive position shift for retained suffix nodes (plain field writes). */
export function shiftPositions(node: TreeNode, delta: number): void {
	node.position.start += delta
	node.position.end += delta
	if (node.kind === 'mark') {
		if (node.slot) {
			node.slot.start += delta
			node.slot.end += delta
		}
		for (const child of node.children()) shiftPositions(child, delta)
	}
}

/** Subtree ids for the removed feed. */
export function collectIds(node: TreeNode, bucket: number[]): void {
	bucket.push(node.id)
	if (node.kind === 'mark') for (const child of node.children()) collectIds(child, bucket)
}
```

Note: with the Task 5 rebuild policy, ONLY the first test ('interior text
edit retains…') fails — its middle-region node is rebuilt, not retained. Mark
that one test `it.fails(...)` in this task and flip it to `it(...)` in Task 6.
The suffix-shift, counterexample, and equivalence tests must pass already in
Task 5 (prefix/suffix walks carry them).

- [ ] **Step 4: Run tests**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: PASS (with the one `it.fails` marker documenting Task 6's target —
`it.fails` on a passing test FAILS the suite, so do not mark more than that
one).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/adopt.ts packages/core/src/features/tokens/tree/adoptUtils.ts packages/core/src/features/tokens/tree/adopt.spec.ts
git commit -m "feat(tree): S1.3 adopt skeleton — window-bounded prefix/suffix walks"
```

---

### Task 6 (S1.3): adopt — middle pairing, slot descend, refused-descend children

**Files:**
- Modify: `packages/core/src/features/tokens/tree/adopt.ts` (middle region)
- Test: `packages/core/src/features/tokens/tree/adopt.spec.ts` (extend)

- [ ] **Step 1: Flip the one `it.fails` test to `it` and add descend tests**

```ts
// append to adopt.spec.ts
describe('adopt: middle pairing and descend', () => {
	it('in-slot edit descends: mark and sibling child ids survive, no mark update', () => {
		const source = '#[a @[b](c) d]'
		const {tree, result, before} = editAndAdopt(source, 2, 2, 'X') // edit inside slot text "a "
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected mark')
		const beforeMark = before[1]
		if (beforeMark.kind !== 'mark') throw new Error('expected mark')
		expect(mark.id).toBe(beforeMark.id)
		expect(result.updated.some(n => n.kind === 'mark')).toBe(false) // no mark-level update
		expect(result.render).toBe(false)
	})

	it('inner mark meta change (refused descend at the inner level) keeps outer and sibling identity', () => {
		// Replace the whole mark with same-descriptor mark, different value:
		const source = '#[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		const before = tree.roots()
		const beforeMark = before[1]
		if (beforeMark.kind !== 'mark') throw new Error('expected mark')
		const beforeChildIds = beforeMark.children().map(n => n.id)
		// #[…] has no value gap; use the @-mark inside instead: change its meta via full re-splice
		const next = '#[a @[b](Z) d]'
		const result = adopt(tree, {start: 9, end: 10, insertedLength: 1}, parser.parse(next))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected mark')
		expect(mark.id).toBe(beforeMark.id)
		expect(mark.children().map(n => n.id)).toEqual(beforeChildIds) // children survived
		expect(result.render).toBe(true) // inner mark meta changed → a MarkNode is in updated
	})

	it('same-index text pairing inside the window retains the id with a content write', () => {
		const {tree, result, before} = editAndAdopt('he@[x](m)llo', 10, 10, 'Z')
		expect(tree.roots()[2].id).toBe(before[2].id)
		expect(result.updated.map(n => n.id)).toEqual([before[2].id])
	})

	it('in-slot deletion of one of two identical child marks keeps the survivor id', () => {
		// '#[@[a](m) @[a](m)]': outer slot children [text'', mark, text' ', mark, text''].
		// Deleting the second child mark shrinks the count 5 → 3: the shared-prefix
		// pairing must keep the first child mark's id (regression for the
		// count-mismatch branch — wholesale rebuild would kill it).
		const source = '#[@[a](m) @[a](m)]'
		const tree = createTokenTree(parser.parse(source))
		const outer = tree.roots()[1]
		if (outer.kind !== 'mark') throw new Error('expected mark')
		const firstChildId = outer.children()[1].id
		adopt(tree, {start: 10, end: 17, insertedLength: 0}, parser.parse('#[@[a](m) ]'))
		const after = tree.roots()[1]
		if (after.kind !== 'mark') throw new Error('expected mark')
		expect(after.children()[1].id).toBe(firstChildId)
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('#[@[a](m) ]')))
	})
})
```

- [ ] **Step 2: Run — new tests fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: FAIL on the new describe block (middle region is rebuild).

- [ ] **Step 3: Replace the middle-region loop in `adopt.ts`**

```ts
		// 3. Middle: same-index pairing; marks by descriptor; slot descend per spec §4.2.
		const consumed = new Set<TreeNode>()
		for (let i = p; i <= nextTail; i++) {
			const candidate = i <= prevTail && !consumed.has(prev[i]) ? prev[i] : undefined
			const token = parsed[i]
			if (
				candidate !== undefined &&
				(candidate.kind === 'text'
					? token.type === 'text'
					: token.type === 'mark' && candidate.descriptor === token.descriptor)
			) {
				consumed.add(candidate)
				adoptInto(candidate, token, [i])
				out.push(candidate)
			} else {
				const node = tree.buildNode(token)
				added.push({node, path: [i]})
				out.push(node)
			}
		}
		for (let i = p; i <= prevTail; i++) {
			if (!consumed.has(prev[i])) collectIds(prev[i], removed)
		}
```

with `adoptInto` declared INSIDE `adopt` (it closes over the `tree`,
`added`, `removed`, and `updated` locals — place it right after the local
declarations, before the `batch(...)` call):

```ts
	/** Retain the node, write changed signals, recurse into slots (spec §4.2 step 3). */
	const adoptInto = (node: TreeNode, token: Token, path: number[]): void => {
		node.position.start = token.position.start
		node.position.end = token.position.end
		if (node.kind === 'text') {
			if (token.type !== 'text') throw new Error('adoptInto: kind mismatch')
			if (node.text() !== token.content) {
				node.text(token.content)
				updated.push(node)
			}
			return
		}
		if (token.type !== 'mark') throw new Error('adoptInto: kind mismatch')
		const valueChanged = node.value() !== token.value
		const metaChanged = node.meta() !== token.meta
		const canDescend =
			!valueChanged &&
			!metaChanged &&
			node.slot !== undefined &&
			token.slot !== undefined &&
			node.children().length === token.children.length &&
			node
				.children()
				.every(
					(child, i) =>
						child.kind !== 'mark' ||
						(token.children[i].type === 'mark' && child.descriptor === token.children[i].descriptor)
				)
		if (valueChanged) node.value(token.value)
		if (metaChanged) node.meta(token.meta)
		node.slot = token.slot ? {...token.slot} : undefined
		if (valueChanged || metaChanged) updated.push(node)
		// Children adopt either way (spec: refused descend still adopts children —
		// degenerate index-paired recursion keeps in-slot identity alive).
		const prevKids = node.children()
		const nextKids = token.children
		if (prevKids.length === nextKids.length) {
			prevKids.forEach((child, i) => {
				if (!snapshotNodeEquals(child, nextKids[i], 0)) adoptInto(child, nextKids[i], [...path, i])
				else {
					child.position.start = nextKids[i].position.start
					child.position.end = nextKids[i].position.end
				}
			})
		} else {
			// Child count changed: same-index pairing over the SHARED PREFIX of the
			// two child lists (kind/descriptor match → adoptInto keeps the id),
			// rebuild only the rest — in-slot survivors keep identity (spec §4.2
			// refused-descend recursion; wholesale rebuild here would lose the
			// surviving mark's id on any in-slot deletion, the repeated-content
			// defect class §4.2 step 1 calls load-bearing).
			const kept: TreeNode[] = []
			const shared = Math.min(prevKids.length, nextKids.length)
			for (let i = 0; i < shared; i++) {
				const child = prevKids[i]
				const t = nextKids[i]
				const pairable =
					child.kind === 'text' ? t.type === 'text' : t.type === 'mark' && child.descriptor === t.descriptor
				if (pairable) {
					adoptInto(child, t, [...path, i])
					kept.push(child)
				} else {
					collectIds(child, removed)
					const fresh = tree.buildNode(t)
					added.push({node: fresh, path: [...path, i]})
					kept.push(fresh)
				}
			}
			for (let i = shared; i < prevKids.length; i++) collectIds(prevKids[i], removed)
			for (let i = shared; i < nextKids.length; i++) {
				const fresh = tree.buildNode(nextKids[i])
				added.push({node: fresh, path: [...path, i]})
				kept.push(fresh)
			}
			node.children(kept)
		}
		void canDescend // descend vs refused differ only in reporting granularity here; both recurse
	}
```

Design note (matches spec): descend and refused-descend share the recursion —
the distinction the spec draws is *reporting* (a descended mark is not an
`updated` entry; a refused one is, because its rendered props changed). The
code above reports `updated` only on value/meta change, which implements
exactly that; `canDescend` is kept as a named condition for readability and
the `structural`/`render` derivation stays unchanged.

- [ ] **Step 4: Run all tree tests**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree`
Expected: PASS, including the flipped `it.fails` tests and Task 5's
counterexample.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/adopt.ts packages/core/src/features/tokens/tree/adopt.spec.ts
git commit -m "feat(tree): S1.3 middle pairing with slot descend and refused-descend child adoption"
```

---

### Task 7 (S1.3): property suite

**Files:**
- Test: `packages/core/src/features/tokens/tree/adopt.property.spec.ts`

- [ ] **Step 1: Write the property spec**

Reuse the generator pattern from `tokenIdentity.property.spec.ts` (lines
~380-430 on the current branch: random markup instances, random single edit
`{start, end, insertedLength}` over a generated value). Copy the generator
functions into this spec (the source file dies at S1.6d).

```ts
// packages/core/src/features/tokens/tree/adopt.property.spec.ts
import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {adopt} from './adopt'
import {gapWindow} from './gapWindow'
import {snapshot, stripIds} from './snapshot'
import {createTokenTree} from './tree'
import type {NodeAnchor, TreeNode} from './types'

const ITERATIONS = 500

const parser = new Parser(['@[__value__](__meta__)', '#[__slot__]', '**__value__**'])

function randomDocument(): string {
	const parts: string[] = []
	for (let i = 0; i < faker.number.int({min: 1, max: 6}); i++) {
		const roll = faker.number.int({min: 0, max: 3})
		if (roll === 0) parts.push(faker.string.alpha({length: {min: 0, max: 8}}))
		else if (roll === 1) parts.push(`@[${faker.string.alpha(3)}](${faker.string.alpha(2)})`)
		else if (roll === 2) parts.push(`#[${faker.string.alpha({length: {min: 0, max: 5}})}]`)
		else parts.push(`**${faker.string.alpha(4)}**`)
	}
	return parts.join('')
}

function randomEdit(value: string): {start: number; end: number; text: string} {
	const start = faker.number.int({min: 0, max: value.length})
	const end = faker.number.int({min: start, max: value.length})
	const text = faker.datatype.boolean() ? faker.string.alpha({length: {min: 0, max: 4}}) : ''
	return {start, end, text}
}

describe('adopt properties', () => {
	it('output equivalence: snapshot(tree) deep-equals the parse for any single edit', () => {
		for (let i = 0; i < ITERATIONS; i++) {
			const source = randomDocument()
			const {start, end, text} = randomEdit(source)
			const next = source.slice(0, start) + text + source.slice(end)
			const tree = createTokenTree(parser.parse(source))
			adopt(tree, {start, end, insertedLength: text.length}, parser.parse(next))
			expect(stripIds(snapshot(tree.roots())), `src=${JSON.stringify(source)} edit=${start},${end},${text}`)
				.toEqual(stripIds(parser.parse(next)))
			expect(tree.value(), 'projection').toBe(next)
		}
	})

	it('identity: prefix ids pinned; suffix-walk-retained ids land at +delta', () => {
		// Honesty per spec §4.2/G3: an edit can re-tokenize structure BEHIND the
		// window (e.g. deleting one `*` of a `**` pair); such nodes survive via
		// best-effort middle pairing at fresh parser positions — the +delta claim
		// holds only for nodes the suffix walk actually retained (result.shifted).
		// Mismatches are collected and asserted once (avoids conditional-expect
		// lint warnings and always prints the failing source/edit).
		for (let i = 0; i < ITERATIONS; i++) {
			const source = randomDocument()
			const {start, end, text} = randomEdit(source)
			const next = source.slice(0, start) + text + source.slice(end)
			const tree = createTokenTree(parser.parse(source))
			const before = tree.roots().map(n => ({id: n.id, start: n.position.start, end: n.position.end}))
			const result = adopt(tree, {start, end, insertedLength: text.length}, parser.parse(next))
			const delta = text.length - (end - start)
			const shiftedIds = new Set(result.shifted.map(n => n.id))
			const after = new Map(tree.roots().map(n => [n.id, n.position.start]))
			const mismatches: string[] = []
			for (const b of before) {
				if (b.end < start && after.get(b.id) !== b.start) {
					mismatches.push(`prefix id ${b.id}: at ${after.get(b.id)}, want ${b.start}`)
				}
				if (b.start > end && shiftedIds.has(b.id) && after.get(b.id) !== b.start + delta) {
					mismatches.push(`shifted id ${b.id}: at ${after.get(b.id)}, want ${b.start + delta}`)
				}
			}
			expect(mismatches, `src=${JSON.stringify(source)} edit=${start},${end},${JSON.stringify(text)}`).toEqual([])
		}
	})

	it('map() is total and monotonic over pre-edit offsets', () => {
		const globalPos = (roots: readonly TreeNode[], anchor: NodeAnchor): number => {
			if (anchor === 'start') return 0
			if (anchor === 'end') return roots.length ? roots[roots.length - 1].position.end : 0
			if ('node' in anchor) return anchor.node.position.start + anchor.offset
			if ('before' in anchor) return anchor.before.position.start
			return anchor.after.position.end
		}
		for (let i = 0; i < 100; i++) {
			const source = randomDocument()
			const {start, end, text} = randomEdit(source)
			const next = source.slice(0, start) + text + source.slice(end)
			const tree = createTokenTree(parser.parse(source))
			const result = adopt(tree, {start, end, insertedLength: text.length}, parser.parse(next))
			const roots = tree.roots()
			const mismatches: string[] = []
			let prev = -1
			for (let off = 0; off <= source.length; off++) {
				const pos = globalPos(roots, result.map(off))
				if (pos < 0 || pos > next.length) mismatches.push(`off ${off} → out of range ${pos}`)
				if (pos < prev) mismatches.push(`off ${off} → ${pos} < previous ${prev} (non-monotonic)`)
				prev = pos
			}
			expect(mismatches, `src=${JSON.stringify(source)} edit=${start},${end},${JSON.stringify(text)}`).toEqual([])
		}
	})

	it('gap-vs-exact: snapshots agree for ALL edits; root id sequences agree when the windows select byte-identical spans', () => {
		for (let i = 0; i < ITERATIONS; i++) {
			const source = randomDocument()
			const {start, end, text} = randomEdit(source)
			const next = source.slice(0, start) + text + source.slice(end)
			const exact = createTokenTree(parser.parse(source))
			const exactBefore = new Set(exact.roots().map(n => n.id))
			adopt(exact, {start, end, insertedLength: text.length}, parser.parse(next))
			const gap = createTokenTree(parser.parse(source))
			const gapBefore = new Set(gap.roots().map(n => n.id))
			const g = gapWindow(source, next)
			adopt(gap, g, parser.parse(next))
			const label = `src=${JSON.stringify(source)} edit=${start},${end},${JSON.stringify(text)}`
			expect(stripIds(snapshot(gap.roots())), label).toEqual(stripIds(snapshot(exact.roots())))
			// Spec §7.1 constructive predicate: id-level agreement only when both
			// windows replace and insert byte-identical spans (repeated-content
			// divergence is documented as expected).
			const sameSpans =
				source.slice(start, end) === source.slice(g.start, g.end) &&
				text === next.slice(g.start, g.start + g.insertedLength)
			if (sameSpans) {
				// Ids are tree-local (independent allocators), so compare the DECISION
				// pattern instead: which root indices kept a pre-adoption id vs got a
				// fresh one. Requires capturing pre-adoption id sets before adopt() —
				// move both adopt calls after these captures:
				//   const exactBefore = new Set(exact.roots().map(n => n.id))  // before adopt
				//   const gapBefore = new Set(gap.roots().map(n => n.id))     // before adopt
				const kept = (roots: readonly TreeNode[], beforeIds: Set<number>): string =>
					roots.map(n => (beforeIds.has(n.id) ? 'kept' : 'fresh')).join(',')
				expect(kept(gap.roots(), gapBefore), label).toBe(kept(exact.roots(), exactBefore))
			}
		}
	})
})
```

- [ ] **Step 1b: Port the reconcile fixture groups onto adopt**

`tokenIdentity.spec.ts` (alive until S1.6d) pins today's identity behavior;
spec §4.2 requires its key fixtures ported. Port the following describe
groups into `adopt.spec.ts`, adapting each case mechanically:
`tracker.reconcile(parse(next), hint)` becomes
`adopt(tree, hint, parser.parse(next))` on a tree built from `parse(prev)`;
id assertions read node `.id` instead of stamped token ids; `removedIds`
assertions read `result.removed`.

- from `describe('deep reconcile')` (in-slot descend cases): the nested-mark
  descend case and the grandchild-id case;
- from the refusal cases: refusal-by-descriptor (different markup at same
  index → fresh node) and refusal-by-value/meta with child id inheritance;
- the empty-text alternation case (`no hint derives the window via findGap
  and keeps identity` — adapt with `gapWindow(prev, next)` as the window).

Skip cases that assert `ReconcileResult`-specific shapes (change kinds,
paths) — those encode the OLD output contract that dies with the file; only
identity/removal semantics port.

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: PASS. Any ported case that fails is a REAL adoption divergence
from today's behavior — stop and compare against tokenIdentity's handling
before adjusting either side.

- [ ] **Step 2: Run at high iteration**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.property.spec.ts`
Expected: PASS. Any failure prints the minimized source/edit in the assertion
message — turn each such case into a named fixture in `adopt.spec.ts` before
fixing. The identity property's suffix clause (`after.has(b.id)`) is honest:
a suffix TEXT node adjacent to the window can legitimately merge into the
middle region (spec: identity inside the window is best-effort); the property
pins nodes whose spans stay disjoint.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/tokens/tree/adopt.property.spec.ts
git commit -m "test(tree): S1.3 adoption property gates — equivalence, identity, gap-vs-exact"
```

---

### Task 8 (S1.3): transactions + uncontrolled CommitSink

**Files:**
- Create: `packages/core/src/features/tokens/tree/transactions.ts`
- Test: `packages/core/src/features/tokens/tree/transactions.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/features/tokens/tree/transactions.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {snapshot, stripIds} from './snapshot'
import {createTokenTree} from './tree'
import {createTransactions, createUncontrolledSink} from './transactions'

const parser = new Parser(['@[__value__](__meta__)'])

function setup(source: string, readOnly = false) {
	const tree = createTokenTree(parser.parse(source))
	const sink = createUncontrolledSink({tree, parser: () => parser})
	const tx = createTransactions({tree, readOnly: () => readOnly, sink})
	return {tree, tx}
}

describe('transactions', () => {
	it('applyRange splices and commits through the sink', () => {
		const {tree, tx} = setup('hello')
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(tree.value()).toBe('hXYlo')
	})

	it('applyText resolves node-local coordinates', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const tail = tree.roots()[2]
		if (tail.kind !== 'text') throw new Error('expected text')
		expect(tx.applyText(tail, {start: 1, end: 1}, 'Z')).toBe(true)
		expect(tree.value()).toBe('he@[x](m)lZlo')
	})

	it('rejects readOnly before any mutation', () => {
		const {tree, tx} = setup('hello', true)
		expect(tx.applyRange({start: 0, end: 5, insertedLength: 0}, 'x')).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('rejects an out-of-bounds range', () => {
		const {tree, tx} = setup('hello')
		expect(tx.applyRange({start: 3, end: 99, insertedLength: 0}, 'x')).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('rejects a dead node in applyText', () => {
		// NOTE: a root text node at index 0 can never die under whole-value
		// replacement — the parser always emits a leading text token and middle
		// pairing retains it (proven during plan verification). Kill a TAIL node:
		const {tree, tx} = setup('he@[x](m)llo')
		const node = tree.roots()[2] // text 'llo'
		if (node.kind !== 'text') throw new Error('expected text')
		tx.applyRange({start: 0, end: 12, insertedLength: 0}, 'x') // parses to ONE text token → mark + tail removed
		expect(tx.applyText(node, {start: 0, end: 0}, 'x')).toBe(false)
	})

	it('tx() batches two disjoint ops into one commit and one adoption', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		let commits = 0
		tx.onResult(() => commits++)
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
			tx.applyRange({start: 9, end: 12, insertedLength: 0}, 'B') // "llo" → "B", original coords
		})
		expect(ok).toBe(true)
		expect(tree.value()).toBe('Ahe@[x](m)B')
		expect(commits).toBe(1)
	})

	it('tx() rejects overlapping ops atomically', () => {
		const {tree, tx} = setup('hello')
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 3, insertedLength: 0}, 'x')
			tx.applyRange({start: 2, end: 4, insertedLength: 0}, 'y')
		})
		expect(ok).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('throws on re-entrant dispatch', () => {
		const {tx} = setup('hello')
		tx.onResult(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x'))
		expect(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'y')).toThrow('re-entrant')
	})

	it('tx() keeps ids outside the hull stable (multi-op identity)', () => {
		const {tree, tx} = setup('aa@[x](m)bb@[y](n)cc')
		const before = tree.roots().map(n => n.id)
		tx.tx(() => {
			tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z') // inside 'aa'
			tx.applyRange({start: 10, end: 11, insertedLength: 0}, 'W') // inside 'bb'
		})
		// hull = {0,11}; the second mark and tail 'cc' lie outside → same ids
		const after = tree.roots().map(n => n.id)
		expect(after[3]).toBe(before[3]) // @[y](n)
		expect(after[4]).toBe(before[4]) // 'cc'
	})

	it('the transaction result equals a fresh parse (equivalence through the verb layer)', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		tx.applyRange({start: 2, end: 9, insertedLength: 0}, '')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('hello')))
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/transactions.spec.ts`
Expected: FAIL — `./transactions` not found.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/features/tokens/tree/transactions.ts
import type {Parser} from '../parser/Parser'
import {createTextToken} from '../parser/utils/createTextToken'
import {adopt} from './adopt'
import type {TokenTree} from './tree'
import type {CommitSink, TextNode, TransactionResult, TreeNode, Window} from './types'

export function createUncontrolledSink(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	onResult?: (result: TransactionResult) => void
}): CommitSink & {onResult(cb: (result: TransactionResult) => void): void} {
	let cb = deps.onResult
	return {
		onResult(fn) {
			cb = fn
		},
		commit(next, window) {
			const parser = deps.parser()
			const parsed = parser ? parser.parse(next) : [createTextToken(next)]
			const result = adopt(deps.tree, window, parsed)
			cb?.(result)
			return true
		},
	}
}

type Op = {window: Window; text: string}

export function createTransactions(deps: {
	tree: TokenTree
	readOnly: () => boolean
	// The optional onResult is typed here (not cast at the call site) — oxlint's
	// no-unsafe-type-assertion is error-level and not overridable.
	sink: CommitSink & {onResult?(fn: (r: TransactionResult) => void): void}
}) {
	let dispatching = false
	let buffer: Op[] | undefined
	let resultCb: ((r: TransactionResult) => void) | undefined

	const currentValue = (): string => deps.tree.value()

	const contains = (node: TreeNode): boolean => {
		const walk = (nodes: readonly TreeNode[]): boolean =>
			nodes.some(n => n === node || (n.kind === 'mark' && walk(n.children())))
		return walk(deps.tree.roots())
	}

	const dispatch = (ops: Op[]): boolean => {
		if (dispatching) throw new Error('re-entrant transaction dispatch')
		if (deps.readOnly()) return false
		const value = currentValue()
		for (const op of ops) {
			if (op.window.start < 0 || op.window.end < op.window.start || op.window.end > value.length) return false
		}
		// Overlap check in original coordinates (tx composition, spec D5).
		const sorted = ops.toSorted((a, b) => a.window.start - b.window.start)
		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i].window.start < sorted[i - 1].window.end) return false
		}
		// Compose next + hull window.
		let next = ''
		let cursor = 0
		for (const op of sorted) {
			next += value.slice(cursor, op.window.start) + op.text
			cursor = op.window.end
		}
		next += value.slice(cursor)
		const hullStart = sorted[0].window.start
		const hullEnd = sorted[sorted.length - 1].window.end
		const inserted = hullEnd - hullStart + (next.length - value.length)
		dispatching = true
		try {
			return deps.sink.commit(next, {start: hullStart, end: hullEnd, insertedLength: inserted})
		} finally {
			dispatching = false
		}
	}

	const submit = (op: Op): boolean => {
		if (buffer) {
			buffer.push(op)
			return true // validated at tx end, atomically
		}
		return dispatch([op])
	}

	return {
		onResult(cb: (r: TransactionResult) => void) {
			resultCb = cb
			deps.sink.onResult?.(r => resultCb?.(r))
		},
		applyRange(window: Window, text: string): boolean {
			return submit({window: {...window, insertedLength: text.length}, text})
		},
		applyText(node: TextNode, localRange: {start: number; end: number}, text: string): boolean {
			if (!contains(node)) return false
			const length = node.text().length
			if (localRange.start < 0 || localRange.end < localRange.start || localRange.end > length) return false
			const start = node.position.start + localRange.start
			const end = node.position.start + localRange.end
			return submit({window: {start, end, insertedLength: text.length}, text})
		},
		applyStructural(target: TreeNode, replacement: string): boolean {
			if (!contains(target)) return false
			const {start, end} = target.position
			return submit({window: {start, end, insertedLength: replacement.length}, text: replacement})
		},
		tx(fn: () => void): boolean {
			if (buffer) return false // no nested tx
			buffer = []
			try {
				fn()
				const ops = buffer
				buffer = undefined
				if (ops.length === 0) return true
				return dispatch(ops)
			} finally {
				buffer = undefined
			}
		},
	}
}
```

- [ ] **Step 4: Run all tree tests + typecheck + lint**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree && pnpm run typecheck && pnpm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/tree/transactions.ts packages/core/src/features/tokens/tree/transactions.spec.ts
git commit -m "feat(tree): S1.3 transactions over applyRange with tx buffer and uncontrolled CommitSink"
```

---

### Task 9: Phase gates & wrap-up

- [ ] **Step 1: Full focused suite one more time**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree`
Expected: all green, property specs at ITERATIONS=500.

- [ ] **Step 2: Whole-repo checks**

Run: `pnpm run format && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`
Expected: PASS. Format churn is expected ONLY in the new `tree/` directory
(the plan's snippets are near-oxfmt, not byte-exact). Any failure or diff in
an EXISTING file means the plan's "alongside, untouched" invariant was
violated — investigate before proceeding.

- [ ] **Step 3: Hand-verification per spec S1.3**

Manually run (scratch spec or REPL) and eyeball:
- repeated-content deletion `x@[a](m)x@[a](m)x` minus the second mark;
- edit completing a far-opened construct (type the closing `]` of an `@[x`
  opened earlier);
- **mark break**: delete a delimiter inside a mark (e.g. the `(` of
  `@[a](m)`) so it decomposes into text — ids/output verified (this is the
  regime where adoption re-tokenizes behind the window; see the identity
  property's honesty note);
- in-slot edit (descend), mark meta change (refused descend keeps child ids);
- cross-node `applyRange` spanning a mark;
- `tx` with two disjoint ops.

- [ ] **Step 4: Commit any test fixtures added during hand-verification**

```bash
git add -A packages/core/src/features/tokens/tree
git commit -m "test(tree): fixtures from S1.3 hand-verification"
```

---

## Self-review notes (spec → plan)

- S1.1 contracts: types.ts covers TreeNode/Window/NodeAnchor/TransactionResult/
  CommitSink + §2.3-as-types (public verb signatures land with the API phase,
  not here — S1.1's scope line "public API as type declarations" is satisfied
  by NodeAnchor/TransactionResult; MarkputApi types are deliberately deferred
  to S1.7 where their host exists. Deviation noted). **OverlayState** (also
  in S1.1's scope line) is deferred to S1.6a with the overlay wiring —
  nothing in S1.2–S1.5 consumes it. Deviation noted.
- S1.2 "memoized snapshot mapping": Task 3's snapshot is pure/unmemoized;
  the per-node reuse semantics (D9) land with their consumer in S1.5.
  Deviation noted — S1.5 planning must budget it.
- S1.2: build, join, snapshot, round-trip property, alternation is implied by
  parser output (explicit dev assertion deferred until a splice path other
  than the parser exists — none in S1.1–S1.3).
- S1.3: window-bounded walks (Task 5 counterexample), middle pairing + descend
  + refused-descend children (Task 6), property gates (Task 7: equivalence,
  identity-outside-window, gap-vs-exact), verbs + tx + guards + sink (Task 8).
  `selectionBefore` stays `undefined` until Store wiring (S1.6a) — the field
  exists, the capture hook does not (spec D7 assigns capture to the
  dispatcher wiring, which is out of S1.3 scope).
- Not in this plan (later phases): boundary/`lastEmitted` (S1.4), pipeline
  `TransactionResult` consumption (S1.5), all wiring/deletions (S1.6x),
  public API exports (S1.7).
