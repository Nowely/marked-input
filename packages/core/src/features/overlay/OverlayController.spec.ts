import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'

const stubMatch: OverlayMatch = {
	value: 'test',
	source: '@',
	span: 'test',
	// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
	node: {} as unknown as Node,
	range: {start: 0, end: 1},
	option: {},
}

describe('OverlayController', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		store.host.container(document.createElement('div'))
	})

	describe('ownership', () => {
		it('owns match, element (DOM ref), slot (computed), choose, close', () => {
			expect(typeof store.overlay.match).toBe('function')
			expect(typeof store.overlay.element).toBe('function')
			expect(typeof store.overlay.slot).toBe('function')
			expect(typeof store.overlay.choose).toBe('function')
			expect(typeof store.overlay.close).toBe('function')
		})
	})

	describe('activation via overlay trigger', () => {
		it('probes overlay trigger on change when showOverlayOn includes change', () => {
			// Reset to empty first so watch sees a false->true transition
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.value.current(store.value.current() + ' ')

			expect(store.overlay.match()).toBeUndefined()

			store.props.set({options: []})
		})

		it('clear match when close is emitted', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})

		it('react to change event when showOverlayOn includes change', () => {
			store.props.set({options: [], showOverlayOn: 'change'})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.value.current(store.value.current() + ' ')

			expect(store.overlay.match()).toBeUndefined()
		})

		it('not react to change event when showOverlayOn does not include change', () => {
			store.props.set({options: [], showOverlayOn: 'selectionChange'})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.value.current(store.value.current() + ' ')

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('be idempotent — setting options twice does not double-subscribe', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			// second set is a no-op (already has overlay trigger)
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('deactivation', () => {
		it('stop reacting to events after removing overlay trigger', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			store.props.set({options: []})

			store.overlay.match(stubMatch)

			store.overlay.close()
			store.value.current(store.value.current() + ' ')

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('allow re-enabling after removing overlay trigger', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('choose()', () => {
		it('delegates trigger replacement to the edit coordinator', () => {
			const replaceRange = vi.spyOn(store.edit, 'replace')
			const match: OverlayMatch = {
				...stubMatch,
				source: '@wo',
				range: {start: 6, end: 9},
				option: {markup: '@[__value__]'},
			}
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			store.overlay.match(match)

			store.overlay.choose('world')

			expect(replaceRange).toHaveBeenCalledWith({start: 6, end: 9}, '@[world]')
			expect(store.overlay.match()).toBeUndefined()
			store.props.set({options: []})
		})
	})
})