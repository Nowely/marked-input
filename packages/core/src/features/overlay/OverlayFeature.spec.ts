import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import type {OverlayMatch} from '../../shared/types'
import {Store} from '../store/Store'
import type {OverlayFeature} from './OverlayFeature'

const stubDocument = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}

const stubWindow = {
	getSelection: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}

vi.stubGlobal('document', stubDocument)
vi.stubGlobal('window', stubWindow)

const stubMatch: OverlayMatch = {
	value: 'test',
	source: '@',
	span: 'test',
	// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
	node: {} as unknown as Node,
	index: 0,
	option: {},
}

describe('OverlayFeature', () => {
	let store: Store
	let controller: OverlayFeature

	beforeEach(() => {
		vi.clearAllMocks()
		setUseHookFactory(() => () => undefined)
		store = new Store()
		controller = store.features.overlay
	})

	describe('enable()', () => {
		it('should clear overlayMatch when clearOverlay is emitted', () => {
			store.state.overlayTrigger.set(() => undefined)
			controller.enable()

			store.state.overlayMatch.set(stubMatch)

			store.events.clearOverlay.emit()

			expect(store.state.overlayMatch.get()).toBeUndefined()
		})

		it('should set overlayMatch when checkOverlay is emitted', () => {
			store.state.overlayTrigger.set(() => undefined)
			controller.enable()

			store.events.checkOverlay.emit()

			expect(store.state.overlayMatch.get()).toBeUndefined()
		})

		it('should react to change event when showOverlayOn includes change', () => {
			store.state.overlayTrigger.set(() => undefined)
			store.state.showOverlayOn.set('change')
			controller.enable()

			store.state.overlayMatch.set(stubMatch)

			store.events.change.emit()

			expect(store.state.overlayMatch.get()).toBeUndefined()
		})

		it('should not react to change event when showOverlayOn does not include change', () => {
			store.state.overlayTrigger.set(() => undefined)
			store.state.showOverlayOn.set('selectionChange')
			controller.enable()

			store.state.overlayMatch.set(stubMatch)

			store.events.change.emit()

			expect(store.state.overlayMatch.get()).toBe(stubMatch)
		})

		it('should be idempotent — calling enable twice does not double-subscribe', () => {
			store.state.overlayTrigger.set(() => undefined)
			controller.enable()
			controller.enable()

			store.state.overlayMatch.set(stubMatch)

			store.events.clearOverlay.emit()

			expect(store.state.overlayMatch.get()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('should stop reacting to events after disable', () => {
			store.state.overlayTrigger.set(() => undefined)
			controller.enable()
			controller.disable()

			store.state.overlayMatch.set(stubMatch)

			store.events.clearOverlay.emit()
			store.events.checkOverlay.emit()

			expect(store.state.overlayMatch.get()).toBe(stubMatch)
		})

		it('should allow re-enabling after disable', () => {
			store.state.overlayTrigger.set(() => undefined)
			controller.enable()
			controller.disable()
			controller.enable()

			store.state.overlayMatch.set(stubMatch)

			store.events.clearOverlay.emit()

			expect(store.state.overlayMatch.get()).toBeUndefined()
		})
	})
})