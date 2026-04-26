import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'
import type {TextToken} from '../parsing'

function text(content: string, start: number): TextToken {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

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
			// Set up minimal props so the delete handler has valid edit state.
			store.props.set({
				value: 'test',
				onChange: () => {}, // onChange is required for operations to proceed
			})

			store.drag.enable()
			store.drag.enable() // second call — must not overwrite #unsub

			// After a single disable, the watcher must be gone.
			// If double-enable leaked, the first watcher would still fire.
			store.drag.disable()

			const replaceAll = vi.spyOn(store.value, 'replaceAll')
			store.drag.action({type: 'delete', index: 0})
			expect(replaceAll).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event', () => {
		const store = new Store()
		expect(typeof store.drag.action).toBe('function')
	})

	it('commits drag edits through replaceAll with recovery metadata', () => {
		store.value.current('alpha\n\nbeta\n\n')
		store.parsing.acceptTokens([text('alpha', 0), text('beta', 7)])
		const replaceAll = vi.spyOn(store.value, 'replaceAll')
		store.drag.enable()

		store.drag.action({type: 'delete', index: 0})

		expect(replaceAll).toHaveBeenCalledWith('beta\n\n', {source: 'drag', recover: {kind: 'caret', rawPosition: 6}})
	})
})