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
		store.state.container(stubContainer)
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'focus') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('rendered handler', () => {
		it('always emits sync', () => {
			store.feature.focus.enable()

			const syncSpy = vi.spyOn(store.emit, 'sync')
			store.emit.rendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.feature.focus.disable()
		})

		it('runs caret recovery and clears recovery state when Mark is set', () => {
			store.setProps({Mark: () => null})
			store.feature.focus.enable()

			// Set up a recovery state so #recover has work to do.
			// #recover() clears the recovery state on the happy path.
			const target = document.createElement('div')
			// Ensure target reports as connected for the happy path.
			Object.defineProperty(target, 'isConnected', {value: true, configurable: true})
			store.nodes.focus.target = target
			store.state.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.emit.rendered()

			// #recover clears recovery after running.
			expect(store.state.recovery()).toBeUndefined()

			store.feature.focus.disable()
		})

		it('does not run recovery when Mark is not set', () => {
			store.feature.focus.enable()

			store.state.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.emit.rendered()

			// #recover was NOT called, so recovery state is preserved.
			expect(store.state.recovery()).toBeDefined()

			store.feature.focus.disable()
		})
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			store.feature.focus.enable()
			store.feature.focus.disable()

			const syncSpy = vi.spyOn(store.emit, 'sync')
			store.emit.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears nodes.focus.target', () => {
			store.feature.focus.enable()

			store.nodes.focus.target = document.createElement('div')
			expect(store.nodes.focus.target).toBeDefined()

			store.feature.focus.disable()

			expect(store.nodes.focus.target).toBeUndefined()
		})
	})
})