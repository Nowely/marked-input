import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('CaretFeature', () => {
	it('owns recovery and selecting signals', () => {
		const store = new Store()
		expect(typeof store.caret.recovery).toBe('function')
		expect(typeof store.caret.selecting).toBe('function')
	})

	it('exposes location and raw-position recovery', () => {
		const store = new Store()
		expect(store.caret.location()).toBeUndefined()
		store.caret.recovery({kind: 'caret', rawPosition: 0})
		expect(store.caret.recovery()).toEqual({kind: 'caret', rawPosition: 0})
	})
})