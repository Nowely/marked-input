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
 * RECORDED GAP (S1.5 Task 6's mutation pass, re-measured at S2.7 when `changes`
 * was deleted). ONE guard is pinned HERE and only here — nothing in
 * treePipeline.spec.ts moves when it is removed — and it is inert BY
 * CONSTRUCTION at pipeline level, not merely untested:
 *
 * - the memo's REUSE. Disabling the cache-hit branch (cache still populated, so
 *   `tokenFor` stays correct) hands the pipeline fresh-but-equal tokens, which
 *   it cannot observe — the payoff is renderer-side object identity for block
 *   layout's `memo(Block)` (see the plan's contradiction 1).
 *   NOT to be confused with swapping `memo.roots(roots)` for a bare
 *   `snapshot(roots)`, which is a real break: `tokens` is the snapshot every
 *   value-slicing consumer reads through `tokens.current()`, and a bare re-parse
 *   loses the reuse that keeps `memo(Block)` from repainting every row.
 *
 * Since S2.7 this lowering emits no content feed at all. `changes` existed to hand
 * each `TokenHandle` the generation the DOM was showing; the DOM now follows the
 * node's own `text` signal through the effect `bind` arms, so the pipeline is fed
 * `{tokens, render, delta}` and nothing else. The cases that pinned `changes` —
 * per-entry `patch` flags, the ancestor and shifted-descendant entries, the
 * order-insensitivity note — are gone or moved: the ancestor case below now asserts
 * against the SNAPSHOT, which is where a missed re-materialization is still visible.
 */
describe('fromTransaction', () => {
	it('routes an interior text edit away from the renderer', () => {
		const {tree, memo} = setup('he#[x]llo')
		const {input} = lower(tree, memo, 'he#[x]llo!')

		expect(input.render).toBe(false)
		expect(input.tokens[2].content).toBe('llo!')
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

	it('re-materializes an ANCESTOR whose own fields never changed and which appears in neither feed', () => {
		// '#[ab]t' → '#[cb]t', snapshotMemo's `sameChildren` fixture at lowering level.
		// The mark is in no adoption feed and does not move, yet its `content` and
		// `slot` both changed — and `render` is false, so nothing republishes the tree
		// afterwards. The memo's child-reference comparison is the only feed that knows,
		// and `tokens` is where a consumer would read the stale answer.
		const {tree, memo} = setup('#[ab]t')
		const {childId} = markAndChildOf(tree)
		const {result, input} = lower(tree, memo, '#[cb]t')

		// The precondition, measured rather than assumed: the mark is in no feed.
		expect(result.updated.map(node => node.id)).toEqual([childId])
		expect(result.shifted).toEqual([])

		expect(input.tokens[1].content).toBe('#[cb]')
		// `delta.updated` stays the child ALONE — the ancestor's projection changed, its
		// own props did not (TokenDelta's per-node rule).
		expect(input.delta.updated).toEqual([childId])
	})

	it('carries a shifted root AND its descendants, each with its own absolute positions', () => {
		// The '@[x](ab)t' fixture again: the child is in neither adoption feed and
		// its delta differs from the root's, so a snapshot that re-materialized only
		// the listed nodes would serve the child on stale positions.
		const {tree, memo} = setup('@[x](ab)t')
		const {input} = lower(tree, memo, '@[xy](ab)t')

		const mark = input.tokens[1]
		expect(mark.type === 'mark' && mark.children[0].position).toEqual({start: 6, end: 8})
	})

	it('lists a node once in `updated` when it is both updated and shifted', () => {
		// Measured: an interior text edit lists the SAME node in `updated` and
		// `shifted` (both content and position moved).
		const {tree, memo} = setup('he#[x]llo')
		const tailId = tree.roots()[2].id
		const {input} = lower(tree, memo, 'he#[x]llo!')

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