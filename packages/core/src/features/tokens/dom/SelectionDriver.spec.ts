import {afterEach, describe, it, expect, vi} from 'vitest'
import {userEvent} from 'vitest/browser'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {
	caretAt,
	mountNested,
	mountStructuralInline,
	mountStructuralInlineMark,
	mountValue,
	selectionRange,
} from '../__testing__/mountFixtures'
import type {TextNode} from '../tree/types'

describe('SelectionDriver', () => {
	it('repeated placement at the same handle notifies once', () => {
		// The stored form is anchors, so the dedupe under test is anchor IDENTITY. It watches
		// those anchors DIRECTLY since S2.6 — until then it watched the derived numeric
		// `range`, whose own `{equals: shallow}` collapsed the second notification whatever
		// `anchorEquals` did, which is why the case below had to exist to gate it.
		const {store, container} = mountStructuralInline('hello')
		const handle = store.tokens.handle(store.tokens.nodes()[0].id)
		if (!handle) throw new Error('Structural text token did not bind a handle')
		const notify = vi.fn()
		const stop = watch(() => store.tokens.selection.anchors(), notify)
		store.tokens.placeAtHandle(handle, 'start')
		store.tokens.placeAtHandle(handle, 'start')
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
		container.remove()
	})

	it('repeated selectAll applies to the DOM once', () => {
		// The DOM-side gate for the stored signal's custom `equals`: two `selectAll()` calls
		// rebuild FRESH anchor objects for the same two positions, so only value equality
		// collapses the second apply. RANGED deliberately — `selectRange` is the ranged apply
		// path, and the collapsed one is masked by `placeAtHandle`'s re-apply branch.
		const {store, container} = mountStructuralInline('hello')
		const spy = vi.spyOn(store.tokens, 'selectRange')
		store.tokens.selection.selectAll()
		store.tokens.selection.selectAll()
		expect(spy).toHaveBeenCalledTimes(1)
		spy.mockRestore()
		container.remove()
	})

	it('places at a mark whose start equals the previous text node end, through the mark itself', () => {
		// The gate for storing the NODE anchor instead of a numeric round-trip (spec S1 §4.6
		// item 5): in 'ab@[x]cd' the mark starts at 2, exactly where 'ab' ends, so a
		// re-resolved `anchorAt(2)` — right-affine — answers the TEXT node and the caret
		// lands in the PREVIOUS surface. `{before: mark}` cannot be confused that way.
		const {store, container} = mountStructuralInlineMark('ab@[x]cd')
		const markNode = store.tokens.nodes()[1]
		const markHandle = store.tokens.handle(markNode.id)
		if (!markHandle) throw new Error('Mark token did not bind a handle')

		expect(store.tokens.placeAtHandle(markHandle, 'start')).toBe(true)

		// WHERE THE CARET LANDED, not what took focus: mark roots are not tab stops under the
		// one-host topology, so `document.activeElement` — the old witness — names the editing
		// host rather than the token. The caret sits on the mark's own element, so the boundary
		// resolves through the MARK: the numeric round-trip this case exists to reject would
		// answer `{node: <text 'ab'>, offset: 2}` instead.
		expect(store.tokens.domAnchors()?.anchor).toEqual({before: markNode})
		container.remove()
	})

	it('repeated collapsed write at the same offset notifies once', () => {
		// `anchorAt` rebuilds a fresh `{node, offset}` object each time, so only the stored
		// signal's value equality collapses the second write.
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const notify = vi.fn()
		const stop = watch(() => store.tokens.selection.anchors(), notify)
		caretAt(store, 5)
		caretAt(store, 5)
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	describe('DOM → model sync', () => {
		/** Collapse the window selection onto one DOM boundary, bypassing any placement path. */
		const putCaret = (node: Node, offset: number): void => {
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
			store.tokens.selection.select({before: markNode})
			putCaret(mark, 0)

			document.dispatchEvent(new Event('selectionchange'))

			expect(store.tokens.selection.anchors()).toEqual({anchor: {before: markNode}, head: {before: markNode}})
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
			store.tokens.selection.select({node: textRoot(store), offset: 2})
			putCaret(mark, 0)

			document.dispatchEvent(new Event('selectionchange'))

			expect(store.tokens.selection.anchors()).toEqual({anchor: {before: markNode}, head: {before: markNode}})
			container.remove()
		})

		it('focusin with no DOM selection clears the stored anchors', () => {
			// One of the two exits, and they are NOT interchangeable: no DOM selection is the
			// DOM saying "nothing is selected", which the model must follow. Swapping this
			// exit with the one below turns both cases red.
			const {store, container, before} = mountStructuralInlineMark('ab@[x]cd')
			store.tokens.selection.select({node: textRoot(store), offset: 1})
			expect(store.tokens.selection.anchors()).toBeDefined()

			window.getSelection()?.removeAllRanges()
			before.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

			expect(store.tokens.selection.anchors()).toBeUndefined()
			container.remove()
		})

		it('focusin with an unresolvable boundary leaves the stored anchors standing', () => {
			// The other exit (spec S2 D4): `anchorFor` answering `undefined` means "the DOM
			// cannot be read here", not "nothing is selected" — the previous anchors stay and
			// the next `selectionchange` corrects them. A boundary outside the container is the
			// reachable form of that.
			const {store, container, before} = mountStructuralInlineMark('ab@[x]cd')
			const textNode = textRoot(store)
			store.tokens.selection.select({node: textNode, offset: 1})

			const outside = document.createElement('div')
			outside.append(document.createTextNode('elsewhere'))
			document.body.append(outside)
			putCaret(outside.firstChild!, 3)
			before.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

			expect(store.tokens.selection.anchors()).toEqual({
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

			store.tokens.selection.selectAll()
			expect(selectionRange(store)).toEqual({start: 0, end: 5})
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
			store.tokens.selection.selectAll()
			expect(selectionRange(store)).toEqual({start: 0, end: 5})
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
			caretAt(store, 5)

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
			store.tokens.isUserSelecting(true)
			caretAt(store, 3)

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
			caretAt(store, 3)
			store.host.rendered()
			expect(selectionRange(store)).toEqual({start: 3, end: 3})
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
			caretAt(store, 999)
			store.host.rendered()

			expect(selectionRange(store)).toEqual({start: 5, end: 5})
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
			store.tokens.selection.select(store.tokens.anchorAt(999), store.tokens.anchorAt(1000))
			store.host.rendered()

			// Both anchors are `'end'`, so the selection is collapsed rather than clamped.
			expect(selectionRange(store)).toEqual({start: 5, end: 5})
			container.remove()
		})
	})

	describe('isUserSelecting → contentEditable', () => {
		// Mechanism deleted in the host flip; spec dies with it.
		it.todo('flips structural text surfaces non-editable while user is selecting', () => {
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

			store.tokens.isUserSelecting(true)
			expect(span.contentEditable).toBe('false')

			store.tokens.isUserSelecting(false)
			expect(span.contentEditable).toBe('true')

			container.remove()
		})
	})

	describe('the container as the one editing host', () => {
		// These cases leave a FOCUSED editable container behind, so a failing assert must not
		// carry one into the rest of the file.
		afterEach(() => document.body.replaceChildren())

		/**
		 * A caret a real keystroke can land on. The CLICK is what resolves focus, and it is
		 * deliberately the browser's job rather than a `container.focus()`: which element ends
		 * up the editing host is exactly what the topology decides. The offset is then placed
		 * through the model's own path, because a click alone lands wherever it lands.
		 *
		 * INTERIOR offsets only: the click's own `selectionchange` arrives asynchronously and
		 * re-resolves whatever boundary it finds, and at a boundary offset that answer can be
		 * the neighbouring node's.
		 */
		const caretInEditor = async (store: Store, target: HTMLElement, offset: number): Promise<void> => {
			await userEvent.click(target)
			caretAt(store, offset)
		}

		it('mounting makes the container the editing host; readOnly toggles it', () => {
			const {store, container} = mountStructuralInline('hello')

			expect(container.getAttribute('contenteditable')).toBe('true')

			store.props.set({readOnly: true})
			expect(container.getAttribute('contenteditable')).toBe('false')

			store.props.set({readOnly: false})
			expect(container.getAttribute('contenteditable')).toBe('true')
			container.remove()
		})

		// REAL keystrokes (`userEvent` drives the browser itself), because the whole point of
		// the flip is what Chromium does with the DOM it is given: a synthetic `beforeinput`
		// dispatched by hand fires on a container that is no editing host just as happily,
		// and would pin nothing.
		//
		// MEASURED discrimination — the four mutations that turn them red: dropping the
		// container write (both), freezing a text surface (both), freezing the slot ROOT
		// (the slot one), freezing the slot HOST (the slot one).
		//
		// The one they do NOT catch, and it is worth knowing why: putting
		// `contenteditable=true` BACK on the slot host leaves them green. Measured, with the
		// container editable and the host `display: contents`, Chromium leaves focus on the
		// container and still fires `insertText` — the nested host is inert. What made it
		// fatal at T3 was the absence of any OTHER host: focus had nowhere to go but the
		// boxless one, and there Chromium fires nothing. The container write is what masks it.
		// The bare slot host is therefore gated at ATTRIBUTE level instead, by `bind.spec`'s
		// 'a slot mark leaves root and host BARE …' — that is where the property lives.
		it('typing into a plain text span reaches the value through the container host', async () => {
			const {store, container, surfaces} = mountValue('hello @[world] tail', {
				options: [{markup: '@[__value__]'}],
				Mark: () => null,
			})
			await caretInEditor(store, surfaces[0], 2)

			await userEvent.keyboard('X')

			expect(store.tokens.value()).toBe('heXllo @[world] tail')
			// AND the caret followed the edit: the value assert alone passes even when the
			// post-commit re-place drops it, and a caret stuck at 2 is an unusable editor.
			expect(selectionRange(store)).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('typing into slot content reaches the value', async () => {
			// '@[a @[b] c]' — the slot's own children hang off a registered child-sequence
			// host, and offset 3 is inside the leading 'a ' child of that slot.
			const {store, container, before} = mountNested()
			await caretInEditor(store, before, 3)

			await userEvent.keyboard('X')

			expect(store.tokens.value()).toBe('@[aX @[b] c]')
			expect(selectionRange(store)).toEqual({start: 4, end: 4})
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