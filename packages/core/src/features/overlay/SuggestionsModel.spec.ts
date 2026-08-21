import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'

function matchWith(value: string, data: string[]): OverlayMatch {
	return {
		value,
		source: `@${value}`,
		span: `@${value}`,
		// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
		node: {} as unknown as Node,
		range: {anchor: 'start', head: 'start'},
		option: {overlay: {trigger: '@', data}},
	}
}

describe('SuggestionsModel', () => {
	let store: Store
	let container: HTMLElement

	beforeEach(() => {
		store = new Store()
		container = document.createElement('div')
		store.host.container(container)
	})

	it('filters the match option data by the match value', () => {
		store.overlay.match(matchWith('wor', ['world', 'word', 'other']))

		expect(store.overlay.suggestions.filtered()).toEqual(['world', 'word'])
	})

	it('has no rows without a match', () => {
		expect(store.overlay.suggestions.filtered()).toEqual([])
	})

	it('resets the highlight when the match changes', () => {
		store.overlay.match(matchWith('', ['alpha', 'beta']))
		store.overlay.suggestions.active(1)

		store.overlay.match(matchWith('a', ['alpha', 'beta']))

		expect(store.overlay.suggestions.active()).toBeNaN()
	})

	it('chooses the filtered row with its index as meta', () => {
		const choose = vi.spyOn(store.overlay, 'choose')
		store.overlay.match(matchWith('wor', ['world', 'word', 'other']))

		store.overlay.suggestions.select(1)

		expect(choose).toHaveBeenCalledWith('word', '1')
	})

	it('chooses nothing for an out-of-range index', () => {
		const choose = vi.spyOn(store.overlay, 'choose')
		store.overlay.match(matchWith('wor', ['world']))

		store.overlay.suggestions.select(5)

		expect(choose).not.toHaveBeenCalled()
	})

	it('drives the highlight and the selection from container keydown while activated', () => {
		// choose is stubbed so the match survives Enter and the post-dispose press is observable
		const choose = vi.spyOn(store.overlay, 'choose').mockImplementation(() => {})
		store.overlay.match(matchWith('', ['alpha', 'beta']))
		const deactivate = store.overlay.suggestions.activate()
		const press = (key: string) => {
			const event = new KeyboardEvent('keydown', {key, cancelable: true})
			container.dispatchEvent(event)
			return event
		}

		expect(press('ArrowDown').defaultPrevented).toBe(true)
		expect(store.overlay.suggestions.active()).toBe(0)
		press('ArrowDown')
		expect(store.overlay.suggestions.active()).toBe(1)
		press('ArrowUp')
		expect(store.overlay.suggestions.active()).toBe(0)
		press('Enter')
		expect(choose).toHaveBeenCalledWith('alpha', '0')

		deactivate()
		press('ArrowDown')
		expect(store.overlay.suggestions.active()).toBe(0)
	})

	it('lets keydown pass through when there is nothing to navigate', () => {
		store.overlay.suggestions.activate()
		const event = new KeyboardEvent('keydown', {key: 'ArrowDown', cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.overlay.suggestions.active()).toBeNaN()
	})

	it('rebinds the keydown listener to a swapped container', () => {
		store.overlay.suggestions.activate()

		const next = document.createElement('div')
		// The swap re-adopts the tree and the probe clears any match, so the match is set after.
		store.host.container(next)
		store.overlay.match(matchWith('', ['alpha']))
		next.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', cancelable: true}))

		expect(store.overlay.suggestions.active()).toBe(0)
	})
})