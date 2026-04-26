import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import type {OverlayFeature} from './OverlayFeature'

const stubMatch: OverlayMatch = {
	value: 'test',
	source: '@',
	span: 'test',
	// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
	node: {} as unknown as Node,
	range: {start: 0, end: 1},
	option: {},
}

describe('OverlayFeature', () => {
	let store: Store
	let controller: OverlayFeature

	beforeEach(() => {
		store = new Store()
		controller = store.overlay
	})

	describe('ownership', () => {
		it('owns match, element (DOM ref), slot (computed), select, close', () => {
			expect(typeof store.overlay.match).toBe('function')
			expect(typeof store.overlay.element).toBe('function')
			expect(typeof store.overlay.slot).toBe('function')
			expect(typeof store.overlay.select).toBe('function')
			expect(typeof store.overlay.close).toBe('function')
		})
	})

	describe('enable()', () => {
		it('probes overlay trigger on change when showOverlayOn includes change', () => {
			controller.enable()

			store.value.change()

			expect(store.overlay.match()).toBeUndefined()

			controller.disable()
		})

		it('clear match when close is emitted', () => {
			controller.enable()

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})

		it('react to change event when showOverlayOn includes change', () => {
			store.props.set({showOverlayOn: 'change'})
			controller.enable()

			store.overlay.match(stubMatch)

			store.value.change()

			expect(store.overlay.match()).toBeUndefined()
		})

		it('not react to change event when showOverlayOn does not include change', () => {
			store.props.set({showOverlayOn: 'selectionChange'})
			controller.enable()

			store.overlay.match(stubMatch)

			store.value.change()

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('be idempotent — calling enable twice does not double-subscribe', () => {
			controller.enable()
			controller.enable()

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('stop reacting to events after disable', () => {
			controller.enable()
			controller.disable()

			store.overlay.match(stubMatch)

			store.overlay.close()
			store.value.change()

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('allow re-enabling after disable', () => {
			controller.enable()
			controller.disable()
			controller.enable()

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('select()', () => {
		it('replaces the trigger range through the value pipeline', () => {
			const replaceRange = vi.spyOn(store.value, 'replaceRange')
			const mark = {
				type: 'text' as const,
				content: 'world',
				position: {start: 0, end: 5},
			}
			const match: OverlayMatch = {
				...stubMatch,
				source: '@wo',
				range: {start: 6, end: 9},
				option: {markup: '@[__value__]'},
			}
			controller.enable()
			store.overlay.match(match)

			store.overlay.select({mark, match})

			expect(replaceRange).toHaveBeenCalledWith({start: 6, end: 9}, '@[world]', {
				source: 'overlay',
				recover: {kind: 'caret', rawPosition: 14},
			})
			expect(store.overlay.match()).toBeUndefined()
			controller.disable()
		})
	})
})