import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../../parser/Parser'
import type {RowToken, Token} from '../../parser/types'
import {annotate} from '../../parser/utils/annotate'
import {toString} from '../../parser/utils/toString'
import {createTokenTree} from '../tree'
import type {TreeNode} from '../types'
import {snapshot, stripIds} from './snapshot'

const markups = ['@[__value__](__meta__)', '#[__slot__]'] as const
const parser = new Parser([...markups])

const BASE_SEED = 8_082_026
/** ~200 keeps CI-tolerable runtime; bump locally for soak runs. */
const ITERATIONS = 200
/** Slot content recurses, so marks nest; 3 levels without sources getting unreadable. */
const MAX_DEPTH = 3

const nodeIds = (nodes: readonly TreeNode[]): number[] =>
	nodes.flatMap(node => (node.kind === 'mark' ? [node.id, ...nodeIds(node.children())] : [node.id]))

const tokenIds = (tokens: readonly (Token | RowToken)[]): (number | undefined)[] =>
	tokens.flatMap(token => (token.type === 'text' ? [token.id] : [token.id, ...tokenIds(token.children)]))

function randomSource(depth: number): string {
	const parts: string[] = []
	for (let i = 0; i < faker.number.int({min: 1, max: 5}); i++) {
		// Single roll, not chained boolean else-ifs — oxlint no-dupe-else-if fires
		// on the duplicated condition text otherwise (denyWarnings: true).
		const roll = faker.number.int({min: 0, max: 2})
		if (roll === 0) {
			parts.push(faker.string.alpha({length: {min: 0, max: 6}}))
		} else if (roll === 1) {
			parts.push(annotate(markups[0], {value: faker.string.alpha(3), meta: faker.string.alpha(2)}))
		} else {
			const slot = depth < MAX_DEPTH ? randomSource(depth + 1) : faker.string.alpha({length: {min: 0, max: 4}})
			parts.push(annotate(markups[1], {slot}))
		}
	}
	return parts.join('')
}

/**
 * The empty source plus generated documents, deterministic in `BASE_SEED`.
 *
 * The fixpoint gate never fires for these two markups (0/20_000 seeds) — it guards
 * the next widening. A second *slot* markup makes `parse` emit inverted child ranges
 * on inputs like `#[#[]**]**` (pre-existing parser defect), and no tree-layer property
 * can hold for a source `toString(parse(s))` already loses. Skip such inputs here
 * instead of softening the round-trip below.
 */
function buildCorpus(): string[] {
	const sources = ['']
	for (let seed = BASE_SEED; sources.length < ITERATIONS; seed++) {
		faker.seed(seed)
		const source = randomSource(0)
		if (toString(parser.parse(source)) === source) sources.push(source)
	}
	return sources
}

describe('snapshot', () => {
	it('reproduces the parsed token stream (ids stripped), fixture case', () => {
		const source = 'he@[x](m)llo #[a]'
		const parsed = parser.parse(source)
		const tree = createTokenTree(parsed)
		expect(stripIds(snapshot(tree.roots()))).toStrictEqual(stripIds(parser.parse(source)))
	})

	it('reproduces nested mark children and slot text', () => {
		const source = '#[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		expect(stripIds(snapshot(tree.roots()))).toStrictEqual(stripIds(parser.parse(source)))
	})

	it('derives token content and slot text from live children', () => {
		const tree = createTokenTree(parser.parse('#[a]'))
		const node = tree.roots()[1]
		if (node.kind !== 'mark') throw new Error('expected mark at index 1')
		const child = node.children()[0]
		if (child.kind !== 'text') throw new Error('expected text child')

		child.text('zz')

		const token = snapshot(tree.roots())[1]
		if (token.type !== 'mark') throw new Error('expected mark at index 1')
		expect(token.content).toBe('#[zz]')
		expect(token.slot?.content).toBe('zz')
		expect(tree.value()).toBe('#[zz]')
	})

	it('carries the node id of every node onto its token', () => {
		const tree = createTokenTree(parser.parse('#[a @[b](c) d]'))
		expect(tokenIds(snapshot(tree.roots()))).toEqual(nodeIds(tree.roots()))
	})

	it('copies position and slot instead of aliasing the node', () => {
		const tree = createTokenTree(parser.parse('#[a]'))
		const node = tree.roots()[1]
		const token = snapshot(tree.roots())[1]
		if (node.kind !== 'mark' || token.type !== 'mark') throw new Error('expected mark at index 1')
		expect(token.position).not.toBe(node.position)
		expect(token.slot).not.toBe(node.slotRange)
		token.position.end = 99
		expect(node.position.end).toBe(4)
	})

	it('round-trips parse(join(tree)) across the generated corpus', () => {
		for (const source of buildCorpus()) {
			const tree = createTokenTree(parser.parse(source))
			const detail = `source=${JSON.stringify(source)}`
			expect(tree.value(), detail).toBe(source)
			expect(stripIds(snapshot(tree.roots())), detail).toStrictEqual(stripIds(parser.parse(source)))
		}
	})
})

describe('stripIds', () => {
	it('removes ids at every depth', () => {
		const tree = createTokenTree(parser.parse('#[a @[b](c) d]'))
		const stripped = stripIds(snapshot(tree.roots()))
		expect(tokenIds(stripped)).toEqual(nodeIds(tree.roots()).map(() => undefined))
	})
})