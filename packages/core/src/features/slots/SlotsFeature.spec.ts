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

	it('aliases every field with the legacy store maps', () => {
		const store = new Store()
		expect(store.feature.slots.state.container).toBe(store.state.container)
		expect(store.feature.slots.computed.isBlock).toBe(store.computed.isBlock)
		expect(store.feature.slots.computed.isDraggable).toBe(store.computed.isDraggable)
		expect(store.feature.slots.computed.containerComponent).toBe(store.computed.containerComponent)
		expect(store.feature.slots.computed.containerProps).toBe(store.computed.containerProps)
		expect(store.feature.slots.computed.blockComponent).toBe(store.computed.blockComponent)
		expect(store.feature.slots.computed.blockProps).toBe(store.computed.blockProps)
		expect(store.feature.slots.computed.spanComponent).toBe(store.computed.spanComponent)
		expect(store.feature.slots.computed.spanProps).toBe(store.computed.spanProps)
	})
})