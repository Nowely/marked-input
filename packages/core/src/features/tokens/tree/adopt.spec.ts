import {describe, expect, it} from 'vitest'

import {effect} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import {adopt} from './adopt'
import {gapWindow} from './gapWindow'
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
	// Fails by design while the middle region is rebuilt: the edited text node is a fresh
	// object. Same-index pairing (spec §4.2 step 3) retains it and flips this to `it`.
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

	it('retyping identical text inside the window rebuilds it (suffix bound)', () => {
		// Delete 'a' and type 'a' back: the projection is unchanged, so the parse matches the
		// old node exactly. Only `position.start >= window.end` keeps the suffix walk from
		// re-adopting the node the edit destroyed.
		const {tree, result, before} = editAndAdopt('ab', 0, 1, 'a')
		expect(tree.roots()[0].id).not.toBe(before[0].id)
		expect(result.structural).toBe(true)
	})

	it('retyping an identical mark inside the window rebuilds the mark (suffix bound)', () => {
		// Window {2,8} swallows all but the mark's first byte, and the retyped mark is
		// byte-identical under +1 — equality alone would hand the edit its old node back.
		const {tree, result, before} = editAndAdopt('x@[a](m)', 2, 8, '@[a](m)')
		expect(tree.roots()[1].id).not.toBe(before[1].id)
		expect(result.removed).toContain(before[1].id)
	})

	it('shifted lists subtree roots while removed flattens subtrees', () => {
		const source = 'a#[b@[c](d)e]f'

		const shift = editAndAdopt(source, 0, 0, 'XY')
		const shiftedMark = shift.before[1]
		if (shiftedMark.kind !== 'mark') throw new Error('expected mark at index 1')
		// Every in-slot node moved with the mark, and none of them is listed: a consumer
		// refreshing cached positions from `shifted` has to walk children itself.
		expect(shift.result.shifted.map(node => node.id)).toEqual([shift.before[2].id, shiftedMark.id])
		expect(shiftedMark.children().map(node => node.position)).toEqual([
			{start: 5, end: 6},
			{start: 6, end: 13},
			{start: 13, end: 14},
		])
		expect(shiftedMark.slot).toEqual({content: 'b@[c](d)e', start: 5, end: 14})

		const drop = editAndAdopt(source, 1, 13, '')
		const droppedMark = drop.before[1]
		if (droppedMark.kind !== 'mark') throw new Error('expected mark at index 1')
		expect(drop.result.removed).toEqual([
			drop.before[0].id,
			droppedMark.id,
			...droppedMark.children().map(node => node.id),
			drop.before[2].id,
		])
	})

	it('adopting an unchanged value through gapWindow is a no-op', () => {
		// gapWindow pins the empty window at the END of the value, not at 0; adoption must
		// read that as "nothing replaced" — the controlled echo hits this on every keystroke.
		const source = 'a@[b](c)d'
		const tree = createTokenTree(parser.parse(source))
		const before = tree.roots()

		const result = adopt(tree, gapWindow(source, source), parser.parse(source))

		expect(tree.roots().map(node => node.id)).toEqual(before.map(node => node.id))
		expect(result.structural).toBe(false)
		expect(result.added).toEqual([])
		expect(result.removed).toEqual([])
		expect(result.shifted).toEqual([])
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
		// Stands in for a middle-region content write (spec §4.2 step 3): children carry the new
		// slot text while the stored mirror keeps the old one. Retention must follow the
		// children — the mirror is derived state the projection and snapshot ignore.
		child.text('b')
		expect(mark.slot?.content).toBe('a')

		const result = adopt(tree, {start: 5, end: 5, insertedLength: 1}, parser.parse('#[b]xy'))

		expect(tree.roots()[1].id).toBe(mark.id)
		expect(result.removed).not.toContain(mark.id)
	})
})

describe('adopt: untracked reads', () => {
	const source = 'a@[b](c)d'

	it('adopting inside an effect subscribes that effect to nothing', () => {
		// `batch` does not clear the active subscriber, so the comparison reads would
		// otherwise make every compared node a dependency of the calling effect.
		const tree = createTokenTree(parser.parse(source))
		let runs = 0
		const stop = effect(() => {
			runs++
			adopt(tree, gapWindow(source, source), parser.parse(source))
		})
		expect(runs).toBe(1)
		const text = tree.roots()[0]
		if (text.kind !== 'text') throw new Error('expected text at index 0')

		text.text('QQQ')

		expect(runs).toBe(1)
		stop()
	})

	it('calling map inside an effect subscribes that effect to nothing', () => {
		// `map` defers its reads to call time (anchorAt reads `children()`), so the
		// subscriber it can capture is the caller's, not adoption's.
		const tree = createTokenTree(parser.parse(source))
		const {map} = adopt(tree, gapWindow(source, source), parser.parse(source))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected mark at index 1')
		let runs = 0
		const stop = effect(() => {
			runs++
			map(4) // inside the mark
		})
		expect(runs).toBe(1)

		mark.children([])

		expect(runs).toBe(1)
		stop()
	})
})