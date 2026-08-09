import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {adopt} from '../tree/adopt'
import {gapWindow} from '../tree/gapWindow'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import type {SnapshotMemo} from '../tree/snapshotMemo'
import {createTokenTree} from '../tree/tree'
import type {TokenTree} from '../tree/tree'
import {fromTransaction} from './treeInput'

const parser = new Parser(['@[__value__](__slot__)', '#[__slot__]'])

function setup(source: string) {
	const tree = createTokenTree(parser.parse(source))
	const memo = createSnapshotMemo()
	memo.roots(tree.roots())
	return {tree, memo}
}

function lower(tree: TokenTree, memo: SnapshotMemo, next: string) {
	const current = tree.value()
	const result = adopt(tree, gapWindow(current, next), parser.parse(next))
	return {result, input: fromTransaction(result, memo, tree.roots())}
}

/** The mark at root index 1 and its first slot child — the shape both nested fixtures parse to. */
function markAndChildOf(tree: TokenTree): {markId: number; childId: number} {
	const mark = tree.roots()[1]
	if (mark.kind !== 'mark') throw new Error('expected a mark node')
	return {markId: mark.id, childId: mark.children()[0].id}
}

/**
 * RECORDED GAPS (S1.5 Task 6's mutation pass). Two guards in `fromTransaction`
 * are pinned HERE and only here — nothing in treePipeline.spec.ts moves when
 * they are removed. Both survivals were measured against the full core suite,
 * and both are inert BY CONSTRUCTION at pipeline level, not merely untested:
 *
 * - the `seen` dedupe. A node listed in both `updated` and `shifted` is pushed
 *   twice without it; the second entry is `patch: false` carrying the SAME
 *   memoized token, so `commitText` does one extra `handle.refresh` with the
 *   value it already holds and writes no DOM. Measured: 1 failure, "emits one
 *   entry per node…" below, and nothing else in 849 tests.
 * - the memo's REUSE. Disabling the cache-hit branch (cache still populated, so
 *   `tokenFor` stays correct) hands the pipeline fresh-but-equal tokens, which
 *   it cannot observe — the payoff is renderer-side object identity for block
 *   layout's `memo(Block)` (see the plan's contradiction 1). Measured: 2
 *   failures, "hands the pipeline the MEMOIZED tokens…" below and the reuse test
 *   in snapshotMemo.spec.ts, and nothing else.
 *   NOT to be confused with swapping `memo.roots(roots)` for a bare
 *   `snapshot(roots)`, which is a real break (measured: 7 failures, 4 of them at
 *   pipeline level): `changes` reads tokens back out of the memo, so skipping
 *   `roots` leaves `tokenFor` serving the previous generation.
 *
 * A third, deliberate difference from `fromReconcile` is NOT a gap: this
 * lowering emits no `changes` entry for an ADDED node. Unreachable dead data on
 * the live path — `changes` is read only by `commitText`, which runs only when
 * `!render`, and an add sets `render` on both lowerings.
 */
