import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('DomFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
	})

	it('enable() calls reconcile() immediately (effect fires on creation)', () => {
		const controller = store.feature.dom
		const reconcileSpy = vi.spyOn(controller, 'reconcile')
		controller.enable()
		expect(reconcileSpy).toHaveBeenCalled()
	})

	it('enable() is idempotent — calling twice does not double-subscribe', () => {
		const controller = store.feature.dom
		const reconcileSpy = vi.spyOn(controller, 'reconcile')
		controller.enable()
		const callCount = reconcileSpy.mock.calls.length
		controller.enable()
		expect(reconcileSpy).toHaveBeenCalledTimes(callCount)
	})

	it('changing readOnly after enable() triggers reconcile() again', () => {
		store.feature.dom.enable()
		const reconcileSpy = vi.spyOn(store.feature.dom, 'reconcile')
		store.props.set({readOnly: true})
		expect(reconcileSpy).toHaveBeenCalled()
	})

	it('disable() stops reactive subscriptions — readOnly change no longer triggers reconcile()', () => {
		store.feature.dom.enable()
		store.feature.dom.disable()
		const reconcileSpy = vi.spyOn(store.feature.dom, 'reconcile')
		store.props.set({readOnly: true})
		expect(reconcileSpy).not.toHaveBeenCalled()
	})

	it('selecting becoming undefined after enable() triggers reconcile()', () => {
		store.feature.dom.enable()
		store.feature.caret.state.selecting('drag')
		const reconcileSpy = vi.spyOn(store.feature.dom, 'reconcile')
		store.feature.caret.state.selecting(undefined)
		expect(reconcileSpy).toHaveBeenCalled()
	})

	it('selecting changing to non-undefined does not trigger reconcile()', () => {
		store.feature.dom.enable()
		const reconcileSpy = vi.spyOn(store.feature.dom, 'reconcile')
		store.feature.caret.state.selecting('drag')
		expect(reconcileSpy).not.toHaveBeenCalled()
	})
})