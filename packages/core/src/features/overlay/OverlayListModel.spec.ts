import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {CoreOption, OverlayMatch, Suggestion} from '../../shared/types'
import {Store} from '../../store/Store'

function matchWith(value: string, data: readonly Suggestion[]): OverlayMatch {
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

/** The other arm: a trigger option declaring NO data, which is what puts the row menu on offer. */
const MENU_TRIGGER: CoreOption = {overlay: {trigger: '/'}}

function menuMatch(value: string): OverlayMatch {
	return {...matchWith(value, []), option: MENU_TRIGGER}
}

describe('OverlayListModel', () => {
	let store: Store
	let container: HTMLElement

	beforeEach(() => {
		store = new Store()
		container = document.createElement('div')
		store.host.container(container)
	})

	it('filters the match option data by the match value', () => {
		store.overlay.match(matchWith('wor', ['world', 'word', 'other']))

		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['world', 'word'])
	})

	it('has no rows without a match', () => {
		expect(store.overlay.list.rows()).toEqual([])
	})

	it('resets the highlight when the match changes', () => {
		store.overlay.match(matchWith('', ['alpha', 'beta']))
		store.overlay.list.active(1)

		store.overlay.match(matchWith('a', ['alpha', 'beta']))

		expect(store.overlay.list.active()).toBeNaN()
	})

	it('chooses the filtered row with its index as meta', () => {
		const choose = vi.spyOn(store.overlay, 'choose')
		store.overlay.match(matchWith('wor', ['world', 'word', 'other']))

		store.overlay.list.select(1)

		expect(choose).toHaveBeenCalledWith({value: 'word', meta: '1'})
	})

	it('writes the identity a row carries, where a bare string can only write its index', () => {
		const choose = vi.spyOn(store.overlay, 'choose')
		store.overlay.match(matchWith('kane', [{value: 'Marcus Kane', meta: 'marcus.kane'}]))

		store.overlay.list.select(0)

		expect(choose).toHaveBeenCalledWith({value: 'Marcus Kane', meta: 'marcus.kane'})
	})

	it('chooses nothing for an out-of-range index', () => {
		const choose = vi.spyOn(store.overlay, 'choose')
		store.overlay.match(matchWith('wor', ['world']))

		store.overlay.list.select(5)

		expect(choose).not.toHaveBeenCalled()
	})

	it('drives the highlight and the selection from container keydown while activated', () => {
		// choose is stubbed so the match survives Enter and the post-dispose press is observable
		const choose = vi.spyOn(store.overlay, 'choose').mockImplementation(() => true)
		store.overlay.match(matchWith('', ['alpha', 'beta']))
		const deactivate = store.overlay.list.activate()
		const press = (key: string) => {
			const event = new KeyboardEvent('keydown', {key, cancelable: true})
			container.dispatchEvent(event)
			return event
		}

		expect(press('ArrowDown').defaultPrevented).toBe(true)
		expect(store.overlay.list.active()).toBe(0)
		press('ArrowDown')
		expect(store.overlay.list.active()).toBe(1)
		press('ArrowUp')
		expect(store.overlay.list.active()).toBe(0)
		press('Enter')
		expect(choose).toHaveBeenCalledWith({value: 'alpha', meta: '0'})

		deactivate()
		press('ArrowDown')
		expect(store.overlay.list.active()).toBe(0)
	})

	it('lets keydown pass through when there is nothing to navigate', () => {
		store.overlay.list.activate()
		const event = new KeyboardEvent('keydown', {key: 'ArrowDown', cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.overlay.list.active()).toBeNaN()
	})

	it('rebinds the keydown listener to a swapped container', () => {
		store.overlay.list.activate()

		const next = document.createElement('div')
		// The swap re-adopts the tree and the probe clears any match, so the match is set after.
		store.host.container(next)
		store.overlay.match(matchWith('', ['alpha']))
		next.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', cancelable: true}))

		expect(store.overlay.list.active()).toBe(0)
	})

	/**
	 * THE OTHER ARM, and the whole of ticket "the slash menu has no keyboard at all": the row menu
	 * used to be `OverlayController.entries` — a second list with no `active`, no `select(index)`
	 * and no `activate()`, so ArrowDown highlighted nothing and Enter fell through to the row
	 * split. Every case below is one the data arm above already passed.
	 */
	describe('the row menu arm', () => {
		const MENU_OPTIONS: CoreOption[] = [
			MENU_TRIGGER,
			{markup: '# __slot__', menu: {label: 'Heading 1', keywords: ['h1']}},
			{markup: '- __slot__', menu: {label: 'Bulleted list'}},
			// No `menu`, so it is not on offer at all — presence is the whole registry.
			{markup: '@[__value__]'},
		]

		beforeEach(() => {
			store.props.set({options: MENU_OPTIONS})
		})

		it('offers one row per option declaring a menu when the match option has no data', () => {
			store.overlay.match(menuMatch(''))

			expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Heading 1', 'Bulleted list'])
		})

		it('narrows by a keyword that appears in no label', () => {
			store.overlay.match(menuMatch('h1'))

			expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Heading 1'])
		})

		it('chooses the option arm, which is what retypes the row', () => {
			const choose = vi.spyOn(store.overlay, 'choose').mockImplementation(() => true)
			store.overlay.match(menuMatch(''))

			store.overlay.list.select(1)

			expect(choose).toHaveBeenCalledWith({option: MENU_OPTIONS[2]})
		})

		it('drives the highlight and the choice from container keydown', () => {
			const choose = vi.spyOn(store.overlay, 'choose').mockImplementation(() => true)
			store.overlay.match(menuMatch(''))
			store.overlay.list.activate()
			const press = (key: string) => {
				const event = new KeyboardEvent('keydown', {key, cancelable: true})
				container.dispatchEvent(event)
				return event
			}

			expect(press('ArrowDown').defaultPrevented).toBe(true)
			expect(store.overlay.list.active()).toBe(0)
			press('ArrowDown')
			expect(store.overlay.list.active()).toBe(1)
			expect(press('Enter').defaultPrevented).toBe(true)
			expect(choose).toHaveBeenCalledWith({option: MENU_OPTIONS[2]})
		})

		/**
		 * The key the row keymap asks about before it splits a row. With the menu open and a row
		 * highlighted, Enter belongs to the list — which is exactly what `/h2` + Enter did not do.
		 */
		it('claims Enter from the row keymap only once a row is highlighted', () => {
			store.overlay.match(menuMatch(''))

			expect(store.overlay.list.consumes('Enter')).toBe(false)

			store.overlay.list.active(0)

			expect(store.overlay.list.consumes('Enter')).toBe(true)
		})

		it('leaves an option that declares an empty data list offering nothing', () => {
			store.overlay.match(matchWith('', []))

			expect(store.overlay.list.rows()).toEqual([])
		})
	})
})