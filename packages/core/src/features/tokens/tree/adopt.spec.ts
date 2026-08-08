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
	// Fails by design in S1.3 Task 5: the middle region is rebuilt, so the edited text
	// node is a fresh object. Task 6's same-index pairing retains it and flips this to `it`.
	it.fails('interior text edit retains every node and writes one content signal', () => {
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

	it('deleting the middle of three identical marks keeps the marks outside the window', () => {
		// '@[a](m)' x3 — tokens: ''[0,0] M[0,7] ''[7,7] M[7,14] ''[14,14] M[14,21] ''[21,21].
		// Delete exactly the middle mark: window {7,14} → '@[a](m)@[a](m)'. The result repeats
		// with the deleted mark's own period, so every prefix index still byte- and
		// position-matches; without the `position.end <= window.start` bound the walk runs
		// straight through the deleted mark and removes the THIRD one instead (AC-3.1).
		const source = '@[a](m)@[a](m)@[a](m)'
		const {tree, result, before} = editAndAdopt(source, 7, 14, '')
		const after = tree.roots()
		expect(after[1].id).toBe(before[1].id) // first mark: prefix walk
		expect(after[3].id).toBe(before[5].id) // third mark: suffix walk
		expect(result.removed).toContain(before[3].id)
		expect(result.removed).not.toContain(before[1].id)
		expect(result.removed).not.toContain(before[5].id)
		expect(stripIds(snapshot(after))).toEqual(stripIds(parser.parse('@[a](m)@[a](m)')))
	})

	it('output equals a fresh parse after any of the above', () => {
		const {tree, next} = editAndAdopt('he@[x](m)llo', 2, 9, '@[y](n)')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(next)))
	})

	it('retains a mark whose stored slot mirror went stale', () => {
		const tree = createTokenTree(parser.parse('#[a]x'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected mark at index 1')
		const child = mark.children()[0]
		if (child.kind !== 'text') throw new Error('expected text child')
		// Stands in for a middle-region content write (Task 6): children carry the new
		// slot text while the stored mirror keeps the old one. Retention must follow the
		// children — the mirror is derived state the projection and snapshot ignore.
		child.text('b')
		expect(mark.slot?.content).toBe('a')

		const result = adopt(tree, {start: 5, end: 5, insertedLength: 1}, parser.parse('#[b]xy'))

		expect(tree.roots()[1].id).toBe(mark.id)
		expect(result.removed).not.toContain(mark.id)
	})
})