import {describe, expect, it} from 'vitest'

import {readSelected} from './readSelected'
import {computed, signal} from './signals'

/** A controller's shape: a reactive field of its own, and verbs on the prototype. */
class RowsLike {
	readonly selected = computed(() => ['row-1'])
	moveTo(): string {
		return 'moved'
	}
}

/**
 * The snapshot every `useMarkput` in either adapter takes. Three shapes reach it and the third is
 * the one issue 10 is about: a controller — `store.rows`, `store.edit`, `store.tokens` — is a
 * class instance, so it is neither a signal nor a bag of them, and the whole imperative surface a
 * document UI writes against is reached through one.
 */
describe('readSelected', () => {
	it('calls a reactive target and answers its value', () => {
		const count = signal({initial: 1})
		expect(readSelected(count)).toBe(1)
		count(2)
		expect(readSelected(count)).toBe(2)
	})

	it('unwraps the reactive values of a plain object and passes the rest through', () => {
		const name = signal({initial: 'a'})
		const doubled = computed(() => 2)
		expect(readSelected({name, doubled, plain: 'x'})).toEqual({name: 'a', doubled: 2, plain: 'x'})
	})

	/**
	 * THE PIN. A class instance is answered AS IT IS. What the key-by-key arm would answer instead
	 * is the second assertion, spelled out: a prototype's methods are not enumerable, so `moveTo`
	 * is gone, and `selected` arrives frozen at one reading rather than as the signal it is.
	 */
	it('answers a class instance itself rather than a copy of its enumerable keys', () => {
		const controller = new RowsLike()

		expect(readSelected(controller)).toBe(controller)
		// oxlint-disable-next-line no-misused-spread -- losing the prototype is what is under assertion
		expect(readSelected({...controller})).toEqual({selected: ['row-1']})
	})

	/** Identity, which is what `useSyncExternalStore` compares two snapshots by. */
	it('answers the same instance on every read, so a snapshot never differs on it', () => {
		const controller = new RowsLike()
		expect(readSelected(controller)).toBe(readSelected(controller))
	})
})