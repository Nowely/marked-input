import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'

function enableStructuralStore(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	return store
}

/** The DOM half of a single-text-surface mount, shared by the uncontrolled and controlled fixtures. */
function mountInline(store: Store) {
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	container.append(textSurface)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural text surface did not render a text node')
	return {store, container, textSurface, textNode}
}

function mountStructuralInline(value: string) {
	return mountInline(enableStructuralStore(value))
}

function mountStructuralInlineMark(value = 'hello @[world]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const before = document.createElement('span')
	const mark = document.createElement('mark')
	const after = document.createElement('span')
	container.append(before, mark, after)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, before, mark, after}
}

describe('SelectionDriver', () => {
	it('repeated placement at the same handle notifies once', () => {
		// The stored form is anchors, so the dedupe under test is anchor IDENTITY. It is
		// NOT what gates `anchorEquals` — `range` keeps `{equals: shallow}` whatever
		// `#anchors` does, so dropping the anchor equality still collapses this case. The
		// gate for that is the next case.
		const {store, container} = mountStructuralInline('hello')
		const handle = store.tokens.handleOf(store.tokens.current()[0])
		if (!handle) throw new Error('Structural text token did not bind a handle')
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.placeAtHandle(handle, 'start')
		store.selection.placeAtHandle(handle, 'start')
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
		container.remove()
	})

	it('repeated selectAll applies to the DOM once', () => {
		// THE gate for `#anchors`'s custom `equals`, which the case above cannot give: two
		// `selectAll()` calls rebuild FRESH anchor objects for the same two positions, so
		// only value equality collapses the second apply. RANGED deliberately — `selectRange`
		// is the ranged apply path, and the collapsed one is masked by `placeAtHandle`'s
		// re-apply branch.
		const {store, container} = mountStructuralInline('hello')
		const spy = vi.spyOn(store.tokens, 'selectRange')
		store.selection.selectAll()
		store.selection.selectAll()
		expect(spy).toHaveBeenCalledTimes(1)
		spy.mockRestore()
		container.remove()
	})

	it('places at a mark whose start equals the previous text node end, through the mark itself', () => {
		// The gate for storing the NODE anchor instead of a numeric round-trip (spec §4.6
		// item 5): in 'ab@[x]cd' the mark starts at 2, exactly where 'ab' ends, so a
		// re-resolved `anchorAt(2)` — right-affine — answers the TEXT node and the caret
		// lands in the PREVIOUS surface. `{before: mark}` cannot be confused that way.
		const {store, container, mark} = mountStructuralInlineMark('ab@[x]cd')
		const markHandle = store.tokens.handleOf(store.tokens.current()[1])
		if (!markHandle) throw new Error('Mark token did not bind a handle')

		expect(store.selection.placeAtHandle(markHandle, 'start')).toBe(true)

		expect(document.activeElement).toBe(mark)
		container.remove()
	})

	it('repeated position write notifies once', () => {
		// The writable computed short-circuits an equal write before the setter runs.
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.position(5)
		store.selection.position(5)
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('position undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.position(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
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
			// No container set → no DOM index has been committed → placement is deferred
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

	describe('restoration via tokens.changed', () => {
		it('restores range after the model announces consistency', () => {
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
			store.selection.isUserSelecting(true)
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

		it('resolves an out-of-range caret intent to the document end', () => {
			// The clamp and its write-back are GONE (spec §4.6 item 5) and the assertion is
			// unchanged: `anchorAt(999)` finds no node containing the offset, so it answers
			// `'end'`, which resolves to the last root's end.
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.selection.position(999)
			store.host.rendered()

			expect(store.selection.range()).toEqual({start: 5, end: 5})
			container.remove()
		})

		it('resolves an out-of-range selection to the document end', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.selection.select(store.tokens.anchorAt(999), store.tokens.anchorAt(1000))
			store.host.rendered()

			// Both anchors are `'end'`, so the selection is collapsed rather than clamped.
			expect(store.selection.range()).toEqual({start: 5, end: 5})
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

			store.selection.isUserSelecting(true)
			expect(span.contentEditable).toBe('false')

			store.selection.isUserSelecting(false)
			expect(span.contentEditable).toBe('true')

			container.remove()
		})
	})

	describe('empty-editor click handler', () => {
		it('focuses first child on click when editor is empty', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.contentEditable = 'true'
			container.appendChild(span)
			document.body.appendChild(container)

			store.props.set({defaultValue: ''})
			store.host.container(container)
			store.host.rendered()

			const focusSpy = vi.spyOn(span, 'focus')
			container.dispatchEvent(new MouseEvent('click', {bubbles: true}))
			expect(focusSpy).toHaveBeenCalledTimes(1)
			container.remove()
		})
	})
})