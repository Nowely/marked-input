import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('SlotsFeature', () => {
	it('exposes container DOM ref and every slot computed', () => {
		const store = new Store()
		expect(store.feature.slots.state.container()).toBe(null)
		expect(store.feature.slots.computed.isBlock()).toBe(false)
		expect(store.feature.slots.computed.isDraggable()).toBe(false)
		expect(typeof store.feature.slots.computed.containerComponent()).toBeTruthy()
	})

	it('exposes every slot computed', () => {
		const store = new Store()
		expect(store.feature.slots.state.container()).toBe(null)
		expect(typeof store.feature.slots.computed.isBlock()).toBe('boolean')
		expect(typeof store.feature.slots.computed.isDraggable()).toBe('boolean')
		expect(typeof store.feature.slots.computed.containerComponent()).toBeTruthy()
		expect(typeof store.feature.slots.computed.containerProps()).toBe('object')
		expect(typeof store.feature.slots.computed.blockComponent()).toBeTruthy()
		expect(store.feature.slots.computed.blockProps()).toBeUndefined()
		expect(typeof store.feature.slots.computed.spanComponent()).toBeTruthy()
		expect(store.feature.slots.computed.spanProps()).toBeUndefined()
	})
})