import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('DragFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		// Disable all features except drag so their enable() side-effects don't interfere
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'drag') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('enable()', () => {
		it('is a no-op when already enabled (does not leak a watcher)', () => {
			// Set up minimal props so the delete handler will actually call innerValue
			store.setProps({
				value: () => 'test',
				onChange: () => {}, // onChange is required for operations to proceed
			})

			store.features.drag.enable()
			store.features.drag.enable() // second call — must not overwrite #unsub

			// After a single disable, the watcher must be gone.
			// If double-enable leaked, the first watcher would still fire.
			store.features.drag.disable()

			const reorderSpy = vi.spyOn(store.state, 'innerValue')
			store.event.dragAction({type: 'delete', index: 0})
			expect(reorderSpy).not.toHaveBeenCalled()
		})
	})
})