import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretModel', () => {
	it('exposes range and selecting', () => {
		const store = new Store()
		expect(typeof store.caret.range).toBe('function')
		expect(typeof store.caret.selecting).toBe('function')
	})

	it('range starts undefined', () => {
		expect(new Store().caret.range()).toBeUndefined()
	})

	it('range write is structural-equality deduped', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.range, notify)
		store.caret.range({start: 5, end: 5})
		store.caret.range({start: 5, end: 5})
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('range undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.range, notify)
		store.caret.range(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
	})

	describe('setAt', () => {
		it('writes collapsed range', () => {
			const store = new Store()
			store.caret.setAt(5)
			expect(store.caret.range()).toEqual({start: 5, end: 5})
		})
		it('does not change selecting', () => {
			const store = new Store()
			store.caret.selecting('drag')
			store.caret.setAt(5)
			expect(store.caret.selecting()).toBe('drag')
		})
	})

	describe('select', () => {
		it('writes extended range', () => {
			const store = new Store()
			store.caret.select({start: 2, end: 8})
			expect(store.caret.range()).toEqual({start: 2, end: 8})
		})
		it('collapsed select behaves same as setAt', () => {
			const store = new Store()
			store.caret.select({start: 5, end: 5})
			expect(store.caret.range()).toEqual({start: 5, end: 5})
		})
	})

	describe('collapse', () => {
		it('collapses to start', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			store.caret.collapse('start')
			expect(store.caret.range()).toEqual({start: 2, end: 2})
		})
		it('collapses to end', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			store.caret.collapse('end')
			expect(store.caret.range()).toEqual({start: 8, end: 8})
		})
		it('is no-op when range is undefined', () => {
			const store = new Store()
			store.caret.collapse('start')
			expect(store.caret.range()).toBeUndefined()
		})
	})

	describe('isCollapsed', () => {
		it('is false when range is undefined', () => {
			expect(new Store().caret.isCollapsed()).toBe(false)
		})
		it('is true when start equals end', () => {
			const store = new Store()
			store.caret.range({start: 3, end: 3})
			expect(store.caret.isCollapsed()).toBe(true)
		})
		it('is false when start differs from end', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			expect(store.caret.isCollapsed()).toBe(false)
		})
	})

	describe('position', () => {
		it('is undefined when range is undefined', () => {
			expect(new Store().caret.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			const store = new Store()
			store.caret.range({start: 5, end: 5})
			expect(store.caret.position()).toBe(5)
		})
		it('is undefined when extended', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			expect(store.caret.position()).toBeUndefined()
		})
	})

	describe('selection', () => {
		it('is undefined when range is undefined', () => {
			expect(new Store().caret.selection()).toBeUndefined()
		})
		it('is undefined when collapsed', () => {
			const store = new Store()
			store.caret.range({start: 5, end: 5})
			expect(store.caret.selection()).toBeUndefined()
		})
		it('returns range when extended', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			expect(store.caret.selection()).toEqual({start: 2, end: 8})
		})
	})

	describe('isFullSelection', () => {
		it('returns false when no container', () => {
			expect(new Store().caret.isFullSelection()).toBe(false)
		})
		it('returns false when selection is collapsed', () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.dom.container(container)
			expect(store.caret.isFullSelection()).toBe(false)
			container.remove()
		})
	})

	describe('selectAll', () => {
		it('sets selecting to all', () => {
			const store = new Store()
			const container = document.createElement('div')
			container.appendChild(document.createTextNode('hi'))
			document.body.appendChild(container)
			store.dom.container(container)

			const mockSel = {setBaseAndExtent: vi.fn(), rangeCount: 0}
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for spy
			vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

			store.caret.selectAll()
			expect(store.caret.selecting()).toBe('all')
			expect(mockSel.setBaseAndExtent).toHaveBeenCalledWith(container.firstChild, 0, container.lastChild, 1)
			container.remove()
			vi.restoreAllMocks()
		})
		it('is no-op when container is missing', () => {
			const store = new Store()
			expect(() => store.caret.selectAll()).not.toThrow()
			expect(store.caret.selecting()).toBeUndefined()
		})
	})

	describe('lifecycle wiring', () => {
		it('attaches document listeners on mount', () => {
			const addSpy = vi.spyOn(document, 'addEventListener')
			const store = new Store()
			store.lifecycle.mounted()
			expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), undefined)
			addSpy.mockRestore()
		})

		it('clears drag-selecting on unmount', () => {
			const store = new Store()
			store.lifecycle.mounted()
			store.caret.selecting('drag')
			store.lifecycle.unmounted()
			expect(store.caret.selecting()).toBeUndefined()
		})
	})

	describe('restoration via dom.indexed', () => {
		it('restores range after indexed fires', () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)

			const placeAtSpy = vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: true, value: {applied: 5}})
			store.props.set({defaultValue: 'hello'})
			store.dom.container(container)
			store.lifecycle.mounted()
			store.caret.setAt(5)

			store.lifecycle.rendered()
			expect(placeAtSpy).toHaveBeenCalledWith(5)
			container.remove()
			placeAtSpy.mockRestore()
		})

		it('skips restoration when mode is drag', () => {
			const store = new Store()
			const placeAtSpy = vi.spyOn(store.dom, 'placeAt')
			store.lifecycle.mounted()
			store.caret.setAt(3)
			store.caret.selecting('drag')
			store.lifecycle.rendered()
			expect(placeAtSpy).not.toHaveBeenCalled()
			placeAtSpy.mockRestore()
		})

		it('clears range when placeAt fails', () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: false, reason: 'notIndexed'})
			store.dom.container(container)
			store.lifecycle.mounted()
			store.caret.setAt(3)
			store.lifecycle.rendered()
			expect(store.caret.range()).toBeUndefined()
			container.remove()
			vi.restoreAllMocks()
		})
	})

	describe('single reconcile driver', () => {
		it('calls dom.reconcile when selecting changes', () => {
			const store = new Store()
			const reconcileSpy = vi.spyOn(store.dom, 'reconcile')
			store.lifecycle.mounted()
			reconcileSpy.mockClear()
			store.caret.selecting('drag')
			expect(reconcileSpy).toHaveBeenCalledWith({selecting: true})
			reconcileSpy.mockRestore()
		})
	})
})