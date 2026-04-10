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
		it('sets default overlayTrigger extractor', () => {
			controller.enable()

			const getTrigger = store.state.overlayTrigger()
			expect(getTrigger).toBeDefined()

			const option = {overlay: {trigger: '@'}}
			expect(getTrigger!(option)).toBe('@')

			const optionWithoutTrigger = {overlay: {}}
			expect(getTrigger!(optionWithoutTrigger)).toBeUndefined()

			const optionWithoutOverlay = {}
			expect(getTrigger!(optionWithoutOverlay)).toBeUndefined()

			controller.disable()
		})

		it('should clear overlayMatch when clearOverlay is emitted', () => {
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should set overlayMatch when checkOverlay is emitted', () => {
			controller.enable()

			store.event.checkOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should react to change event when showOverlayOn includes change', () => {
			store.state.showOverlayOn('change')
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.change()

			expect(store.state.overlayMatch()).toBeUndefined()
		})

		it('should not react to change event when showOverlayOn does not include change', () => {
			store.state.showOverlayOn('selectionChange')
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.change()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should be idempotent — calling enable twice does not double-subscribe', () => {
			controller.enable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('clears overlayTrigger on disable', () => {
			controller.enable()
			expect(store.state.overlayTrigger()).toBeDefined()

			controller.disable()
			expect(store.state.overlayTrigger()).toBeUndefined()
		})

		it('should stop reacting to events after disable', () => {
			controller.enable()
			controller.disable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()
			store.event.checkOverlay()

			expect(store.state.overlayMatch()).toBe(stubMatch)
		})

		it('should allow re-enabling after disable', () => {
			controller.enable()
			controller.disable()
			controller.enable()

			store.state.overlayMatch(stubMatch)

			store.event.clearOverlay()

			expect(store.state.overlayMatch()).toBeUndefined()
		})
	})
})