describe('fromTransaction', () => {
	it('routes an interior text edit to the text branch', () => {
		const {tree, memo} = setup('he#[x]llo')
		const {input} = lower(tree, memo, 'he#[x]llo!')

		expect(input.render).toBe(false)
		expect(input.changes.filter(change => change.patch).map(change => change.token.content)).toEqual(['llo!'])
	})

	it('routes a mark value change to the RENDER branch even though nothing was added or removed', () => {
		const {tree, memo} = setup('he@[x](s)llo')
		const {result, input} = lower(tree, memo, 'he@[y](s)llo')

		expect(result.structural).toBe(false)
		expect(result.render).toBe(true)
		expect(input.render).toBe(true)
	})

	it('routes an add and a removal to the render branch and reports both ids', () => {
		const {tree, memo} = setup('he#[x]llo')
		const {markId} = markAndChildOf(tree)
		const {input} = lower(tree, memo, 'hello')

		expect(input.render).toBe(true)
		expect(input.delta.removed).toContain(markId)
	})

	it('carries a shifted root AND its descendants, each with its own absolute positions', () => {
		// The '@[x](ab)t' fixture again: the child is in neither adoption feed and
		// its delta differs from the root's, so a lowering that emitted only the
		// listed nodes would leave the child's handle on stale positions.
		const {tree, memo} = setup('@[x](ab)t')
		const {childId} = markAndChildOf(tree)
		const {input} = lower(tree, memo, '@[xy](ab)t')

		const child = input.changes.find(change => change.id === childId)
		expect(child).toBeDefined()
		expect(child?.patch).toBe(false)
		expect(child?.token.position).toEqual({start: 6, end: 8})
	})

	it('emits one entry per node when it is both updated and shifted, and it patches', () => {
		// Measured: an interior text edit lists the SAME node in `updated` and
		// `shifted` (both content and position moved).
		const {tree, memo} = setup('he#[x]llo')
		const tailId = tree.roots()[2].id
		const {input} = lower(tree, memo, 'he#[x]llo!')

		const entries = input.changes.filter(change => change.id === tailId)
		expect(entries).toHaveLength(1)
		expect(entries[0].patch).toBe(true)
		// THE gate on `delta.updated`, and on its granularity: the node moved too,
		// but `shifted` is not a content signal and must not leak in here. Nothing
		// else in the suite reads this list — the live `changed` consumers only read
		// `removed`.
		expect(input.delta).toEqual({added: [], removed: [], updated: [tailId]})
	})

	it('hands the pipeline the MEMOIZED tokens, not fresh ones', () => {
		const {tree, memo} = setup('he#[x]llo')
		const before = memo.tokenFor(tree.roots()[1].id)
		const {input} = lower(tree, memo, 'he#[x]llo!')

		expect(input.tokens[1]).toBe(before)
	})

	it('is order-insensitive: reversing `changes` yields the same node state', () => {
		// DOCUMENTATION, NOT A DEFECT GATE. `shifted` arrives suffix-run-reversed
		// then middle-in-document-order, and nothing depends on that: every entry
		// is an absolute write to a distinct node, and `adopt` pushes each node at
		// most once (the `covered` flag suppresses descendants of an entry). This
		// test cannot fail against the current pipeline; it will fail against any
		// future refresher that applies deltas rather than re-reading positions.
		const {tree, memo} = setup('@[x](ab)t')
		const {input} = lower(tree, memo, '@[xy](ab)t')

		const forward = input.changes.map(change => [change.id, change.token.position] as const)
		// `toReversed()`, not `[...changes].reverse()`: oxlint's
		// `unicorn(no-array-reverse)` warns on the latter and `denyWarnings: true`
		// turns that warning into a failing `lint:check` and a blocked commit.
		const reversed = input.changes.toReversed().map(change => [change.id, change.token.position] as const)
		expect(new Map(reversed)).toEqual(new Map(forward))
	})

	// Sibling of commitInput.spec.ts's identically named block: the two lowerings
	// must agree on granularity or `foldDelta` cannot cancel an add against a
	// later removal.
	describe('the subtree contract (TokenDelta)', () => {
		it('flattens `added`: a born mark contributes its descendant ids too', () => {
			// THE gate on the walk. `TransactionResult.added` carries subtree ROOTS
			// (types.ts:70-71), so emitting `result.added.map(change => change.node.id)`
			// leaves the slot child out — and the reversal below puts that same id in
			// `removed`, which IS flattened.
			const {tree, memo} = setup('tail')
			const {input} = lower(tree, memo, '#[ab]tail')
			const {markId, childId} = markAndChildOf(tree)

			expect(input.delta.added).toEqual(expect.arrayContaining([markId, childId]))
		})

		it('`removed` is subtree-inclusive on the same edit reversed — the two id feeds agree', () => {
			const {tree, memo} = setup('#[ab]tail')
			const {markId, childId} = markAndChildOf(tree)
			const {input} = lower(tree, memo, 'tail')

			expect(input.delta.removed).toEqual(expect.arrayContaining([markId, childId]))
		})
	})
})