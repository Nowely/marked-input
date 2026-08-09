import {describe, expect, it} from 'vitest'

import {markToken, textToken} from '../__testing__/tokenFactories'
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
})