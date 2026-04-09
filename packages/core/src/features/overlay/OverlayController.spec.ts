import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../store/Store'
import type {OverlayController} from './OverlayController'

const stubDocument = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}

const stubWindow = {
	getSelection: vi.fn(),
}

vi.stubGlobal('document', stubDocument)
vi.stubGlobal('window', stubWindow)

describe('OverlayController', () => {
	let store: Store
	let controller: OverlayController

	beforeEach(() => {
		vi.clearAllMocks()
		setUseHookFactory(() => () => undefined)
		store = new Store({defaultSpan: null})
		controller = store.controllers.overlay
	})

	describe('enableTrigger()', () => {
		it('should call onMatch(undefined) when clearOverlay is emitted', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined

			controller.enableTrigger(getTrigger, onMatch)

			store.events.clearOverlay.emit()

			expect(onMatch).toHaveBeenCalledWith(undefined)
		})

		it('should call onMatch when checkOverlay is emitted', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined

			controller.enableTrigger(getTrigger, onMatch)

			store.events.checkOverlay.emit()

			// onMatch is called with whatever TriggerFinder.find returns (undefined when no options)
			expect(onMatch).toHaveBeenCalled()
		})

		it('should react to change event when showOverlayOn includes change', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined
			store.state.showOverlayOn.set('change')

			controller.enableTrigger(getTrigger, onMatch)

			store.events.change.emit()

			// change handler should trigger checkOverlay, which calls onMatch
			expect(onMatch).toHaveBeenCalled()
		})

		it('should not react when showOverlayOn changes without a new change event', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined
			store.state.showOverlayOn.set('selectionChange')

			controller.enableTrigger(getTrigger, onMatch)

			store.events.change.emit()
			expect(onMatch).not.toHaveBeenCalled()

			store.state.showOverlayOn.set('change')
			expect(onMatch).not.toHaveBeenCalled()
		})

		it('should be idempotent — calling enableTrigger twice does not double-subscribe', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined

			controller.enableTrigger(getTrigger, onMatch)
			controller.enableTrigger(getTrigger, onMatch)

			store.events.clearOverlay.emit()

			expect(onMatch).toHaveBeenCalledTimes(1)
		})
	})

	describe('disable()', () => {
		it('should stop reacting to events after disable', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined

			controller.enableTrigger(getTrigger, onMatch)
			controller.disable()

			store.events.clearOverlay.emit()
			store.events.checkOverlay.emit()

			expect(onMatch).not.toHaveBeenCalled()
		})

		it('should allow re-enabling after disable', () => {
			const onMatch = vi.fn()
			const getTrigger = () => undefined

			controller.enableTrigger(getTrigger, onMatch)
			controller.disable()
			controller.enableTrigger(getTrigger, onMatch)

			store.events.clearOverlay.emit()

			expect(onMatch).toHaveBeenCalledWith(undefined)
			expect(onMatch).toHaveBeenCalledTimes(1)
		})
	})
})