import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('SlotsFeature', () => {
	it('exposes container DOM ref and every slot computed', () => {
		const store = new Store()
		expect(store.feature.slots.container()).toBe(null)
		expect(store.feature.slots.isBlock()).toBe(false)
		expect(store.feature.slots.isDraggable()).toBe(false)
		expect(typeof store.feature.slots.containerComponent()).toBeTruthy()
	})

	it('exposes every slot computed', () => {
		const store = new Store()
		expect(store.feature.slots.container()).toBe(null)
		expect(typeof store.feature.slots.isBlock()).toBe('boolean')
		expect(typeof store.feature.slots.isDraggable()).toBe('boolean')
		expect(typeof store.feature.slots.containerComponent()).toBeTruthy()
		expect(typeof store.feature.slots.containerProps()).toBe('object')
		expect(typeof store.feature.slots.blockComponent()).toBeTruthy()
		expect(store.feature.slots.blockProps()).toBeUndefined()
		expect(typeof store.feature.slots.spanComponent()).toBeTruthy()
		expect(store.feature.slots.spanProps()).toBeUndefined()
	})
})