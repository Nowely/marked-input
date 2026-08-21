import {describe, expect, it} from 'vitest'

import {toString} from '../parser/__testing__/toString'
import {Parser} from '../parser/Parser'
import {createTokenTree, joinNodes, rootIndexOf, sliceNodes} from './tree'
import type {TextNode, TreeNode} from './types'

const parser = new Parser(['@[__value__](__meta__)', '#[__slot__]'])

const flatten = (nodes: readonly TreeNode[]): TreeNode[] =>
	nodes.flatMap(node => (node.kind === 'mark' ? [node, ...flatten(node.children())] : [node]))

describe('createTokenTree', () => {
	it('builds nodes mirroring the parsed token stream with fresh ids', () => {
		const tree = createTokenTree(parser.parse('he@[x](m)llo'))
		const roots = tree.roots()
		expect(roots.map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		const ids = roots.map(n => n.id)
		expect(new Set(ids).size).toBe(3)
		expect(roots[0]).toMatchObject({position: {start: 0, end: 2}})
	})

	it('builds mark children from the nested tokens with ids of their own', () => {
		const tree = createTokenTree(parser.parse('#[a @[b](c) d]'))
		const roots = tree.roots()
		const mark = roots[1]
		if (mark.kind !== 'mark') throw new Error('expected mark root')
		expect(mark.children().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		const rootIds = new Set(roots.map(n => n.id))
		expect(mark.children().filter(n => rootIds.has(n.id))).toEqual([])
	})

	it('assigns distinct ids across the whole nested tree', () => {
		const tree = createTokenTree(parser.parse('#[a #[b #[c] d] e]'))
		const ids = flatten(tree.roots()).map(n => n.id)
		expect(ids.length).toBe(10)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('copies token positions instead of aliasing them', () => {
		const tokens = parser.parse('hello')
		const node = createTokenTree(tokens).roots()[0]
		expect(node.position).not.toBe(tokens[0].position)
		node.position.end = 99
		expect(tokens[0].position.end).toBe(5)
	})

	it('builds one empty text node for empty input', () => {
		const tree = createTokenTree(parser.parse(''))
		expect(tree.roots().map(n => n.kind)).toEqual(['text'])
		expect(tree.value()).toBe('')
	})

	it('projects the value as the exact source string', () => {
		const source = 'he@[x](m)llo #[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		expect(tree.value()).toBe(source)
	})

	it('projects identically to the parser toString across token shapes', () => {
		const sources = ['', 'plain', '@[x](m)', '#[]', '#[a]', 'he@[x](m)llo #[a @[b](c) d]', '#[a #[b #[c] d] e]']
		const projected = sources.map(source => joinNodes(createTokenTree(parser.parse(source)).roots()))
		expect(projected).toEqual(sources.map(source => toString(parser.parse(source))))
		expect(projected).toEqual(sources)
	})

	it('value() tracks content-signal writes reactively', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const first = tree.roots()[0]
		if (first.kind !== 'text') throw new Error('expected text root')
		// Read first so the computed is warm — otherwise a broken dependency edge still passes
		expect(tree.value()).toBe('hello')
		first.text('world')
		expect(tree.value()).toBe('world')
	})
})

describe('rootIndexOf', () => {
	it('answers the ROOT index for a nested node, not the node index', () => {
		// The block row index (`keyboard/blockEdit.ts`): a caret inside a row's slot child
		// must resolve to the ROW.
		const tree = createTokenTree(parser.parse('a#[bc]d'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		expect(rootIndexOf(tree.roots(), mark.children()[0].id)).toBe(1)
		expect(rootIndexOf(tree.roots(), tree.roots()[2].id)).toBe(2)
		expect(rootIndexOf(tree.roots(), 9999)).toBeUndefined()
	})
})

describe('sliceNodes (the clipboard projection)', () => {
	// 'ab@[x](m)cd': text [0,2), mark [2,9), text [9,11).
	const source = 'ab@[x](m)cd'
	const build = () => createTokenTree(parser.parse(source)).roots()
	const textAt = (roots: readonly TreeNode[], index: number): TextNode => {
		const node = roots[index]
		if (node.kind !== 'text') throw new Error(`expected a text node at ${index}`)
		return node
	}

	it('projects the whole document when the pair spans the document edges', () => {
		expect(sliceNodes(build(), 'start', 'end')).toBe(source)
	})

	it('trims a partial selection spanning a mark to exact bounds', () => {
		// EXACT bounds, and that is what makes this a gate: [1, 10) is one character INTO each
		// text node, so widening or narrowing either end by one changes the answer
		// ('ab@[x](m)c', 'b@[x](m)cd', '@[x](m)c'…). The mark in between is whole either way —
		// its `value`/`meta` have no sub-spans to cut.
		const roots = build()
		const from = {node: textAt(roots, 0), offset: 1}
		const to = {node: textAt(roots, 2), offset: 1}
		expect(sliceNodes(roots, from, to)).toBe('b@[x](m)c')
	})

	it('answers the same for a REVERSED pair — the normalization is the gate', () => {
		// `sliceNodes` normalizes, so swapping is a no-op BY DESIGN. Measured: dropping the
		// min/max makes this case answer '' while the case above stays green, so this is the
		// only thing that pins the normalization.
		const roots = build()
		const from = {node: textAt(roots, 0), offset: 1}
		const to = {node: textAt(roots, 2), offset: 1}
		expect(sliceNodes(roots, to, from)).toBe('b@[x](m)c')
	})

	it('excludes a node the window only touches at a boundary — both ends', () => {
		// Half-open, and BOTH clauses need their own case: [0, 2) ends exactly where the mark
		// STARTS (the `position.start >= end` clause), [9, 11) starts exactly where it ENDS
		// (the `position.end <= start` one).
		//
		// The second assertion has to bound a MARK, not the leading text: a text node excluded
		// by that clause would be clamped to an empty slice anyway, so relaxing `<=` to `<`
		// survives a text-only fixture (measured). A mark has no slice to clamp — it is emitted
		// whole or not at all.
		const roots = build()
		expect(sliceNodes(roots, 'start', {node: textAt(roots, 0), offset: 2})).toBe('ab')
		expect(sliceNodes(roots, {node: textAt(roots, 2), offset: 0}, 'end')).toBe('cd')
	})

	it('trims a mark SLOT and keeps the annotation valid', () => {
		const roots = createTokenTree(parser.parse('#[hello]')).roots()
		const mark = roots[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		const slotText = mark.children()[0]
		if (slotText.kind !== 'text') throw new Error('expected a slot text child')
		expect(sliceNodes(roots, {node: slotText, offset: 0}, {node: slotText, offset: 3})).toBe('#[hel]')
	})
})

describe('public node shape (spec §2.3)', () => {
	it('exposes the markup string, not the descriptor, as the public view', () => {
		const tree = createTokenTree(parser.parse('a@[x](m)b'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		expect(mark.markup).toBe('@[__value__](__meta__)')
		expect(mark.markup).toBe(mark.descriptor.markup)
	})

	it('derives slot() from the children, and answers undefined for a slotless markup', () => {
		const tree = createTokenTree(parser.parse('#[in slot]@[x](m)'))
		const withSlot = tree.roots()[1]
		const withoutSlot = tree.roots()[3]
		if (withSlot.kind !== 'mark' || withoutSlot.kind !== 'mark') throw new Error('expected marks')
		expect(withSlot.slot()).toBe('in slot')
		expect(withoutSlot.slot()).toBeUndefined()
	})

	it('slot() tracks the live children — it is a read, not a snapshot', () => {
		const tree = createTokenTree(parser.parse('#[before]'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		const child = mark.children()[0]
		if (child.kind !== 'text') throw new Error('expected a text child')
		child.text('after')
		expect(mark.slot()).toBe('after')
	})

	it('range() reads the stored positions of both node kinds', () => {
		const tree = createTokenTree(parser.parse('ab@[x](m)'))
		const [text, mark] = tree.roots()
		expect(text.range()).toEqual({start: 0, end: 2})
		// '@[x](m)' is SEVEN characters: [2,9), not [2,10).
		expect(mark.range()).toEqual({start: 2, end: 9})
	})

	it('range() returns a copy — a caller cannot write the stored position through it', () => {
		const tree = createTokenTree(parser.parse('ab'))
		const node = tree.roots()[0]
		node.range().start = 99
		expect(node.range()).toEqual({start: 0, end: 2})
		expect(node.position).toEqual({start: 0, end: 2})
	})
})