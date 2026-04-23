import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

// oxlint-disable-next-line no-unsafe-type-assertion -- test stub for container ref
const stubContainer = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
} as unknown as HTMLDivElement

describe('FocusFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.feature.slots.container(stubContainer)
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'caret') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('rendered handler', () => {
		it('always emits sync', () => {
			const syncSpy = vi.spyOn(store.feature.dom, 'reconcile').mockImplementation(() => {})
			store.feature.caret.enable()

			store.feature.lifecycle.rendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.feature.caret.disable()
		})

		it('runs caret recovery and clears recovery state when Mark is set', () => {
			vi.spyOn(store.feature.dom, 'reconcile').mockImplementation(() => {})
			store.props.set({Mark: () => null})
			store.feature.caret.enable()

			const target = document.createElement('div')
			Object.defineProperty(target, 'isConnected', {value: true, configurable: true})
			store.nodes.focus.target = target
			store.feature.caret.state.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.feature.lifecycle.rendered()

			expect(store.feature.caret.state.recovery()).toBeUndefined()

			store.feature.caret.disable()
		})

		it('does not run recovery when Mark is not set', () => {
			vi.spyOn(store.feature.dom, 'reconcile').mockImplementation(() => {})
			store.feature.caret.enable()

			store.feature.caret.state.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.feature.lifecycle.rendered()

			expect(store.feature.caret.state.recovery()).toBeDefined()

			store.feature.caret.disable()
		})
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			const syncSpy = vi.spyOn(store.feature.dom, 'reconcile').mockImplementation(() => {})
			store.feature.caret.enable()
			store.feature.caret.disable()

			store.feature.lifecycle.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears nodes.focus.target', () => {
			store.feature.caret.enable()

			store.nodes.focus.target = document.createElement('div')
			expect(store.nodes.focus.target).toBeDefined()

			store.feature.caret.disable()

			expect(store.nodes.focus.target).toBeUndefined()
		})
	})
})