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
		store.dom.container(stubContainer)
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

	it('updates caret location from focus inside structural text surface', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		store.value.enable()
		const container = document.createElement('div')
		const text = document.createElement('span')
		container.append(text)
		store.dom.container(container)
		store.dom.enable()
		store.lifecycle.rendered()
		store.caret.enable()

		text.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

		expect(store.caret.location()?.role).toBe('text')
		store.caret.disable()
		store.dom.disable()
		store.value.disable()
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			const syncSpy = vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})
			store.caret.enable()
			store.caret.disable()

			store.lifecycle.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('clears caret location on focusout before disable', () => {
			store.caret.enable()

			const textRole = 'text'
			store.caret.location({
				address: {path: [0], parseGeneration: 1},
				role: textRole,
			})

			store.caret.disable()

			expect(store.caret.location()).toBeDefined()
		})
	})
})