import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretModel', () => {
	it('exposes range and isSelecting', () => {
		const store = new Store()
		expect(typeof store.caret.range).toBe('function')
		expect(typeof store.caret.isSelecting).toBe('function')
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

	describe('position', () => {
		it('is undefined when range is undefined', () => {
			expect(new Store().caret.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			const store = new Store()
			store.caret.range({start: 5, end: 5})
			expect(store.caret.position()).toBe(5)
		})
		it('write collapses range to {pos, pos}', () => {
			const store = new Store()
			store.caret.position(5)
			expect(store.caret.range()).toEqual({start: 5, end: 5})
		})
		it('write does not change isSelecting', () => {
			const store = new Store()
			store.caret.isSelecting(true)
			store.caret.position(5)
			expect(store.caret.isSelecting()).toBe(true)
		})
		it('write collapses an extended range', () => {
			const store = new Store()
			store.caret.range({start: 2, end: 8})
			store.caret.position(3)
			expect(store.caret.range()).toEqual({start: 3, end: 3})
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
		it('extends DOM selection across container', () => {
			const store = new Store()
			const container = document.createElement('div')
			container.appendChild(document.createTextNode('hi'))
			document.body.appendChild(container)
			store.dom.container(container)

			const mockSel = {setBaseAndExtent: vi.fn(), rangeCount: 0}
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for spy
			vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

			store.caret.selectAll()
			expect(mockSel.setBaseAndExtent).toHaveBeenCalledWith(container.firstChild, 0, container.lastChild, 1)
			container.remove()
			vi.restoreAllMocks()
		})
		it('is no-op when container is missing', () => {
			const store = new Store()
			expect(() => store.caret.selectAll()).not.toThrow()
			expect(store.caret.isSelecting()).toBe(false)
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
			store.caret.position(5)

			store.lifecycle.rendered()
			expect(placeAtSpy).toHaveBeenCalledWith(5)
			container.remove()
			placeAtSpy.mockRestore()
		})

		it('skips restoration when isSelecting', () => {
			const store = new Store()
			const placeAtSpy = vi.spyOn(store.dom, 'placeAt')
			store.lifecycle.mounted()
			store.caret.position(3)
			store.caret.isSelecting(true)
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
			store.caret.position(3)
			store.lifecycle.rendered()
			expect(store.caret.range()).toBeUndefined()
			container.remove()
			vi.restoreAllMocks()
		})
	})

	describe('single reconcile driver', () => {
		it('calls dom.reconcile when isSelecting changes', () => {
			const store = new Store()
			const reconcileSpy = vi.spyOn(store.dom, 'reconcile')
			store.lifecycle.mounted()
			reconcileSpy.mockClear()
			store.caret.isSelecting(true)
			expect(reconcileSpy).toHaveBeenCalledWith({isSelecting: true})
			reconcileSpy.mockRestore()
		})
	})
})