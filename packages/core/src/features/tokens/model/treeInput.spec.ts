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
 * RECORDED GAP (S1.5 Task 6's mutation pass, re-measured after the
 * `materialized()` cutover). ONE guard is pinned HERE and only here — nothing in
 * treePipeline.spec.ts moves when it is removed — and it is inert BY
 * CONSTRUCTION at pipeline level, not merely untested:
 *
 * - the memo's REUSE. Disabling the cache-hit branch (cache still populated, so
 *   `tokenFor` stays correct) hands the pipeline fresh-but-equal tokens, which
 *   it cannot observe — the payoff is renderer-side object identity for block
 *   layout's `memo(Block)` (see the plan's contradiction 1). Measured: 3
 *   failures, "hands the pipeline the MEMOIZED tokens…" below plus the reuse and
 *   `materialized()` tests in snapshotMemo.spec.ts, and nothing else in 862
 *   tests.
 *   NOT to be confused with swapping `memo.roots(roots)` for a bare
 *   `snapshot(roots)`, which is a real break (measured: 12 failures, 8 of them at
 *   pipeline level): `changes` IS the memo's re-materialized set, so skipping
 *   `roots` feeds the pipeline the previous generation.
 *
 * The `seen` dedupe this block used to record is gone with the feed it guarded:
 * `changes` is built from an id-keyed map, so one entry per node is structural.
 *
 * An ADDED node gets a `patch: false` entry here. That differed from the reconcile
 * lowering S1.6a deleted, which emitted `patch: true`, and the difference was
 * deliberate and unobservable: `changes` is read only by `commitText`, which runs
 * only when `!render`, and an add always sets `render`. Recorded because the entry
 * still looks like an omission to a fresh reader.
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

	it('carries an ANCESTOR whose own fields never changed and which appears in neither feed', () => {
		// '#[ab]t' → '#[cb]t', snapshotMemo's `sameChildren` fixture at lowering level.
		// Deriving `changes` from `updated` + `shifted` emits nothing for the mark, so
		// its handle keeps a `content`/`slot` the DOM no longer shows — and `render` is
		// false, so no bind ever heals it. The memo's re-materialized set is the only
		// feed that knows.
		const {tree, memo} = setup('#[ab]t')
		const {markId, childId} = markAndChildOf(tree)
		const {result, input} = lower(tree, memo, '#[cb]t')

		// The precondition, measured rather than assumed: the mark is in no feed.
		expect(result.updated.map(node => node.id)).toEqual([childId])
		expect(result.shifted).toEqual([])

		const mark = input.changes.find(change => change.id === markId)
		expect(mark?.token.content).toBe('#[cb]')
		// Position-only refresh: `patch` writes the DOM surface and a mark has none
		// (bind.ts:162). `delta.updated` stays the child ALONE — the ancestor's
		// projection changed, its own props did not (TokenDelta's per-node rule).
		expect(mark?.patch).toBe(false)
		expect(input.delta.updated).toEqual([childId])
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