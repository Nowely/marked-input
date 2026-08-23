import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {adjacentMark, anchorAt, anchorEquals, offsetOfAnchor, stepAnchor} from './anchors'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__]'])
const build = (source: string) => createTokenTree(parser.parse(source))

/** Nesting needs a slot to nest INTO, and a shared boundary needs a mark flush with a row's edge. */
const nestedParser = new Parser(['#[__slot__]', '@[__value__]'])

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
	/**
	 * THE invariant that leaves `anchorAt` one reading and no `side` parameter: a node's own
	 * START is always covered by a text node, so the mark/row fallback can only answer for an
	 * INTERIOR or an END, where no second reading exists. Both halves are the parser's:
	 * `TreeBuilder.buildSinglePass` emits a text token immediately before every match at every
	 * nesting level, and `RowBuilder.groupRows` opens a row's children with one.
	 *
	 * `Selection.selectAll`'s START seed is what rides it — it used to ask for a `'left'`
	 * reading, and the branch that served it was reachable only from hand-assembled roots.
	 */
	it.each([
		['a leading mark', '@[x]cd'],
		['two leading marks', '@[x]@[y]'],
		['a nested mark opening a slot', '#[@[x]]'],
	])('answers offset 0 with a text anchor on a document opening with %s', (_label, value) => {
		const roots = createTokenTree(nestedParser.parse(value)).roots()

		expect(anchorAt(roots, 0)).toEqual({node: roots[0], offset: 0})
		expect(offsetOfAnchor(roots, anchorAt(roots, 0))).toBe(0)
	})

	it("answers a block row's own start with a text anchor when the row opens with a mark", () => {
		// Row 0 is '@[m]\n\n' [0,6] and opens with the mark; row 1 is 'plain' [6,11]. Both row
		// starts are a `groupRows` text child, so neither answers `{after: row}`.
		const roots = createTokenTree(nestedParser.parseRows('@[m]\n\nplain', '\n\n')).roots()
		const firstChild = (index: number) => {
			const row = roots[index]
			if (row.kind !== 'row') throw new Error('expected a row root')
			return row.children()[0]
		}

		expect(anchorAt(roots, 0)).toEqual({node: firstChild(0), offset: 0})
		expect(anchorAt(roots, 6)).toEqual({node: firstChild(1), offset: 0})
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
		// edge, and every markup the parser can open puts its own text between the two.
		// Nested-first is normative regardless, and the tree layer accepts the shape, so it
		// is built from parsed tokens rather than left unpinned.
		const row = nestedParser.parse('#[a]')[1]
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