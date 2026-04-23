import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('SlotsFeature', () => {
	it('exposes container DOM ref and every slot computed', () => {
		const store = new Store()
		expect(store.slots.container()).toBe(null)
		expect(store.slots.isBlock()).toBe(false)
		expect(store.slots.isDraggable()).toBe(false)
		expect(typeof store.slots.containerComponent()).toBeTruthy()
	})

	it('exposes every slot computed', () => {
		const store = new Store()
		expect(store.slots.container()).toBe(null)
		expect(typeof store.slots.isBlock()).toBe('boolean')
		expect(typeof store.slots.isDraggable()).toBe('boolean')
		expect(typeof store.slots.containerComponent()).toBeTruthy()
		expect(typeof store.slots.containerProps()).toBe('object')
		expect(typeof store.slots.blockComponent()).toBeTruthy()
		expect(store.slots.blockProps()).toBeUndefined()
		expect(typeof store.slots.spanComponent()).toBeTruthy()
		expect(store.slots.spanProps()).toBeUndefined()
	})
})