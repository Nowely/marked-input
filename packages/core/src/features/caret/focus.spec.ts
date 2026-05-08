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

	describe('subscription lifecycle', () => {
		it('does not fire rendered watcher after disable', () => {
			const syncSpy = vi.spyOn(store.dom, 'reconcile').mockImplementation(() => {})

			store.lifecycle.rendered()

			expect(syncSpy).not.toHaveBeenCalled()
		})
	})

	describe('focusout clears range when focus leaves editor', () => {
		it('range becomes undefined after focusout when active focus is outside editor', async () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.append(container)
			store.dom.container(container)
			store.lifecycle.mounted()

			store.caret.range({start: 2, end: 2})
			container.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))
			// queueMicrotask tick for the deferred clear
			await Promise.resolve()

			expect(store.caret.range()).toBeUndefined()
			container.remove()
		})
	})
})