import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {toString} from '../parser/utils/toString'
import {createTokenTree, joinNodes} from './tree'
import type {TreeNode} from './types'

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