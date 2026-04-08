import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../store/Store'
import type {ContentEditableController} from './ContentEditableController'

describe('ContentEditableController', () => {
	let store: Store
	let controller: ContentEditableController

	beforeEach(() => {
		vi.clearAllMocks()
		setUseHookFactory(() => () => undefined)
		store = new Store({defaultSpan: null})
		controller = store.controllers.contentEditable
	})

	it('enable() calls sync() immediately (effect fires on creation)', () => {
		const syncSpy = vi.spyOn(controller, 'sync')
		controller.enable()
		expect(syncSpy).toHaveBeenCalled()
	})

	it('enable() is idempotent — calling twice does not double-subscribe', () => {
		const syncSpy = vi.spyOn(controller, 'sync')
		controller.enable()
		const callCount = syncSpy.mock.calls.length
		controller.enable()
		// Second enable should not add extra calls
		expect(syncSpy).toHaveBeenCalledTimes(callCount)
	})

	it('changing readOnly after enable() triggers sync() again', () => {
		controller.enable()
		const syncSpy = vi.spyOn(controller, 'sync')
		store.state.readOnly.set(true)
		expect(syncSpy).toHaveBeenCalled()
	})

	it('disable() stops reactive subscriptions — readOnly change no longer triggers sync()', () => {
		controller.enable()
		controller.disable()
		const syncSpy = vi.spyOn(controller, 'sync')
		store.state.readOnly.set(true)
		expect(syncSpy).not.toHaveBeenCalled()
	})

	it('selecting becoming undefined after enable() triggers sync()', () => {
		controller.enable()
		store.state.selecting.set('drag')
		const syncSpy = vi.spyOn(controller, 'sync')
		store.state.selecting.set(undefined)
		expect(syncSpy).toHaveBeenCalled()
	})

	it('selecting changing to non-undefined does not trigger sync()', () => {
		controller.enable()
		const syncSpy = vi.spyOn(controller, 'sync')
		store.state.selecting.set('drag')
		expect(syncSpy).not.toHaveBeenCalled()
	})
})