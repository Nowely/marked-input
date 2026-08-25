import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {TreeCapture} from './__testing__/diff'
import {captureTree, diffTree} from './__testing__/diff'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {movePlan} from './siblings'
import {createTokenTree} from './tree'
import type {Pairing, Window} from './types'

/**
 * The property gates for the identity {@link Pairing}. They are the acceptance oracle for the
 * reorder work: the example cases in `markNode.spec` say a move keeps its ids on ONE document,
 * these say it on generated ones — and, more importantly, that a claim the parse does not
 * support changes NOTHING.
 *
 * Rows are drawn WITH REPETITION from a three-word pool, so byte-identical rows recur by
 * construction. That is the whole adversarial class: a permutation of identical rows leaves the
 * document unchanged, so the string carries no evidence of the move at all and every property
 * below is decided by the pairing alone. A pool of distinct rows would let ordinary
 * position-equality carry the identity and none of this would be tested.
 */
const parser = new Parser([])
const POOL = ['alpha', 'beta', 'alpha'] as const

const BASE_SEED = 17_082_026
const ITERATIONS = 200

/** Paragraph rows (issue 08): the structural separator forms the rows, no markup needed. */
const parseRows = (value: string) => parser.parseRows(value, {separator: '\n\n'})

const buildTree = (value: string) => createTokenTree(parseRows(value))

interface Case {
	seed: number
	source: string
	from: number
	to: number
}

const label = (c: Case): string => `seed=${c.seed} src=${JSON.stringify(c.source)} move ${c.from}→${c.to}`

function buildCases(): Case[] {
	const cases: Case[] = []
	for (let index = 0; index < ITERATIONS; index++) {
		const seed = BASE_SEED + index
		faker.seed(seed)
		const rows = faker.number.int({min: 2, max: 5})
		const source = Array.from({length: rows}, () => `${faker.helpers.arrayElement(POOL)}\n\n`).join('')
		const from = faker.number.int({min: 0, max: rows - 1})
		let to = faker.number.int({min: 0, max: rows - 1})
		if (to === from) to = (to + 1) % rows
		cases.push({seed, source, from, to})
	}
	return cases
}

const CASES = buildCases()

/** What the tree should hold after the move, derived independently of `movePlan`. */
function expectedOrder<T>(items: readonly T[], from: number, to: number): T[] {
	const next = [...items]
	next.splice(to, 0, ...next.splice(from, 1))
	return next
}

function planned(c: Case): {tree: ReturnType<typeof buildTree>; window: Window; next: string; ids: number[]} {
	const tree = buildTree(c.source)
	const roots = tree.roots()
	const ids = roots.map(node => node.id)
	const plan = movePlan(roots, roots[c.from], c.to)
	if (!plan) throw new Error(`movePlan refused a legal move: ${label(c)}`)
	const value = tree.value()
	const next = value.slice(0, plan.window.start) + plan.text + value.slice(plan.window.end)
	return {tree, window: plan.window, next, ids}
}

/**
 * Everything an adoption did, in a shape two runs can be compared by. Diff-based since the
 * change feed left `TransactionResult`: the two trees allocate ids from independent counters
 * that start equal, so ids — and the diffs built on them — compare across runs by value.
 */
function outcomeOf(tree: ReturnType<typeof buildTree>, before: TreeCapture) {
	const diff = diffTree(before, tree.roots())
	return {
		ids: tree.roots().map(node => node.id),
		value: tree.value(),
		added: diff.added.map(change => change.node.id),
		removed: diff.removed,
		updated: diff.updated.map(node => node.id),
	}
}

