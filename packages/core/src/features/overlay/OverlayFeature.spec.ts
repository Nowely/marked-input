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
			store.state.overlayTrigger(() => undefined)
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should set overlayMatch when checkOverlay is emitted', () => {
			store.state.overlayTrigger(() => undefined)
			controller.enable()

			store.event.checkOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should react to change event when showOverlayOn includes change', () => {
			store.state.overlayTrigger(() => undefined)
			store.state.showOverlayOn('change')
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.change()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should not react to change event when showOverlayOn does not include change', () => {
			store.state.overlayTrigger(() => undefined)
			store.state.showOverlayOn('selectionChange')
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.change()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should be idempotent — calling enable twice does not double-subscribe', () => {
			store.state.overlayTrigger(() => undefined)
			controller.enable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('should stop reacting to events after disable', () => {
			store.state.overlayTrigger(() => undefined)
			controller.enable()
			controller.disable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()
			store.event.checkOverlay()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should allow re-enabling after disable', () => {
			store.state.overlayTrigger(() => undefined)
			controller.enable()
			controller.disable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})
})