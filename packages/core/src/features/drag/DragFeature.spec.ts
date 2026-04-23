import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('DragFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		// Disable all feature except drag so their enable() side-effects don't interfere
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'drag') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('enable()', () => {
		it('is a no-op when already enabled (does not leak a watcher)', () => {
			// Set up minimal props so the delete handler will actually call innerValue
			store.setProps({
				value: 'test',
				onChange: () => {}, // onChange is required for operations to proceed
			})

			store.feature.drag.enable()
			store.feature.drag.enable() // second call — must not overwrite #unsub

			// After a single disable, the watcher must be gone.
			// If double-enable leaked, the first watcher would still fire.
			store.feature.drag.disable()

			const reorderSpy = vi.spyOn(store.state, 'innerValue')
			store.emit.drag({type: 'delete', index: 0})
			expect(reorderSpy).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event (aliased with legacy store.emit.drag)', () => {
		const store = new Store()
		expect(store.feature.drag.emit.drag).toBe(store.emit.drag)
	})
})