describe('pairing: a verified claim moves identity', () => {
	it('carries every row id to its new index', () => {
		for (const c of CASES) {
			const {tree, window, next, ids} = planned(c)

			adopt(tree, window, parseRows(next))

			expect(
				tree.roots().map(node => node.id),
				label(c)
			).toEqual(expectedOrder(ids, c.from, c.to))
		}
	})

	it('leaves a tree the parser agrees with — positions, slot text and all', () => {
		for (const c of CASES) {
			const {tree, window, next} = planned(c)

			adopt(tree, window, parseRows(next))

			// The §7.1 output-equivalence oracle. It is what catches a position the permuted
			// branch forgot to rewrite: ids aside, the whole tree must equal a fresh parse of
			// its own projection.
			expect(stripIds(snapshot(tree.roots())), label(c)).toEqual(parseRows(tree.value()))
			expect(tree.value(), label(c)).toBe(next)
		}
	})

	it('moves rows without births, deaths or content writes', () => {
		for (const c of CASES) {
			const {tree, window, next} = planned(c)
			const before = captureTree(tree.roots())

			adopt(tree, window, parseRows(next))

			// Nothing was born, died or changed content: a verified move is position writes only.
			const diff = diffTree(before, tree.roots())
			expect({added: diff.added, removed: diff.removed, updated: diff.updated}, label(c)).toEqual({
				added: [],
				removed: [],
				updated: [],
			})
		}
	})
})

/**
 * THE safety property, and the one that replaces a differential oracle against the retired
 * composer: a pairing the parse does not support must leave adoption bit-for-bit as it is
 * without one. Each corruption below is a gate in `resolvePairing`, and the bijection case is
 * the one its own docblock calls out as not implied by the range check.
 */
describe('pairing: a claim the parse refuses changes nothing', () => {
	const corruptions: {name: string; corrupt: (pairing: Pairing) => Pairing}[] = [
		{name: 'a duplicated index (not a bijection)', corrupt: p => p.map(() => p[0])},
		{name: 'an out-of-range index', corrupt: p => [...p.slice(0, -1), p.length]},
		{name: 'a negative index', corrupt: p => [-1, ...p.slice(1)]},
		{name: 'a length the root list does not have', corrupt: p => p.slice(0, -1)},
	]

	for (const {name, corrupt} of corruptions) {
		it(`ignores ${name}`, () => {
			for (const c of CASES) {
				const corrupted = planned(c)
				const bare = planned(c)
				const corruptedBefore = captureTree(corrupted.tree.roots())
				const bareBefore = captureTree(bare.tree.roots())
				const claim = corrupted.window.pairing
				if (!claim) throw new Error(`movePlan produced no pairing: ${label(c)}`)

				adopt(corrupted.tree, {...corrupted.window, pairing: corrupt(claim)}, parseRows(corrupted.next))
				adopt(
					bare.tree,
					{start: bare.window.start, end: bare.window.end, insertedLength: bare.window.insertedLength},
					parseRows(bare.next)
				)

				expect(outcomeOf(corrupted.tree, corruptedBefore), `${name} — ${label(c)}`).toEqual(
					outcomeOf(bare.tree, bareBefore)
				)
			}
		})
	}
})

/**
 * The CONTENT gate needs distinct rows, so it is an example rather than a property: over a pool
 * with repetition, a claim that looks wrong index-wise is often right — a permutation of
 * byte-identical rows leaves the document unchanged, so the parse genuinely permits it. That is
 * not a hole in the validator, it is the point of the channel, and a generated "corruption" can
 * silently be a legal claim. (Learned the hard way: reversing the pairing of a palindromic row
 * list was accepted, correctly.)
 */
describe('pairing: the content gate', () => {
	it('refuses an in-range bijection the parse disagrees with', () => {
		const source = 'alpha\n\nbeta\n\ngamma\n\n'
		const tree = buildTree(source)
		const roots = tree.roots()
		const ids = roots.map(node => node.id)
		const plan = movePlan(roots, roots[0], 2)
		if (!plan?.window.pairing) throw new Error('expected a plan carrying a pairing')
		const value = tree.value()
		const next = value.slice(0, plan.window.start) + plan.text + value.slice(plan.window.end)

		// The IDENTITY permutation: in range, a bijection, and flatly contradicted by the parse —
		// root 0 now holds 'beta' where the claim says it continues the node that held 'alpha'.
		adopt(tree, {...plan.window, pairing: [0, 1, 2]}, parseRows(next))

		expect(tree.value()).toBe(next)
		// Discarded, so adoption fell back to its ordinary walks: the ids stay in place and the
		// contents rotate under them — today's behaviour, unchanged.
		expect(tree.roots().map(node => node.id)).toEqual(ids)
	})
})