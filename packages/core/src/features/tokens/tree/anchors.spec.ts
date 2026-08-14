import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {adjacentMark, anchorAt, anchorEquals, offsetOfAnchor, stepAnchor} from './anchors'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__]'])
const build = (source: string) => createTokenTree(parser.parse(source))

/** Nesting needs a slot to nest INTO, and a shared boundary needs a mark flush with a row's edge. */
const nestedParser = new Parser(['#[__slot__]', '@[__value__]'])
const rowParser = new Parser(['__slot__\n\n'])

describe('offsetOfAnchor', () => {
	it('resolves a text anchor through its node position', () => {
		const tree = build('ab@[x]cd') // text[0,2] mark[2,6] text[6,8]
		const cd = tree.roots()[2]
		if (cd.kind !== 'text') throw new Error('expected text')
		expect(offsetOfAnchor(tree.roots(), {node: cd, offset: 1})).toBe(7)
	})

	it('resolves the boundary forms to the node edges', () => {
		const tree = build('ab@[x]cd')
		const mark = tree.roots()[1]
		expect(offsetOfAnchor(tree.roots(), {before: mark})).toBe(2)
		expect(offsetOfAnchor(tree.roots(), {after: mark})).toBe(6)
	})

	it("resolves 'end' against the LAST ROOT, not against a captured length", () => {
		// Tree space, not `value.current()` space (plan decision D-d): in controlled mode
		// props.value is already the NEXT value when the echo's capture runs, and a length
		// read there would put `selectionBefore` outside the space `map` is defined on.
		const tree = build('ab@[x]cd')
		expect(offsetOfAnchor(tree.roots(), 'end')).toBe(8)
		expect(offsetOfAnchor(tree.roots(), 'start')).toBe(0)
	})

	it('answers 0 for both edges of an empty tree', () => {
		const tree = createTokenTree([])
		expect(offsetOfAnchor(tree.roots(), 'end')).toBe(0)
	})

	it('round-trips anchorAt for every offset of a document', () => {
		// The two are inverses on anchorable offsets; markup interiors resolve to the
		// mark's trailing boundary, which is why the mark span is excluded (spec §2.3).
		const tree = build('ab@[x]cd')
		for (const offset of [0, 1, 2, 6, 7, 8]) {
			expect(offsetOfAnchor(tree.roots(), anchorAt(tree.roots(), offset)), `offset ${offset}`).toBe(offset)
		}
	})
})

