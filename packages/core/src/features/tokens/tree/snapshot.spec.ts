import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {snapshot, stripIds} from './snapshot'
import {createTokenTree} from './tree'
import type {TreeNode} from './types'

const markups = ['@[__value__](__meta__)', '#[__slot__]'] as const
const parser = new Parser([...markups])

const BASE_SEED = 8_082_026
/** ~200 keeps CI-tolerable runtime; bump locally for soak runs. */
const ITERATIONS = 200

const nodeIds = (nodes: readonly TreeNode[]): number[] =>
	nodes.flatMap(node => (node.kind === 'mark' ? [node.id, ...nodeIds(node.children())] : [node.id]))

const tokenIds = (tokens: readonly Token[]): (number | undefined)[] =>
	tokens.flatMap(token => (token.type === 'mark' ? [token.id, ...tokenIds(token.children)] : [token.id]))

function randomValue(): string {
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
			parts.push(annotate(markups[1], {slot: faker.string.alpha({length: {min: 0, max: 4}})}))
		}
	}
	return parts.join('')
}

describe('snapshot', () => {
	it('reproduces the parsed token stream (ids stripped), fixture case', () => {
		const source = 'he@[x](m)llo #[a]'
		const parsed = parser.parse(source)
		const tree = createTokenTree(parsed)
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(source)))
	})

	it('reproduces nested mark children and slot text', () => {
		const source = '#[a @[b](c) d]'
		const tree = createTokenTree(parser.parse(source))
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse(source)))
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
		expect(token.slot).not.toBe(node.slot)
		token.position.end = 99
		expect(node.position.end).toBe(4)
	})

	it('round-trips parse(join(tree)) for 200 generated documents', () => {
		for (let i = 0; i < ITERATIONS; i++) {
			const seed = BASE_SEED + i
			faker.seed(seed)
			const source = randomValue()
			const tree = createTokenTree(parser.parse(source))
			const detail = `seed=${seed} source=${JSON.stringify(source)}`
			expect(tree.value(), detail).toBe(source)
			expect(stripIds(snapshot(tree.roots())), detail).toEqual(stripIds(parser.parse(source)))
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