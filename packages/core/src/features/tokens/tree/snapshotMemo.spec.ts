import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {MarkToken, Token} from '../parser/types'
import {adopt} from './adopt'
import {gapWindow} from './gapWindow'
import {stripIds} from './snapshot'
import {createSnapshotMemo} from './snapshotMemo'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__](__slot__)', '#[__slot__]', '!__value__!'])

function setup(source: string) {
	const tree = createTokenTree(parser.parse(source))
	const memo = createSnapshotMemo()
	return {tree, memo, first: memo.roots(tree.roots())}
}

function edit(tree: ReturnType<typeof createTokenTree>, memo: ReturnType<typeof createSnapshotMemo>, next: string) {
	const current = tree.value()
	const result = adopt(tree, gapWindow(current, next), parser.parse(next))
	memo.invalidate(result)
	return memo.roots(tree.roots())
}

const asMark = (token: Token): MarkToken => {
	if (token.type !== 'mark') throw new Error('expected a mark token')
	return token
}

/**
 * MUTATION RECORD (S1.5 Task 6; re-measured at S2.7, when `materialized()` lost its
 * consumer and was deleted with it — the pipeline no longer replays token content,
 * so the memo's only reader is the published snapshot). Every guard in
 * `snapshotMemo.ts` was removed and the full core suite re-run; each line below is
 * the measured kill, so a future edit can tell a load-bearing assertion from a
 * decorative one:
 *
 * - `shifted` walked as roots only, no subtree → 4 kills (the descendant test
 *   and the deep-equal run here, plus both descendant tests in `seam/`).
 * - `sameChildren` dropped from the cache-hit condition → 3 kills: the ancestor
 *   test here, plus the ancestor cases in `seam/` (`treeInput.spec.ts` and
 *   `treePipeline.spec.ts`'s length-preserving in-slot edit). The consequence it
 *   guards is a STALE `tokens.current()`: `render` is false for that edit, so no
 *   re-render republishes the tree and every value-slicing consumer reads the mark's
 *   old `content`/`slot`. The deep-equal run below still does NOT catch it — it
 *   contains no length-preserving in-slot edit, so every ancestor in it is in
 *   `shifted`.
 * - `removed` eviction skipped → 1 kill, the eviction test.
 * - `dirty.clear()` dropped → 1 kill, the second-edit half of the first test
 *   (`third[4]).toBe(after[4]`). Without that half the mutation survives the entire
 *   suite while silently disabling all reuse after the first edit.
 */
describe('createSnapshotMemo', () => {
	it('reuses the token of every untouched node, and KEEPS reusing across a second edit', () => {
		// A TAIL edit, deliberately: it is the only shape that leaves earlier roots
		// out of both feeds. Measured on '!__value__!' with 'a!x!b!y!c' →
		// 'a!x!b!y!cc': window {9,9,1}, `updated` = [text#5], `shifted` = [text#5].
		//
		// An earlier draft used the HEAD insert 'a!x!b!y!c' → 'aa!x!b!y!c' and
		// asserted the four later roots were reused. That is not just unmeasured,
		// it is BACKWARDS: measured, the head insert gives `shifted` =
		// [text#5, mark#4, text#3, mark#2, text#1] — every root moved, so every
		// root is dirty, and a memo that handed the old objects back would be
		// serving STALE POSITIONS. Do not restore it.
		const {tree, memo, first} = setup('a!x!b!y!c')
		const after = edit(tree, memo, 'a!x!b!y!cc')

		expect(after[4]).not.toBe(first[4]) // the edited tail
		expect(after[0]).toBe(first[0])
		expect(after[1]).toBe(first[1])
		expect(after[2]).toBe(first[2])
		expect(after[3]).toBe(first[3])

		// SECOND edit, and this half is what makes `dirty.clear()` load-bearing.
		// Measured on 'a!x!b!y!cc' → 'a!x!B!y!cc' (length-preserving, so the suffix
		// walk shifts nothing): window {4,5,1}, `updated` = [text#3], `shifted` =
		// empty. With the clear, text#5 is clean and is reused. WITHOUT it, `dirty`
		// still holds text#5 from the first edit and text#5 re-materializes — the
		// memo stays CORRECT but stops reusing anything it has ever touched, which
		// is precisely the regression it exists to prevent (block layout's
		// memo(Block) keys on token identity). Every other test here does at most
		// one edit or compares deep equality, so this assertion is the only gate.
		const third = edit(tree, memo, 'a!x!B!y!cc')

		expect(third[2]).not.toBe(after[2]) // the newly edited text
		expect(third[4]).toBe(after[4]) // dirtied by edit 1, untouched by edit 2
		expect(third[0]).toBe(after[0])
		expect(third[1]).toBe(after[1])
		expect(third[3]).toBe(after[3])
	})

	it('re-reads DESCENDANT positions of a shifted root instead of applying its delta', () => {
		// Measured on '@[x](ab)t' → '@[xy](ab)t': the mark moves [0,8]→[0,9]
		// (start delta 0) while its slot child moves [5,7]→[6,8] (start delta +1),
		// and the child appears in NEITHER `updated` nor `shifted`. Dirtying only
		// the listed ids returns the child cached at [5,7].
		const {tree, memo} = setup('@[x](ab)t')
		const after = edit(tree, memo, '@[xy](ab)t')

		const mark = asMark(after[1])
		expect(mark.position).toEqual({start: 0, end: 9})
		expect(mark.children[0].position).toEqual({start: 6, end: 8})
	})

	it('re-materializes an ANCESTOR whose own fields never changed', () => {
		// Measured on '#[ab]t' → '#[cb]t': `updated` is the CHILD only, `shifted`
		// is empty, the mark's position is unchanged at [0,5] — yet its `content`
		// and `slot.content` both changed. TreeNode has no parent link, so only
		// child-reference comparison can invalidate it.
		const {tree, memo, first} = setup('#[ab]t')
		const after = edit(tree, memo, '#[cb]t')

		const mark = asMark(after[1])
		expect(mark).not.toBe(first[1])
		expect(mark.content).toBe('#[cb]')
		expect(mark.slot?.content).toBe('cb')
		expect(mark.position).toEqual({start: 0, end: 5})
	})

	it('stays deep-equal to a fresh parse after a run of edits (the §7.1 invariant, memoized)', () => {
		const {tree, memo} = setup('a#[bc]d@[x](e)f')
		for (const next of ['a#[bc]d@[x](e)ff', 'a#[bXc]d@[x](e)ff', 'a#[bXc]d@[y](e)ff', 'a#[bXc]dff']) {
			const tokens = edit(tree, memo, next)
			expect(stripIds(tokens)).toEqual(parser.parse(next))
		}
	})

	it('evicts removed ids so a long-lived memo does not grow without bound', () => {
		const {tree, memo} = setup('a#[bc]d')
		const markId = tree.roots()[1].id
		expect(memo.tokenFor(markId)).toBeDefined()

		edit(tree, memo, 'ad')

		expect(memo.tokenFor(markId)).toBeUndefined()
	})

	it('tokenFor answers for every live node after roots()', () => {
		const {tree, memo, first} = setup('a#[bc]d')
		const mark = asMark(first[1])
		expect(memo.tokenFor(tree.roots()[1].id)).toBe(mark)
		expect(memo.tokenFor(mark.children[0].id!)).toBe(mark.children[0])
	})
})