describe('anchorAt', () => {
	it('answers a slotless mark by the SIDE its caller asked for', () => {
		// The fallback for an offset no text token covers. `side` is a parameter and not a
		// rule because the two readings are both correct and both wanted: the DEFAULT (right)
		// is what a post-edit caret repair needs — an offset landing on a mark's start belongs
		// after whatever was just typed — while `'left'` is what a select-all seed needs, or
		// the selection begins after the mark it should start at. Globalizing the left reading
		// regressed controlled-mode typing; only `Selection.selectAll`'s START seed passes it.
		const tree = createTokenTree(new Parser(['@[__value__]']).parse('@[x]'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark root')
		// Probed against the mark ALONE: the inline parse brackets it with empty text tokens
		// covering [0,4]'s two ends, which would answer first — block layout is exactly the
		// mode that filters those away.
		const roots = [mark]

		expect(anchorAt(roots, 0, 'left')).toEqual({before: mark})
		expect(anchorAt(roots, 0)).toEqual({after: mark})
		expect(anchorAt(roots, 0, 'right')).toEqual({after: mark})

		// `'left'` reaches the START only: the end and the interior have no second reading.
		expect(anchorAt(roots, 4, 'left')).toEqual({after: mark})
		expect(anchorAt(roots, 2, 'left')).toEqual({after: mark})

		// Each side still projects back to the offset it was formed from.
		expect(offsetOfAnchor(roots, anchorAt(roots, 0, 'left'))).toBe(0)
		expect(offsetOfAnchor(roots, anchorAt(roots, 4))).toBe(4)
	})
})

describe('anchorEquals', () => {
	it('compares node identity and local offset', () => {
		const tree = build('ab@[x]cd')
		const ab = tree.roots()[0]
		const cd = tree.roots()[2]
		if (ab.kind !== 'text' || cd.kind !== 'text') throw new Error('expected text')
		expect(anchorEquals({node: ab, offset: 1}, {node: ab, offset: 1})).toBe(true)
		expect(anchorEquals({node: ab, offset: 1}, {node: ab, offset: 2})).toBe(false)
		// SAME LOCAL OFFSET, DIFFERENT NODE. This is the assertion that forces the node
		// comparison: with `offset` alone the two anchors are indistinguishable, yet they
		// address 1 and 7. Dropping `a.node === b.node` survives every other case here.
		expect(anchorEquals({node: ab, offset: 1}, {node: cd, offset: 1})).toBe(false)
		expect(anchorEquals({node: ab, offset: 2}, {node: cd, offset: 0})).toBe(false)
	})

	it('separates two anchors that share an absolute offset', () => {
		// `{after: mark}` and `cd`@0 both resolve to 6 — the case a numeric range cannot
		// express and the reason `#preferredHandle` existed. Equality is anchor identity,
		// so it must NOT collapse them the way comparing resolved offsets would.
		const tree = build('ab@[x]cd')
		const mark = tree.roots()[1]
		const cd = tree.roots()[2]
		if (cd.kind !== 'text') throw new Error('expected text')
		const after = {after: mark}
		const head = {node: cd, offset: 0}
		expect(offsetOfAnchor(tree.roots(), after)).toBe(offsetOfAnchor(tree.roots(), head))
		expect(anchorEquals(after, head)).toBe(false)
	})

	it('distinguishes the boundary forms and the edges', () => {
		const tree = build('ab@[x]cd')
		const mark = tree.roots()[1]
		expect(anchorEquals({before: mark}, {after: mark})).toBe(false)
		expect(anchorEquals('start', 'start')).toBe(true)
		expect(anchorEquals('start', 'end')).toBe(false)
		expect(anchorEquals(undefined, undefined)).toBe(true)
		expect(anchorEquals(undefined, 'start')).toBe(false)
	})
})

describe('adjacentMark', () => {
	it('names the mark ENDING on the offset for -1 and the one STARTING there for +1', () => {
		const tree = build('ab@[x]cd') // text[0,2] mark[2,6] text[6,8]
		const roots = tree.roots()
		const [ab, mark, cd] = roots
		if (ab.kind !== 'text' || cd.kind !== 'text') throw new Error('expected text')

		expect(adjacentMark(roots, {node: cd, offset: 0}, -1)).toBe(mark)
		expect(adjacentMark(roots, {node: ab, offset: 2}, 1)).toBe(mark)
		// The SAME two offsets read the other way: 6 opens no mark and 2 closes none, which is
		// what makes Backspace and Delete swallow on opposite sides of one mark.
		expect(adjacentMark(roots, {node: cd, offset: 0}, 1)).toBeUndefined()
		expect(adjacentMark(roots, {node: ab, offset: 2}, -1)).toBeUndefined()

		// The boundary anchor forms resolve through offsetOfAnchor, same two answers.
		expect(adjacentMark(roots, {after: mark}, -1)).toBe(mark)
		expect(adjacentMark(roots, {before: mark}, 1)).toBe(mark)
	})

	it('answers undefined when no mark boundary sits on the offset', () => {
		const tree = build('ab@[x]cd')
		const roots = tree.roots()
		const ab = roots[0]
		if (ab.kind !== 'text') throw new Error('expected text')
		expect(adjacentMark(roots, {node: ab, offset: 1}, -1)).toBeUndefined()
		expect(adjacentMark(roots, {node: ab, offset: 1}, 1)).toBeUndefined()
	})

	it('reaches a mark nested in a slot', () => {
		// The swallow's real shape: the caret sits after a mark INSIDE a slot, where the
		// enclosing mark's own end is one `]` further on and answers nothing.
		const tree = createTokenTree(nestedParser.parse('#[y@[x]]'))
		// text[0,0] mark#[0,8]{ text"y"[2,3] mark@[3,7] text[7,7] } text[8,8]
		const roots = tree.roots()
		const outer = roots[1]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const inner = outer.children()[1]
		expect(adjacentMark(roots, {after: inner}, -1)).toBe(inner)
		expect(adjacentMark(roots, {after: outer}, -1)).toBe(outer)
	})

	it('prefers the INNER mark over the one enclosing it at a shared boundary', () => {
		// ASSEMBLED, not parsed: a shared boundary needs a nested mark flush with its parent's
		// edge, and every markup the parser can open puts its own text between the two — the one
		// shape that would not, a slot-first markup whose slot OPENS with a mark, is dropped by
		// the parser today (`'@[x]\n\n'` under `'__slot__\n\n'` yields the mention plus literal
		// text, no row). Nested-first is normative regardless, and the tree layer accepts the
		// shape, so it is built from parsed tokens rather than left unpinned.
		const row = rowParser.parse('a\n\n')[1]
		const mention = parser.parse('@[x]')[1]
		if (row.type !== 'mark' || mention.type !== 'mark') throw new Error('expected marks')
		mention.position = {start: 0, end: 4}
		row.children = [mention]
		row.slot = {content: '@[x]', start: 0, end: 4}
		row.position = {start: 0, end: 6}

		const roots = createTokenTree([row]).roots()
		const outer = roots[0]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const inner = outer.children()[0]
		expect(outer.position.start).toBe(inner.position.start)
		expect(adjacentMark(roots, 'start', 1)).toBe(inner)
	})
})

describe('stepAnchor', () => {
	it('steps one character forward and back inside a text token', () => {
		const tree = build('ab@[x]cd') // text[0,2] mark[2,6] text[6,8]
		const roots = tree.roots()
		const [ab, , cd] = roots
		if (ab.kind !== 'text' || cd.kind !== 'text') throw new Error('expected text')
		expect(stepAnchor(roots, {node: ab, offset: 0}, 1)).toEqual({node: ab, offset: 1})
		expect(stepAnchor(roots, {node: cd, offset: 1}, -1)).toEqual({node: cd, offset: 0})
		expect(stepAnchor(roots, 'end', -1)).toEqual({node: cd, offset: 1})
	})

	it('answers undefined at both document edges', () => {
		const tree = build('ab@[x]cd')
		expect(stepAnchor(tree.roots(), 'start', -1)).toBeUndefined()
		expect(stepAnchor(tree.roots(), 'end', 1)).toBeUndefined()
	})

	it("answers undefined rather than a wrong anchor when the step lands in a mark's markup", () => {
		// FAILS CLOSED. Offsets 3 and 5 are inside `@[x]`'s markup, which is not anchorable, so
		// anchorAt hands back the mark's own END — three characters off the step in one direction
		// and one in the other. The old numeric step spliced that position anyway and re-parsed
		// the mark into plain text; the round-trip check is what detects the mismatch.
		const tree = build('ab@[x]cd')
		const roots = tree.roots()
		const [ab, mark, cd] = roots
		if (ab.kind !== 'text' || cd.kind !== 'text') throw new Error('expected text')
		expect(anchorAt(roots, 3)).toEqual({after: mark})
		expect(stepAnchor(roots, {node: ab, offset: 2}, 1)).toBeUndefined()
		expect(stepAnchor(roots, {node: cd, offset: 0}, -1)).toBeUndefined()
	})
})