import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretModel', () => {
	it('exposes selection and isUserSelecting', () => {
		const store = new Store()
		expect(typeof store.caret.selection).toBe('function')
		expect(typeof store.caret.isUserSelecting).toBe('function')
	})

	it('selection starts undefined', () => {
		expect(new Store().caret.selection()).toBeUndefined()
	})

	it('selection write is structural-equality deduped', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.selection, notify)
		store.caret.selection({start: 5, end: 5})
		store.caret.selection({start: 5, end: 5})
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('selection undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.selection, notify)
		store.caret.selection(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
	})

	describe('position', () => {
		it('is undefined when selection is undefined', () => {
			expect(new Store().caret.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			const store = new Store()
			store.caret.selection({start: 5, end: 5})
			expect(store.caret.position()).toBe(5)
		})
		it('write collapses selection to {pos, pos}', () => {
			const store = new Store()
			store.caret.position(5)
			expect(store.caret.selection()).toEqual({start: 5, end: 5})
		})
		it('write does not change isUserSelecting', () => {
			const store = new Store()
			store.caret.isUserSelecting(true)
			store.caret.position(5)
			expect(store.caret.isUserSelecting()).toBe(true)
		})
		it('write collapses an extended selection', () => {
			const store = new Store()
			store.caret.selection({start: 2, end: 8})
			store.caret.position(3)
			expect(store.caret.selection()).toEqual({start: 3, end: 3})
		})
	})

	describe('isAllSelected', () => {
		it('returns false when value is empty', () => {
			expect(new Store().caret.isAllSelected()).toBe(false)
		})
		it('returns false when selection is collapsed', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.caret.selection({start: 2, end: 2})
			expect(store.caret.isAllSelected()).toBe(false)
		})
		it('returns false for a partial selection', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.caret.selection({start: 1, end: 3})
			expect(store.caret.isAllSelected()).toBe(false)
		})
		it('returns true when selection spans the entire value', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.caret.selection({start: 0, end: 5})
			expect(store.caret.isAllSelected()).toBe(true)
		})
	})

	describe('selectAll', () => {
		it('sets selection to full value range and applies it to DOM', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.lifecycle.mounted()
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.dom.container(container)
			store.lifecycle.rendered()

			store.caret.selectAll()
			expect(store.caret.selection()).toEqual({start: 0, end: 5})
			const sel = window.getSelection()
			expect(sel?.anchorNode).toBe(span.firstChild)
			expect(sel?.anchorOffset).toBe(0)
			expect(sel?.focusNode).toBe(span.firstChild)
			expect(sel?.focusOffset).toBe(5)
			container.remove()
		})
		it('retains selection intent when the DOM has no target yet', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.lifecycle.mounted()

			// No container set → dom.index() is undefined → placement is deferred
			// until the next render. The selection signal still reflects user intent.
			store.caret.selectAll()
			expect(store.caret.selection()).toEqual({start: 0, end: 5})
		})
	})

	describe('mouse-driven selection tracking', () => {
		function mountWithContainer() {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.dom.container(container)
			store.lifecycle.mounted()
			return {store, container}
		}

		it('flips isUserSelecting when mouse drags across nodes inside the editor', () => {
			const {store, container} = mountWithContainer()
			const a = document.createElement('span')
			const b = document.createElement('span')
			a.textContent = 'a'
			b.textContent = 'b'
			container.append(a, b)

			const mockSel = {containsNode: () => true, isCollapsed: false, focusNode: null, rangeCount: 0}
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
			vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

			a.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
			b.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
			expect(store.caret.isUserSelecting()).toBe(true)

			container.remove()
			vi.restoreAllMocks()
		})

		it('does not flip isUserSelecting when drag stays on the same element', () => {
			const {store, container} = mountWithContainer()
			const a = document.createElement('span')
			a.textContent = 'a'
			container.append(a)

			const mockSel = {containsNode: () => true, isCollapsed: true, focusNode: null, rangeCount: 0}
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
			vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

			a.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
			a.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
			expect(store.caret.isUserSelecting()).toBe(false)

			container.remove()
			vi.restoreAllMocks()
		})

		it('clears isUserSelecting on mouseup when the resulting selection is collapsed', () => {
			const {store, container} = mountWithContainer()
			store.caret.isUserSelecting(true)

			const mockSel = {isCollapsed: true, focusNode: null, rangeCount: 0}
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
			vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

			document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}))
			expect(store.caret.isUserSelecting()).toBe(false)

			container.remove()
			vi.restoreAllMocks()
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
		it('restores selection after indexed fires', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)

			store.props.set({defaultValue: 'hello'})
			store.dom.container(container)
			store.lifecycle.mounted()
			store.caret.position(5)

			store.lifecycle.rendered()
			const sel = window.getSelection()
			expect(sel?.focusNode).toBe(span.firstChild)
			expect(sel?.focusOffset).toBe(5)
			container.remove()
		})

		it('skips restoration when isUserSelecting', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.dom.container(container)
			store.lifecycle.mounted()
			store.caret.isUserSelecting(true)
			store.caret.position(3)

			// Clear any pre-existing browser selection so we can detect non-changes.
			window.getSelection()?.removeAllRanges()
			store.lifecycle.rendered()

			const sel = window.getSelection()
			expect(sel?.rangeCount ?? 0).toBe(0)
			container.remove()
		})

		it('retains selection intent when no DOM target exists for the position', () => {
			// Empty container: no token elements registered → placer can't find a
			// target → placement is deferred (selection intent retained until the
			// DOM catches up).
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hello'})
			store.dom.container(container)
			store.lifecycle.mounted()
			store.caret.position(3)
			store.lifecycle.rendered()
			expect(store.caret.selection()).toEqual({start: 3, end: 3})
			container.remove()
		})
	})

	describe('single reconcile driver', () => {
		it('calls dom.reconcile when isUserSelecting changes', () => {
			const store = new Store()
			const reconcileSpy = vi.spyOn(store.dom, 'reconcile')
			store.lifecycle.mounted()
			reconcileSpy.mockClear()
			store.caret.isUserSelecting(true)
			expect(reconcileSpy).toHaveBeenCalledWith({isUserSelecting: true})
			reconcileSpy.mockRestore()
		})
	})
})