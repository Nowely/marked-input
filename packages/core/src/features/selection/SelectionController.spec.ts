import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('SelectionController', () => {
	it('exposes range', () => {
		const store = new Store()
		expect(typeof store.selection.range).toBe('function')
	})

	it('range starts undefined', () => {
		expect(new Store().selection.range()).toBeUndefined()
	})

	it('range write is structural-equality deduped', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.range({start: 5, end: 5})
		store.selection.range({start: 5, end: 5})
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('range undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.range(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
	})

	describe('position', () => {
		it('is undefined when range is undefined', () => {
			expect(new Store().selection.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			const store = new Store()
			store.selection.range({start: 5, end: 5})
			expect(store.selection.position()).toBe(5)
		})
		it('write collapses range to {pos, pos}', () => {
			const store = new Store()
			store.selection.position(5)
			expect(store.selection.range()).toEqual({start: 5, end: 5})
		})
		it('write does not change isUserSelecting', () => {
			const store = new Store()
			store.dom.isUserSelecting(true)
			store.selection.position(5)
			expect(store.dom.isUserSelecting()).toBe(true)
		})
		it('write collapses an extended range', () => {
			const store = new Store()
			store.selection.range({start: 2, end: 8})
			store.selection.position(3)
			expect(store.selection.range()).toEqual({start: 3, end: 3})
		})
	})

	describe('isAllSelected', () => {
		it('returns false when value is empty', () => {
			expect(new Store().selection.isAllSelected()).toBe(false)
		})
		it('returns false when range is collapsed', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 2, end: 2})
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns false for a partial range', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 1, end: 3})
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns true when range spans the entire value', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 0, end: 5})
			expect(store.selection.isAllSelected()).toBe(true)
		})
	})

	describe('selectAll', () => {
		it('sets range to full value range and applies it to DOM', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.host.rendered()

			store.selection.selectAll()
			expect(store.selection.range()).toEqual({start: 0, end: 5})
			const sel = window.getSelection()
			expect(sel?.anchorNode).toBe(span.firstChild)
			expect(sel?.anchorOffset).toBe(0)
			expect(sel?.focusNode).toBe(span.firstChild)
			expect(sel?.focusOffset).toBe(5)
			container.remove()
		})
		it('retains range intent when the DOM has no target yet', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			// No container set → dom.isIndexed() is false → placement is deferred
			// until the next render. The range signal still reflects user intent.
			store.selection.selectAll()
			expect(store.selection.range()).toEqual({start: 0, end: 5})
		})
	})

	describe('lifecycle wiring', () => {
		it('attaches document listeners on mount', () => {
			const addSpy = vi.spyOn(document, 'addEventListener')
			const store = new Store()
			store.host.container(document.createElement('div'))
			expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), undefined)
			addSpy.mockRestore()
		})
	})

	describe('restoration via dom.indexed', () => {
		it('restores range after indexed fires', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)

			store.props.set({defaultValue: 'hello'})
			store.host.container(container)
			store.selection.position(5)

			store.host.rendered()
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
			store.host.container(container)
			store.dom.isUserSelecting(true)
			store.selection.position(3)

			// Clear any pre-existing browser selection so we can detect non-changes.
			window.getSelection()?.removeAllRanges()
			store.host.rendered()

			const sel = window.getSelection()
			expect(sel?.rangeCount ?? 0).toBe(0)
			container.remove()
		})

		it('retains range intent when no DOM target exists for the position', () => {
			// Empty container: no token elements registered → placer can't find a
			// target → placement is deferred (range intent retained until the
			// DOM catches up).
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hello'})
			store.host.container(container)
			store.selection.position(3)
			store.host.rendered()
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})
	})

	describe('isUserSelecting → contentEditable', () => {
		it('flips structural text surfaces non-editable while user is selecting', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.host.rendered()

			expect(span.contentEditable).toBe('true')

			store.dom.isUserSelecting(true)
			expect(span.contentEditable).toBe('false')

			store.dom.isUserSelecting(false)
			expect(span.contentEditable).toBe('true')

			container.remove()
		})
	})
})