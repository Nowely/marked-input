import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

// oxlint-disable-next-line no-unsafe-type-assertion -- test stub for container ref
const stubContainer = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
} as unknown as HTMLDivElement

// Mock document.createElement if not available (for Node test environment)
// oxlint-disable-next-line no-unnecessary-condition -- document may not be defined in Node env
if (!globalThis.document) {
	// oxlint-disable-next-line no-unsafe-type-assertion
	const FakeHTMLElement = function () {} as any
	Object.defineProperty(globalThis, 'document', {
		value: {
			createElement: () => {
				const obj = new FakeHTMLElement()
				Object.setPrototypeOf(obj, FakeHTMLElement.prototype)
				return obj
			},
		},
		configurable: true,
	})
	Object.defineProperty(globalThis, 'HTMLElement', {
		value: FakeHTMLElement,
		configurable: true,
	})
}

describe('FocusFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.refs.container = stubContainer
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'focus') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('afterTokensRendered handler', () => {
		it('always emits sync', () => {
			store.features.focus.enable()

			const syncSpy = vi.spyOn(store.event, 'sync')
			store.event.afterTokensRendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.features.focus.disable()
		})

		it('emits recoverFocus when Mark is set', () => {
			store.setProps({Mark: () => null})
			store.features.focus.enable()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).toHaveBeenCalledOnce()

			store.features.focus.disable()
		})

		it('does not emit recoverFocus when Mark is not set', () => {
			store.features.focus.enable()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).not.toHaveBeenCalled()

			store.features.focus.disable()
		})
	})

	describe('subscription lifecycle', () => {
		it('does not fire afterTokensRendered watcher after disable', () => {
			store.features.focus.enable()
			store.features.focus.disable()

			const syncSpy = vi.spyOn(store.event, 'sync')
			store.event.afterTokensRendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears nodes.focus.target', () => {
			store.features.focus.enable()

			store.nodes.focus.target = document.createElement('div')
			expect(store.nodes.focus.target).toBeDefined()

			store.features.focus.disable()

			expect(store.nodes.focus.target).toBeUndefined()
		})
	})
})