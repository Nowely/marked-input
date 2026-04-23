import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('DragFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		// Disable all feature except drag so their enable() side-effects don't interfere
		const features: Record<string, {enable(): void; disable(): void}> = {
			lifecycle: store.lifecycle,
			value: store.value,
			mark: store.mark,
			overlay: store.overlay,
			slots: store.slots,
			caret: store.caret,
			keyboard: store.keyboard,
			dom: store.dom,
			clipboard: store.clipboard,
			parsing: store.parsing,
		}
		for (const key of Object.keys(features)) {
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('enable()', () => {
		it('is a no-op when already enabled (does not leak a watcher)', () => {
			// Set up minimal props so the delete handler will actually call next
			store.props.set({
				value: 'test',
				onChange: () => {}, // onChange is required for operations to proceed
			})

			store.drag.enable()
			store.drag.enable() // second call — must not overwrite #unsub

			// After a single disable, the watcher must be gone.
			// If double-enable leaked, the first watcher would still fire.
			store.drag.disable()

			const reorderSpy = vi.spyOn(store.value, 'next')
			store.drag.drag({type: 'delete', index: 0})
			expect(reorderSpy).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event', () => {
		const store = new Store()
		expect(typeof store.drag.drag).toBe('function')
	})
})