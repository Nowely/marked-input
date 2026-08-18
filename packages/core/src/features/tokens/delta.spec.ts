import {describe, expect, it} from 'vitest'

import {createDeltaLedger} from './delta'

/**
 * The announcement ALGEBRA, exercised directly. No DOM, no bind, no adoption result — the
 * ledger speaks ids, so every rule below is one call and one comparison.
 *
 * This suite exists because of a measured hole rather than for symmetry. The rule that keeps
 * one id out of `added` and `updated` at once was covered by NO test — not in this derivation
 * and not in the three-`Set` accumulator it replaced — and deleting it left all 989 core cases
 * green. Reaching that rule THROUGH the pipeline needs two applies inside one pending window
 * (`commitPipeline.spec.ts` has that case, and it is the integration statement); reaching it
 * here is two lines.
 *
 * Sets are compared as SORTED arrays throughout: order is explicitly unspecified
 * ({@link TokenDelta}), so asserting it would pin something no consumer may rely on.
 */
const sorted = (ids: readonly number[]) => ids.toSorted((a, b) => a - b)

describe('the delta ledger', () => {
	it('announces every id of the first space as added', () => {
		const ledger = createDeltaLedger()

		const delta = ledger.announce(new Set([1, 2, 3]))

		expect(sorted(delta.added)).toEqual([1, 2, 3])
		expect(delta.removed).toEqual([])
		expect(delta.updated).toEqual([])
	})

	it('announces three empty lists when the space did not move', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2]))

		const delta = ledger.announce(new Set([1, 2]))

		expect(delta).toEqual({added: [], removed: [], updated: []})
	})

	it('announces an id that left the space as removed', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2, 3]))

		const delta = ledger.announce(new Set([1, 3]))

		expect(delta.added).toEqual([])
		expect(delta.removed).toEqual([2])
	})

	it('announces a touched id that is still known as updated', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2]))
		ledger.touch(2)

		expect(ledger.announce(new Set([1, 2])).updated).toEqual([2])
	})

	it('drops a touch on an id that left in the same round', () => {
		// The accumulator spelled this as `into.updated.delete(id)` on every removal. Here it
		// is `∩ ids`, and an update to a node that then died is moot either way.
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2]))
		ledger.touch(2)

		const delta = ledger.announce(new Set([1]))

		expect(delta.removed).toEqual([2])
		expect(delta.updated).toEqual([])
	})

	it('lists an id BORN and touched in the same round as added only, never also updated', () => {
		// THE rule mutation testing found uncovered — `∩ announced`. Deleting it puts 2 in
		// both lists, which is what a consumer refreshing per-node state off `added` and then
		// again off `updated` would do twice.
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1]))
		ledger.touch(2)

		const delta = ledger.announce(new Set([1, 2]))

		expect(delta.added).toEqual([2])
		expect(delta.updated).toEqual([])
	})

	it('announces an id born and gone before any announcement as neither', () => {
		// The accumulator's other cancellation, and here it is not a rule at all: an id that
		// entered no announced space and is in no current one appears in no difference.
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1]))
		ledger.touch(9)

		const delta = ledger.announce(new Set([1]))

		expect(delta).toEqual({added: [], removed: [], updated: []})
	})

	it('drains touches, so a second announcement of the same space is empty', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2]))
		ledger.touch(2)
		ledger.announce(new Set([1, 2]))

		expect(ledger.announce(new Set([1, 2]))).toEqual({added: [], removed: [], updated: []})
	})

	it('announceUnchanged reports the touched ids and moves neither end of the space', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1, 2, 3]))
		ledger.touch(3)

		const delta = ledger.announceUnchanged()

		expect(delta).toEqual({added: [], removed: [], updated: [3]})
		// The space itself is untouched: the next real announcement still diffs against all
		// three, which is what makes the text path's shortcut safe.
		expect(ledger.announce(new Set([1, 2, 3]))).toEqual({added: [], removed: [], updated: []})
	})

	it('announceUnchanged drains its touches too', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1]))
		ledger.touch(1)
		ledger.announceUnchanged()

		expect(ledger.announceUnchanged().updated).toEqual([])
	})

	it('announceUnchanged ignores a touch on an id it never announced', () => {
		const ledger = createDeltaLedger()
		ledger.announce(new Set([1]))
		ledger.touch(7)

		expect(ledger.announceUnchanged().updated).toEqual([])
	})
})