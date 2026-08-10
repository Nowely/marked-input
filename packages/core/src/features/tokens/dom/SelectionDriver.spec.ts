import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {mountStructuralInline, mountStructuralInlineMark} from '../__testing__/mountFixtures'
import type {TextNode} from '../tree/types'

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
		// The gate for storing the NODE anchor instead of a numeric round-trip (spec S1 §4.6
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

	describe('DOM → model sync', () => {
		/** Collapse the window selection onto one DOM boundary, bypassing any placement path. */
		const caretAt = (node: Node, offset: number): void => {
			const sel = window.getSelection()
			if (!sel) throw new Error('no window selection')
			sel.removeAllRanges()
			const range = document.createRange()
			range.setStart(node, offset)
			range.collapse(true)
			sel.addRange(range)
		}

		/** The fixture's leading text root, narrowed — `{node, offset}` only accepts a TextNode. */
		const textRoot = (store: Store): TextNode => {
			const node = store.tokens.nodes()[0]
			if (node.kind !== 'text') throw new Error('expected a leading text root')
			return node
		}

		it('keeps a far-side anchor at a shared boundary across a selectionchange', () => {
			// THE property the old numeric round-trip broke. In 'ab@[x]cd' the mark starts at
			// 2, exactly where the text 'ab' ends, so `anchorAt(2)` — right-affine — answers
			// the TEXT node: the previous `sync` rewrote `{before: mark}` into
			// `{node: 'ab', offset: 2}` and the caret watch then dragged focus into the
			// neighbouring surface. `anchorFor` reads the mark ELEMENT the DOM actually names,
			// so the anchor comes back identical and the write dedupes.
			const {store, container, mark} = mountStructuralInlineMark('ab@[x]cd')
			const markNode = store.tokens.nodes()[1]
			store.selection.select({before: markNode})
			caretAt(mark, 0)

			document.dispatchEvent(new Event('selectionchange'))

			expect(store.selection.anchors()).toEqual({anchor: {before: markNode}, head: {before: markNode}})
			container.remove()
		})

		it('rewrites the stored anchor when the caret crosses a shared boundary at the same offset', () => {
			// THE gate on the deleted numeric-equality guard, and the behavior change of this
			// phase. `{node: 'ab', offset: 2}` and `{before: mark}` are both absolute offset 2,
			// so the guard's `current.start === raw.start && current.end === raw.end` short-
			// circuited before the write and the model kept believing the caret was in the
			// text. Re-introducing the guard turns exactly this case red.
			const {store, container, mark} = mountStructuralInlineMark('ab@[x]cd')
			const markNode = store.tokens.nodes()[1]
			store.selection.select({node: textRoot(store), offset: 2})
			caretAt(mark, 0)

			document.dispatchEvent(new Event('selectionchange'))

			expect(store.selection.anchors()).toEqual({anchor: {before: markNode}, head: {before: markNode}})
			container.remove()
		})

		it('focusin with no DOM selection clears the stored anchors', () => {
			// One of the two exits, and they are NOT interchangeable: no DOM selection is the
			// DOM saying "nothing is selected", which the model must follow. Swapping this
			// exit with the one below turns both cases red.
			const {store, container, before} = mountStructuralInlineMark('ab@[x]cd')
			store.selection.select({node: textRoot(store), offset: 1})
			expect(store.selection.anchors()).toBeDefined()

			window.getSelection()?.removeAllRanges()
			before.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

			expect(store.selection.anchors()).toBeUndefined()
			container.remove()
		})

		it('focusin with an unresolvable boundary leaves the stored anchors standing', () => {
			// The other exit (spec S2 D4): `anchorFor` answering `undefined` means "the DOM
			// cannot be read here", not "nothing is selected" — the previous anchors stay and
			// the next `selectionchange` corrects them. A boundary outside the container is the
			// reachable form of that.
			const {store, container, before} = mountStructuralInlineMark('ab@[x]cd')
			const textNode = textRoot(store)
			store.selection.select({node: textNode, offset: 1})

			const outside = document.createElement('div')
			outside.append(document.createTextNode('elsewhere'))
			document.body.append(outside)
			caretAt(outside.firstChild!, 3)
			before.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

			expect(store.selection.anchors()).toEqual({
				anchor: {node: textNode, offset: 1},
				head: {node: textNode, offset: 1},
			})
			outside.remove()
			container.remove()
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
			// The clamp and its write-back are GONE (spec S1 §4.6 item 5) and the assertion is
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