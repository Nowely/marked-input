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
	})

	it('updates caret location from focus inside structural text surface', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const container = document.createElement('div')
		const text = document.createElement('span')
		container.append(text)
		store.dom.container(container)
		store.lifecycle.mounted()
		store.lifecycle.rendered()

		text.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

		expect(store.caret.location()?.role).toBe('text')
	})

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			const syncSpy = vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})

			store.lifecycle.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('focusout clears range', () => {
		it('range is undefined after focusout', () => {
			const store = new Store()
			const container = document.createElement('div')
			store.dom.container(container)
			store.lifecycle.mounted()

			store.caret.range({start: 2, end: 2})
			container.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))

			expect(store.caret.range()).toBeUndefined()
		})
	})
})