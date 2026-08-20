import {describe, expect, it} from 'vitest'

import {effect} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {offsetOfAnchor} from './anchors'
import {gapWindow} from './gapWindow'
import {createTokenTree} from './tree'
import type {Anchors, MarkNode, NodeAnchor, TextNode, TransactionResult, TreeNode} from './types'

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
	})

	it('suffix nodes shift positions without signal writes', () => {
		const {tree, before} = editAndAdopt('he@[x](m)llo', 0, 0, 'AB')
		expect(tree.roots()[1].id).toBe(before[1].id)
		expect(tree.roots()[1].position).toEqual({start: 4, end: 11})
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

	it('retyping identical content inside the window keeps the node (middle pairing)', () => {
		// Both walks refuse: the text straddles the window, the mark starts inside it. So
		// both land in the middle region, where same-index pairing retains by design —
		// §4.2 step 3 is best-effort continuity and §7.1 gates identity only OUTSIDE the
		// window. The suffix bound still refuses these; it just no longer decides the
		// outcome, because pairing reaches the same node from the other side.
		const text = editAndAdopt('ab', 0, 1, 'a') // delete 'a', type 'a' back
		expect(text.tree.roots()[0].id).toBe(text.before[0].id)
		expect(text.result.structural).toBe(false)

		const mark = editAndAdopt('x@[a](m)', 2, 8, '@[a](m)') // window swallows all but '@'
		expect(mark.tree.roots()[1].id).toBe(mark.before[1].id)
		expect(mark.result.removed).toEqual([])
	})

	it('deleting across the first two of three identical marks kills the second (suffix bound)', () => {
		// Window {1,8} eats the tail of the first mark and the head of the second, so
		// neither may be retained by a walk; the third is outside and returns via the
		// suffix walk, then middle pairing hands the one surviving mark token to the FIRST
		// mark. Drop `position.start >= window.end` and the suffix walk keeps walking: the
		// SECOND mark is byte-identical under +delta, so it is retained and the first
		// becomes the removal — AC-3.1's repeated-content defect mirrored onto the suffix.
		//
		// THE ONLY GATE ON THAT BOUND. adopt.property.spec.ts states identity one-sidedly
		// (adoption retains AT LEAST the reference runs), so a walk over-running into the
		// window is invisible there: dropping the bound leaves all five properties green
		// at 6000 iterations. Do not retire this fixture as "covered by the properties".
		const source = '@[a](m)@[a](m)@[a](m)'
		const {tree, result, before} = editAndAdopt(source, 1, 8, '')
		expect(tree.roots()[1].id).toBe(before[1].id)
		expect(result.removed).toContain(before[3].id)
		expect(result.removed).not.toContain(before[1].id)
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('@[a](m)@[a](m)')))
	})

	it('a suffix shift moves every descendant position while removed flattens subtrees', () => {
		const source = 'a#[b@[c](d)e]f'

		const shift = editAndAdopt(source, 0, 0, 'XY')
		const shiftedMark = shift.before[1]
		if (shiftedMark.kind !== 'mark') throw new Error('expected mark at index 1')
		// The suffix walk shifts the retained mark by +2, and every node under it with it:
		// positions are plain field writes, so a consumer that cached them must re-read the
		// whole subtree.
		expect(shiftedMark.children().map(node => node.position)).toEqual([
			{start: 5, end: 6},
			{start: 6, end: 13},
			{start: 13, end: 14},
		])
		expect(shiftedMark.slotRange).toEqual({start: 5, end: 14})

		const drop = editAndAdopt(source, 1, 13, '')
		const droppedMark = drop.before[1]
		if (droppedMark.kind !== 'mark') throw new Error('expected mark at index 1')
		// The leading 'a' is absent on purpose: it ends exactly at the window start, so
		// middle pairing keeps it across the merge into 'af' (§7.1 identity outside the
		// window). Everything the window swallowed is listed, subtree-flattened.
		expect(drop.result.removed).toEqual([
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
		// Adoption rebuilds the root list every time and signals compare by reference, so an
		// unguarded `roots` write would wake every subscriber on a pure echo.
		let runs = 0
		const stop = effect(() => {
			runs++
			tree.roots()
		})

		const result = adopt(tree, gapWindow(source, source), parser.parse(source))

		expect(runs).toBe(1)
		expect(tree.roots().map(node => node.id)).toEqual(before.map(node => node.id))
		expect(result.structural).toBe(false)
		expect(result.added).toEqual([])
		expect(result.removed).toEqual([])
		stop()
	})

	it('output equals a fresh parse after any of the above', () => {
		const {tree, next} = editAndAdopt('he@[x](m)llo', 2, 9, '@[y](n)')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(next)))
	})
})

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
		const source = '#[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		const before = tree.roots()
		const beforeMark = before[1]
		if (beforeMark.kind !== 'mark') throw new Error('expected mark')
		const beforeChildIds = beforeMark.children().map(n => n.id)
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

	it('middle-region pairing rewrites the positions of the retained nodes', () => {
		// The pairing arms write `position` as a plain field, and an in-slot insertion moves
		// the retained ancestor AND the sibling that follows it: the outer mark grows
		// [0,14] → [0,15] while the inner mark slides [4,11] → [5,12].
		const {before} = editAndAdopt('#[a @[b](c) d]', 3, 3, 'X')
		const outer = before[1]
		if (outer.kind !== 'mark') throw new Error('expected mark')
		const inner = outer.children()[1]

		expect(outer.position).toEqual({start: 0, end: 15})
		expect(inner.position).toEqual({start: 5, end: 12})
	})

	it('rebuilds a mark whose descriptor changed at the same index', () => {
		// `descriptor` is readonly, so a loosened pairing gate would retain the mark under its
		// old markup and `snapshot`/`join` would re-annotate with it — the projection becomes
		// 'ab@[]()cd', wrong markup and slot dropped, with no other symptom.
		const {tree, result, before} = editAndAdopt('ab@[x](m)cd', 2, 9, '#[q]')
		const mark = tree.roots()[1]

		expect(mark.id).not.toBe(before[1].id)
		expect(result.added.map(change => [change.node.id, change.path])).toEqual([[mark.id, [1]]])
		expect(result.removed).toEqual([before[1].id])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('ab#[q]cd')))
	})

	it('an in-slot keystroke writes the child content signal, not the slot children list', () => {
		// One keystroke = one signal write. `adoptSiblings` returns a fresh array every call
		// and signals compare by reference, so an unguarded write wakes every subscriber of
		// an untouched slot.
		const tree = createTokenTree(parser.parse('#[a @[b](c) d]'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected mark')
		const child = mark.children()[0]
		if (child.kind !== 'text') throw new Error('expected text child')
		let listRuns = 0
		let textRuns = 0
		const stopList = effect(() => {
			listRuns++
			mark.children()
		})
		const stopText = effect(() => {
			textRuns++
			child.text()
		})

		adopt(tree, {start: 3, end: 3, insertedLength: 1}, parser.parse('#[aX @[b](c) d]'))

		expect(listRuns).toBe(1)
		expect(textRuns).toBe(2)
		stopList()
		stopText()
	})

	it('in-slot deletion of one of two identical child marks keeps the survivor id', () => {
		// '#[@[a](m) @[a](m)]': outer slot children [text'', mark, text' ', mark, text''].
		// Deleting the second child mark shrinks the count 5 → 3, and same-index pairing
		// still has to hand the first three tokens to the first three children. Rebuilding
		// the child list wholesale on a count change — the obvious shortcut — kills the
		// survivor's id, and this is the only test that catches it.
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

	it('in-slot deletion of the FIRST of two identical child marks kills the wrong sibling', () => {
		// PINS A KNOWN-IMPERFECT OUTCOME, mirroring the test above. §4.2's gap-derived
		// slot-local window is not implemented, so the slot recursion is unbounded index
		// pairing with no bound to refuse the wrong repeat: deleting the FIRST inner mark
		// retains it and removes the SECOND, and ' tail' at [17,22] — entirely past
		// window.end = 9 — is dropped with it. Output equivalence still holds, which is why
		// nothing else catches this. Implementing the slot-local window must flip this test
		// deliberately.
		const tree = createTokenTree(parser.parse('#[@[a](m) @[a](m) tail]'))
		const outer = tree.roots()[1]
		if (outer.kind !== 'mark') throw new Error('expected mark')
		const [, first, , second, tail] = outer.children()
		expect(tail.position).toEqual({start: 17, end: 22})

		const result = adopt(tree, {start: 2, end: 9, insertedLength: 0}, parser.parse('#[ @[a](m) tail]'))

		const after = tree.roots()[1]
		if (after.kind !== 'mark') throw new Error('expected mark')
		expect(after.children()[1].id).toBe(first.id)
		expect(result.removed).toEqual([second.id, tail.id])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('#[ @[a](m) tail]')))
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

/**
 * Ported (S1.3) from the reconcile suite adoption replaces — deleted at S1.6d.
 * Each case keeps the IDENTITY claim it encoded and drops the reconcile-result
 * assertions (change kinds, tree paths, `structural` routing) that died with that
 * file. Two feed contracts differ by design and are called out where they bite:
 *
 * - a pure position move reaches NO feed, `updated` included (D9);
 * - a refused mark's subtree is DIFFED, where reconcile treated it as opaque and
 *   reported no removals at all (its own comment pinned that as a limitation).
 */
describe('adopt: ported reconcile fixtures', () => {
	const asMark = (node: TreeNode): MarkNode => {
		if (node.kind !== 'mark') throw new Error('expected mark')
		return node
	}

	it('descends a nested slot: every id in the subtree survives an inner keystroke', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tree = createTokenTree(slotParser.parse('#[a #[b] c]'))
		const outer = asMark(tree.roots()[1])
		const [head, innerNode, tail] = outer.children()
		const inner = asMark(innerNode)
		const ids = [outer.id, head.id, inner.id, inner.children()[0].id, tail.id]

		// insert 'X' inside the INNER slot ('b' → 'bX', absolute offset 7)
		const result = adopt(tree, {start: 7, end: 7, insertedLength: 1}, slotParser.parse('#[a #[bX] c]'))

		const outerAfter = asMark(tree.roots()[1])
		const innerAfter = asMark(outerAfter.children()[1])
		expect([
			outerAfter.id,
			outerAfter.children()[0].id,
			innerAfter.id,
			innerAfter.children()[0].id,
			outerAfter.children()[2].id,
		]).toEqual(ids)
		expect(result.added).toEqual([])
		expect(result.removed).toEqual([])
		// Only the typed-into text node changed content; reconcile also listed the two
		// marks and the moved tail here, because it reported position moves as updates.
		expect(result.updated.map(node => node.id)).toEqual([inner.children()[0].id])
		expect(outer.position).toEqual({start: 0, end: 12}) // the move itself: [0,11] → [0,12]
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(slotParser.parse('#[a #[bX] c]')))
	})

	it('keeps a prefix mark and its child when the edit lands past them', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tree = createTokenTree(slotParser.parse('#[ab]tail'))
		const mark = asMark(tree.roots()[1])
		const childId = mark.children()[0].id

		adopt(tree, {start: 9, end: 9, insertedLength: 1}, slotParser.parse('#[ab]tailX'))

		const after = asMark(tree.roots()[1])
		expect(after).toBe(mark) // prefix walk retains the node object itself
		expect(after.children()[0].id).toBe(childId)
		expect(after.position).toEqual({start: 0, end: 5})
	})

	it('rebuilds a nested mark whose descriptor changed and keeps the outer id', () => {
		// '#[a #[b] c]' → '#[a %[b] c]': same outer descriptor, same child count, aligned
		// types, differing INNER descriptors. `descriptor` is readonly, so the inner mark
		// cannot be retained; the outer one has nothing to refuse and keeps its id.
		const dualParser = new Parser(['#[__slot__]', '%[__slot__]'])
		const tree = createTokenTree(dualParser.parse('#[a #[b] c]'))
		const outer = asMark(tree.roots()[1])
		const [head, innerNode, tail] = outer.children()
		const inner = asMark(innerNode)

		const result = adopt(tree, {start: 4, end: 5, insertedLength: 1}, dualParser.parse('#[a %[b] c]'))

		const outerAfter = asMark(tree.roots()[1])
		expect(outerAfter.id).toBe(outer.id)
		expect([outerAfter.children()[0].id, outerAfter.children()[2].id]).toEqual([head.id, tail.id])
		const innerAfter = asMark(outerAfter.children()[1])
		expect(innerAfter.id).not.toBe(inner.id)
		expect(result.added.map(change => [change.node.id, change.path])).toEqual([[innerAfter.id, [1, 1]]])
		// DELIBERATE contract change: a refused mark's subtree was opaque to reconcile, so
		// it reported no removals for one — the original descriptor-mismatch test asserted
		// nothing about `removed` at all, and its sibling child-count refusal pinned
		// `removed: []` with that limitation spelled out. Adoption diffs the subtree, so
		// the vanished inner mark and its child are both reported.
		expect(result.removed).toEqual([inner.id, inner.children()[0].id])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(dualParser.parse('#[a %[b] c]')))
	})

	it('inherits the child id when a mark value changes', () => {
		const valueSlotParser = new Parser(['@[__value__](__slot__)'])
		const tree = createTokenTree(valueSlotParser.parse('@[v](ab)'))
		const mark = asMark(tree.roots()[1])
		const childId = mark.children()[0].id

		const result = adopt(tree, {start: 2, end: 3, insertedLength: 1}, valueSlotParser.parse('@[w](ab)'))

		const after = asMark(tree.roots()[1])
		expect(after.id).toBe(mark.id)
		expect(after.children()[0].id).toBe(childId) // in-slot continuity across a refusal
		expect(after.value()).toBe('w')
		expect([result.added, result.removed]).toEqual([[], []])
		expect(result.updated.map(node => node.id)).toEqual([mark.id])
		// reconcile forced `structural` for a refused descend; the routing datum is now
		// `render` — a MarkNode in `updated` (rendered props changed).
		expect(result.render).toBe(true)
	})

	it('inherits the child id when a mark meta changes', () => {
		const metaSlotParser = new Parser(['#[__slot__](__meta__)'])
		const tree = createTokenTree(metaSlotParser.parse('#[ab](m)'))
		const mark = asMark(tree.roots()[1])
		const childId = mark.children()[0].id

		const result = adopt(tree, {start: 6, end: 7, insertedLength: 1}, metaSlotParser.parse('#[ab](n)'))

		const after = asMark(tree.roots()[1])
		expect(after.id).toBe(mark.id)
		expect(after.children()[0].id).toBe(childId)
		expect(after.meta()).toBe('n')
		expect(result.updated.map(node => node.id)).toEqual([mark.id])
		expect(result.render).toBe(true)
	})

	it('derives the window from gapWindow and keeps identity at both edges', () => {
		// The two reconcile cases that ran WITHOUT a hint. The prepend one is the reason
		// gapWindow clamps: for 'he@[x]llo' → 'Xhe@[x]llo' the suffix scan spans the whole previous value.
		const valueParser = new Parser(['@[__value__]'])
		const append = createTokenTree(valueParser.parse('he@[x]llo'))
		const appendIds = append.roots().map(node => node.id)

		adopt(append, gapWindow('he@[x]llo', 'he@[x]llo!'), valueParser.parse('he@[x]llo!'))

		expect(append.roots().map(node => node.id)).toEqual(appendIds)
		expect(append.roots()[1].position).toEqual({start: 2, end: 6})

		const prepend = createTokenTree(valueParser.parse('he@[x]llo'))
		const prependIds = prepend.roots().map(node => node.id)

		const result = adopt(prepend, gapWindow('he@[x]llo', 'Xhe@[x]llo'), valueParser.parse('Xhe@[x]llo'))

		expect(prepend.roots().map(node => node.id)).toEqual(prependIds)
		expect(prepend.roots()[1].position).toEqual({start: 3, end: 7})
		expect(result.removed).toEqual([])
	})

	it('pairs the empty text child of an empty slot on the first keystroke', () => {
		// '#[]' keeps a zero-width slot range — empty slot != no slot — so the empty text
		// child pairs 1:1 with the typed-into child instead of being rebuilt. This is the
		// empty-text alternation the parser guarantees (every slot mark has >=1 text child).
		const slotParser = new Parser(['#[__slot__]'])
		const tree = createTokenTree(slotParser.parse('#[]'))
		const mark = asMark(tree.roots()[1])
		const child = mark.children()[0]
		expect([child.position, mark.slotRange]).toEqual([
			{start: 2, end: 2},
			{start: 2, end: 2},
		])

		const result = adopt(tree, {start: 2, end: 2, insertedLength: 1}, slotParser.parse('#[a]'))

		const after = asMark(tree.roots()[1])
		expect([after.id, after.children()[0].id]).toEqual([mark.id, child.id])
		expect([result.added, result.removed]).toEqual([[], []])
		expect(result.updated.map(node => node.id)).toEqual([child.id])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(slotParser.parse('#[a]')))
	})
})
const textAnchorOf = (anchor: NodeAnchor): {node: TextNode; offset: number} => {
	if (typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
	return anchor
}

describe('adopt: map affinity (spec D7, plan decision D-a)', () => {
	it('maps a caret AT an insertion point to the end of the inserted text', () => {
		// The whole decision in one assertion. LEFT affinity (the S1.3 shape) answered 5,
		// which parks the caret BEFORE the character the user just typed.
		const {result} = editAndAdopt('abcde', 5, 5, 'X')
		const anchor = textAnchorOf(result.map(5))
		expect(anchor.offset).toBe(6)
		expect(anchor.node.text()).toBe('abcdeX')
	})

	it('collapses an overtyped selection: both endpoints land on the replacement end', () => {
		// AC-3.3/3.4. Under LEFT affinity the anchor stays at 2 and the repair would
		// restore a one-character SELECTION instead of a caret.
		const {result} = editAndAdopt('abcde', 2, 5, 'X')
		expect(textAnchorOf(result.map(2)).offset).toBe(3)
		expect(textAnchorOf(result.map(5)).offset).toBe(3)
	})

	it('leaves an offset strictly before the window alone', () => {
		const {result} = editAndAdopt('abcde', 2, 5, 'X')
		expect(textAnchorOf(result.map(1)).offset).toBe(1)
	})

	it('a deletion is unaffected by the affinity', () => {
		// Both biases agree here; the case exists so a future "fix" that special-cases
		// deletions has a pin. Backspace at 5: window {4,5,0}, caret 5 → 4.
		const {result} = editAndAdopt('abcde', 4, 5, '')
		expect(textAnchorOf(result.map(5)).offset).toBe(4)
	})
})

const selectionAfterOf = (result: TransactionResult): Anchors => {
	const after = result.selectionAfter
	if (!after) throw new Error('expected a resolved selectionAfter')
	return after
}

/** A collapsed caret in the anchor form the channel now carries. */
const caretOn = (node: TreeNode, offset: number): Anchors => {
	if (node.kind !== 'text') throw new Error('expected a text node')
	const anchor: NodeAnchor = {node, offset}
	return {anchor, head: anchor}
}

describe('adopt: selectionAfter (spec S1 D7)', () => {
	it('resolves a caret inside the edited region to the end of the inserted text', () => {
		// The channel's own gate, at the same affinity the `map` cases above pin: typing 'X'
		// at 2 of 'hello' leaves the caret AFTER it (3), not before it (2) and not past it (4).
		const tree = createTokenTree(parser.parse('hello'))
		const before = caretOn(tree.roots()[0], 2)

		const result = adopt(tree, {start: 2, end: 2, insertedLength: 1}, parser.parse('heXllo'), before)

		const after = selectionAfterOf(result)
		expect(textAnchorOf(after.anchor).offset).toBe(3)
		expect(textAnchorOf(after.head).offset).toBe(3)
	})

	it('forms the offsets BEFORE adoption rewrites the positions they read', () => {
		// THE ordering gate, and it needs an anchor whose node MOVES — the case above cannot
		// see the hazard at all, because its node stays at 0 and so reads 2 either way.
		//   'ab@[x](m)cd' → text[0,2] mark[2,9] text[9,11]; caret at 'cd'+0 = 9.
		//   Insert 'Z' at 0 → window {0,0,1}: the suffix walk shifts 'cd' to [10,12].
		//   pre-mutation:  offsetOfAnchor = 9  → map(9)  = 10 → 'cd'+0. Correct.
		//   post-mutation: offsetOfAnchor = 10 → map(10) = 11 → 'cd'+1. Shifted twice.
		const tree = createTokenTree(parser.parse('ab@[x](m)cd'))
		const before = caretOn(tree.roots()[2], 0)

		const result = adopt(tree, {start: 0, end: 0, insertedLength: 1}, parser.parse('Zab@[x](m)cd'), before)

		const after = selectionAfterOf(result)
		expect(offsetOfAnchor(tree.roots(), after.anchor)).toBe(10)
		expect(offsetOfAnchor(tree.roots(), after.head)).toBe(10)
	})
})