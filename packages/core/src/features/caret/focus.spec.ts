import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

function renderedPayload() {
	return {container: document.createElement('div'), layout: 'inline' as const}
}

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
		store.slots.container(stubContainer)
		const features: Record<string, {enable(): void; disable(): void}> = {
			lifecycle: store.lifecycle,
			value: store.value,
			mark: store.mark,
			overlay: store.overlay,
			slots: store.slots,
			keyboard: store.keyboard,
			dom: store.dom,
			drag: store.drag,
			clipboard: store.clipboard,
			parsing: store.parsing,
		}
		for (const key of Object.keys(features)) {
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('rendered handler', () => {
		it('always emits sync', () => {
			const syncSpy = vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})
			store.caret.enable()

			store.lifecycle.rendered(renderedPayload())

			expect(syncSpy).toHaveBeenCalledOnce()

			store.caret.disable()
		})

		it('runs caret recovery and clears recovery state when Mark is set', () => {
			vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})
			store.props.set({Mark: () => null})
			store.caret.enable()

			const target = document.createElement('div')
			Object.defineProperty(target, 'isConnected', {value: true, configurable: true})
			store.nodes.focus.target = target
			store.caret.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.lifecycle.rendered(renderedPayload())

			expect(store.caret.recovery()).toBeUndefined()

			store.caret.disable()
		})

		it('does not run recovery when Mark is not set', () => {
			vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})
			store.caret.enable()

			store.caret.recovery({
				anchor: store.nodes.focus,
				caret: 0,
			})

			store.lifecycle.rendered(renderedPayload())

			expect(store.caret.recovery()).toBeDefined()

			store.caret.disable()
		})
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			const syncSpy = vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})
			store.caret.enable()
			store.caret.disable()

			store.lifecycle.rendered(renderedPayload())

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears nodes.focus.target', () => {
			store.caret.enable()

			store.nodes.focus.target = document.createElement('div')
			expect(store.nodes.focus.target).toBeDefined()

			store.caret.disable()

			expect(store.nodes.focus.target).toBeUndefined()
		})
	})
})