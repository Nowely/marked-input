import {describe, expect, it} from 'vitest'

import {markToken, textToken} from '../__testing__/tokenFactories'
import {Parser} from '../parser/Parser'
import {createIdentityTracker} from '../tokenIdentity'
import {fromReconcile} from './commitInput'

describe('fromReconcile', () => {
	it('lowers reconcile `structural` to the `render` routing bit', () => {
		// The names differ on purpose: the tree core reserves `structural` for
		// add/remove only, while reconcile's flag also covers a refused-descend
		// mark. `render` is the union — the bit the pipeline has always routed on.
		const token = markToken('y', '@[y]', 2)
		const input = fromReconcile({
			tokens: [token],
			structural: true,
			changes: [{id: 4, token, path: [0], kind: 'text'}],
			removedIds: [],
		})
		expect(input.render).toBe(true)
		expect(input.tokens).toEqual([token])
	})

	it("maps kind 'update' to a refresh-only change and everything else to a patch", () => {
		const a = textToken('a', 0)
		const b = textToken('b', 1)
		const c = textToken('c', 2)
		const input = fromReconcile({
			tokens: [a, b, c],
			structural: true,
			changes: [
				{id: 1, token: a, path: [0], kind: 'text'},
				{id: 2, token: b, path: [1], kind: 'update'},
				{id: 3, token: c, path: [2], kind: 'add'},
			],
			removedIds: [9],
		})
		expect(input.changes).toEqual([
			{id: 1, token: a, patch: true},
			{id: 2, token: b, patch: false},
			{id: 3, token: c, patch: true},
		])
		// THE gate on the delta mapping: mutating `updated` to [] in fromReconcile
		// leaves the rest of the suite green — the live `changed` consumers only
		// read `removed`.
		expect(input.delta).toEqual({added: [3], removed: [9], updated: [1]})
	})

	describe('the subtree contract (TokenDelta)', () => {
		// '#[ab]tail' → [text '' [0,0], mark '#[ab]' [0,5] (children: [text 'ab' [2,4]]), text 'tail' [5,9]]
		const parser = new Parser(['#[__slot__]'])

		it('flattens `added`: a born mark contributes its descendant ids too', () => {
			// THE pinned granularity, and the one every other lowering must match:
			// `fromTransaction` lowers `TransactionResult.added`, which carries
			// subtree ROOTS only, so it has to walk. Roots-only here would make
			// `foldDelta` announce the child's removal (removed IS subtree-inclusive)
			// without ever announcing its add.
			const tracker = createIdentityTracker()
			tracker.reconcile(parser.parse('tail'))

			const result = tracker.reconcile(parser.parse('#[ab]tail'), {start: 0, end: 0, insertedLength: 5})
			const mark = result.tokens.find(token => token.type === 'mark')
			if (mark?.type !== 'mark') throw new Error('expected the inserted mark in the reconciled tree')

			expect(fromReconcile(result).delta.added).toEqual(
				expect.arrayContaining([tracker.idOf(mark), tracker.idOf(mark.children[0])])
			)
		})

		it('`removed` is subtree-inclusive on the same edit reversed — the two id feeds agree', () => {
			const tracker = createIdentityTracker()
			const first = tracker.reconcile(parser.parse('#[ab]tail')).tokens
			const mark = first[1]
			if (mark.type !== 'mark') throw new Error('expected mark')

			const result = tracker.reconcile(parser.parse('tail'), {start: 0, end: 5, insertedLength: 0})

			expect(fromReconcile(result).delta.removed).toEqual(
				expect.arrayContaining([tracker.idOf(mark), tracker.idOf(mark.children[0])])
			)
		})
	})
})