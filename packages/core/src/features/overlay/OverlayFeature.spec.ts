import {describe, it, expect, beforeEach} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import type {OverlayFeature} from './OverlayFeature'

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
		store = new Store()
		controller = store.feature.overlay
	})

	describe('ownership', () => {
		it('owns overlayMatch, overlay (DOM ref), overlay (computed), overlaySelect, overlayClose', () => {
			expect(typeof store.feature.overlay.state.overlayMatch).toBe('function')
			expect(typeof store.feature.overlay.state.overlay).toBe('function')
			expect(typeof store.feature.overlay.computed.overlay).toBe('function')
			expect(typeof store.feature.overlay.emit.overlaySelect).toBe('function')
			expect(typeof store.feature.overlay.emit.overlayClose).toBe('function')
		})
	})

	describe('enable()', () => {
		it('probes overlay trigger on change when showOverlayOn includes change', () => {
			controller.enable()

			store.feature.value.emit.change()

			expect(store.feature.overlay.state.overlayMatch()).toBeUndefined()

			controller.disable()
		})

		it('clear overlayMatch when overlayClose is emitted', () => {
			controller.enable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.overlay.emit.overlayClose()

			expect(store.feature.overlay.state.overlayMatch()).toBeUndefined()
		})

		it('react to change event when showOverlayOn includes change', () => {
			store.props.set({showOverlayOn: 'change'})
			controller.enable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.value.emit.change()

			expect(store.feature.overlay.state.overlayMatch()).toBeUndefined()
		})

		it('not react to change event when showOverlayOn does not include change', () => {
			store.props.set({showOverlayOn: 'selectionChange'})
			controller.enable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.value.emit.change()

			expect(store.feature.overlay.state.overlayMatch()).toBe(stubMatch)
		})

		it('be idempotent — calling enable twice does not double-subscribe', () => {
			controller.enable()
			controller.enable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.overlay.emit.overlayClose()

			expect(store.feature.overlay.state.overlayMatch()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('stop reacting to events after disable', () => {
			controller.enable()
			controller.disable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.overlay.emit.overlayClose()
			store.feature.value.emit.change()

			expect(store.feature.overlay.state.overlayMatch()).toBe(stubMatch)
		})

		it('allow re-enabling after disable', () => {
			controller.enable()
			controller.disable()
			controller.enable()

			store.feature.overlay.state.overlayMatch(stubMatch)

			store.feature.overlay.emit.overlayClose()

			expect(store.feature.overlay.state.overlayMatch()).toBeUndefined()
		})
	})
})