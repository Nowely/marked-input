import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('SlotsFeature', () => {
	it('does not own DOM refs', () => {
		const store = new Store()
		expect('container' in store.slots).toBe(false)
	})

	it('exposes every slot computed', () => {
		const store = new Store()
		expect(typeof store.slots.containerComponent()).toBeTruthy()
		expect(typeof store.slots.containerProps()).toBe('object')
		expect(typeof store.slots.blockComponent()).toBeTruthy()
		expect(store.slots.blockProps()).toBeUndefined()
	})
})