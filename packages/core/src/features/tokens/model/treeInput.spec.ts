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