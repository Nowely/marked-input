import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {anchorAt, anchorEquals, offsetOfAnchor} from './anchors'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__]'])
const build = (source: string) => createTokenTree(parser.parse(source))

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