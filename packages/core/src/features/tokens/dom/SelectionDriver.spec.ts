import {afterEach, describe, it, expect, vi} from 'vitest'
import {userEvent} from 'vitest/browser'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {
	caretAt,
	consignRendered,
	mountNested,
	mountStructuralInline,
	mountStructuralInlineMark,
	mountValue,
	selectionRange,
} from '../__testing__/mountFixtures'
import {offsetOfAnchor} from '../tree/anchors'
import type {TextNode} from '../tree/types'
import {DomModel} from './DomModel'

describe('SelectionDriver', () => {
	it('repeated placement at the same node notifies once', () => {
		// The stored form is anchors, so the dedupe under test is anchor IDENTITY. It watches
		// those anchors DIRECTLY since S2.6 — until then it watched the derived numeric
		// `range`, whose own `{equals: shallow}` collapsed the second notification whatever
		// `anchorEquals` did, which is why the case below had to exist to gate it.
		//
		// `selectNode` IS the write `focusFirst`'s placement performs (`placeAtHandle` lowers
		// onto it); the model's pass-through to that method came off with the API-surface cut,
		// and the dedupe it exercised is the stored write's, which this reaches directly.
		const {store, container} = mountStructuralInline('hello')
		const node = store.tokens.nodes()[0]
		const notify = vi.fn()
		const stop = watch(() => store.tokens.selection.anchors(), notify)
		store.tokens.selection.selectNode(node, 'start')
		store.tokens.selection.selectNode(node, 'start')
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
		const spy = vi.spyOn(DomModel.prototype, 'selectRange')
		store.tokens.selection.selectAll()
		store.tokens.selection.selectAll()
		expect(spy).toHaveBeenCalledTimes(1)
		spy.mockRestore()
		container.remove()
	})

	it('places at a mark whose start equals the previous text node end, at that one position', () => {
		// The gate for storing the NODE anchor instead of a numeric round-trip (spec S1 §4.6
		// item 5): in 'ab@[x]cd' the mark starts at 2, exactly where 'ab' ends — ONE position,
		// two legal spellings.
		const {store, container} = mountStructuralInlineMark('ab@[x]cd')
		const roots = store.tokens.nodes()
		const markNode = roots[1]
		// The handle still has to be BOUND for the placement to reach the DOM; the write
		// itself is the stored one `placeAtHandle` lowers onto.
		if (!store.tokens.handle(markNode.id)) throw new Error('Mark token did not bind a handle')

		expect(store.tokens.selection.selectNode(markNode, 'start')).toBe(true)

		// WHERE THE CARET LANDED, not what took focus: mark roots are not tab stops under the
		// one-host topology, so `document.activeElement` — the old witness — names the editing
		// host rather than the token.
		//
		// THE POSITION is the assertion that carries this case, and it is the one the numeric
		// round-trip this file exists to reject would get wrong. The SPELLING is the collapsed
		// reader's left affinity at the container arm: it answered `{before: markNode}` until
		// the near-edge rule landed, and now names the same boundary from the previous root's
		// end. Both are `offsetOfAnchor` 2; nothing about a mark's atomicity depends on which
		// side spells it, because a caret AT a mark's start is not a caret inside it.
		const anchor = store.tokens.domAnchors()?.anchor
		expect(anchor).toEqual({after: roots[0]})
		expect(anchor && offsetOfAnchor(roots, anchor)).toBe(offsetOfAnchor(roots, {before: markNode}))
		container.remove()
	})

	it('keeps the stored anchors when the caret lands ON the container', async () => {
		// A mark's caret is a PARENT coordinate, so for a top-level mark the anchor node is
		// the container itself — and the container owns no token, so the `selectionchange`
		// sync used to take its "outside the editor" exit and CLEAR the selection a tick
		// after every such placement (the caret then survives in the DOM but no commit
		// re-places it). The container IS the editor; it has to sync, not clear.
		const {store, container} = mountStructuralInlineMark('ab@[x]cd')
		const roots = store.tokens.nodes()
		const markNode = roots[1]

		store.tokens.selection.select({after: markNode})
		for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0))

		// THE MEASURED FIXPOINT, and it is reached in ONE write: the collapsed reader is
		// LEFT-affine at the container arm, so the boundary `placeCaret({after: mark})` lands
		// on reads back as that same anchor and the sync stores it unchanged.
		//
		// It used to take two more: right-affine, the boundary answered `{before: 'cd'}`, and
		// re-placing THAT put the caret inside 'cd', which the next sync named locally. Same
		// document position at every step — the assertion below is what says so — but those
		// extra writes clobbered Chromium's drag base, so a drag out of a mark selected
		// nothing. What this case rejects either way is the `undefined` the "outside the
		// editor" exit used to store.
		const anchors = store.tokens.selection.anchors()
		expect(anchors).toEqual({anchor: {after: markNode}, head: {after: markNode}})
		expect(anchors && offsetOfAnchor(roots, anchors.anchor)).toBe(offsetOfAnchor(roots, {after: markNode}))
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

		it('stores the NEAR edge of the mark a collapsed caret landed inside', () => {
			// END TO END for the near-edge rule. Chromium answers a click inside a mark with a
			// caret at the clicked CHARACTER, and the sync has to name an edge, because the model
			// owns no position inside a mark's presentation. It named the LEFT one whatever the
			// offset was — MEASURED in a browser at 20/50/65/75/85% of a mark's width, all five
			// `{before}` — so clicking the right half and pressing Backspace ate the character
			// BEFORE the mark instead of the mark.
			const {store, container, mark} = mountStructuralInlineMark('ab@[wxyz]cd')
			const inner = mark.appendChild(document.createTextNode('wxyz'))
			const markNode = store.tokens.nodes()[1]

			putCaret(inner, 1)
			document.dispatchEvent(new Event('selectionchange'))
			expect(store.tokens.selection.anchors()).toEqual({anchor: {before: markNode}, head: {before: markNode}})

			putCaret(inner, 3)
			document.dispatchEvent(new Event('selectionchange'))
			expect(store.tokens.selection.anchors()).toEqual({anchor: {after: markNode}, head: {after: markNode}})
			container.remove()
		})

		it('Backspace after a caret past a mark middle removes the MARK', async () => {
			// The CONSEQUENCE, and the shape the defect was reported in: `handleDeleteKey` reads
			// `domAnchors()` — the same collapsed read — and swallows the mark only when the
			// caret sits on one of its boundaries. With every in-mark caret answering
			// `{before: mark}`, the swallow missed and the step-back deleted the space before it
			// ('hello world foo' became 'helloworld foo').
			const {store, container, surfaces} = mountValue('hello @[world] foo', {
				options: [{markup: '@[__value__]'}],
				Mark: () => null,
			})
			// What an adapter's `Mark` would have rendered, and this bare fixture must not skip:
			// a click needs text inside the mark element to land in.
			const inner = surfaces[1].appendChild(document.createTextNode('world'))
			// The CLICK is what makes the container the editing host, so the keystroke below is
			// a real one; the caret is then put where Chromium puts it for a click past the
			// middle of 'world'.
			await userEvent.click(surfaces[0])
			putCaret(inner, 4)
			document.dispatchEvent(new Event('selectionchange'))

			await userEvent.keyboard('{Backspace}')

			expect(store.tokens.value()).toBe('hello  foo')
			container.remove()
		})

		it('focus leaving the container clears the stored anchors', async () => {
			// THE clear, and the only one the driver has left: focus out of the one editing
			// host. It replaces the deleted `focusin` listener's "no DOM selection" arm — that
			// one re-read a STALE range during the focus transition and re-applied it with a
			// focus steal, which is why a click into an adjacent span never moved the caret.
			// The microtask is the handler's own: `focusout` fires BEFORE `activeElement` moves.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			const outside = document.createElement('input')
			document.body.append(outside)
			store.tokens.selection.select({node: textRoot(store), offset: 1})
			expect(store.tokens.selection.anchors()).toBeDefined()

			outside.focus()
			await Promise.resolve()

			expect(store.tokens.selection.anchors()).toBeUndefined()
			outside.remove()
			container.remove()
		})

		it('a selectionchange that lands wholly OUTSIDE the container clears the stored anchors', () => {
			// THE `clear()` arm of `syncIfInEditor`, and the only case that gates it: `handleAt`
			// answers `undefined` for a node the container does not contain, which is the
			// "outside" verdict. Distinct from the `focusout` clear ('focus leaving the
			// container clears the stored anchors') — focus never moves here, the SELECTION
			// does, which is what a click into surrounding page text does while the editor
			// keeps focus. Neutering the arm to a bare `return` turns
			// this case red; the two half-outside/undefined exits keep their anchors.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			const outside = document.createElement('div')
			outside.append(document.createTextNode('elsewhere'))
			document.body.append(outside)
			store.tokens.selection.select({node: textRoot(store), offset: 1})
			expect(store.tokens.selection.anchors()).toBeDefined()

			putCaret(outside.firstChild!, 3)
			document.dispatchEvent(new Event('selectionchange'))

			expect(store.tokens.selection.anchors()).toBeUndefined()
			outside.remove()
			container.remove()
		})

		it('a half-outside range leaves the stored anchors standing', () => {
			// THE surviving exit (spec S2 D4): `anchorFor` answering `undefined` means "the DOM
			// cannot be read here", not "nothing is selected" — the previous anchors stay and
			// the next `selectionchange` corrects them. Its reachable form is a RANGE with one
			// end outside the container: the focus end is in the editor, so `syncIfInEditor`
			// passes it through rather than taking the "outside" CLEAR, and the far end is what
			// declines. Turning that `return` into a `clear()` turns this case red.
			const {store, container, before} = mountStructuralInlineMark('ab@[x]cd')
			const textNode = textRoot(store)
			store.tokens.selection.select({node: textNode, offset: 1})

			const outside = document.createElement('div')
			outside.append(document.createTextNode('elsewhere'))
			document.body.append(outside)
			const editorEnd = before.firstChild
			if (!editorEnd) throw new Error('the leading surface rendered no text node')
			window.getSelection()?.setBaseAndExtent(outside.firstChild!, 3, editorEnd, 1)
			document.dispatchEvent(new Event('selectionchange'))

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
			consignRendered(store, container)

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
		/**
		 * The two properties that survive "the sweep tracker's document listeners went with the
		 * flip", which asserted neither. That form matched a call 3-TUPLE —
		 * `(type, fn, undefined)` — so `addEventListener(type, fn, {capture: false})` walked
		 * straight past it, and a real mount-time `listen(document, 'mouseup', fn, {capture:
		 * false})` patched into the driver ran the file 22 passed / 0 failed. It could not see a
		 * leak at all either: a raw `document.addEventListener('keyup', fn)` left standing at
		 * unmount passed it.
		 *
		 * Neither replacement forbids document listeners in general. There is no such rule —
		 * `OverlayController` attaches a capture-phase document `click` while a match is live,
		 * and that is the shipped pattern: lazily attached, interaction-scoped, released when
		 * the interaction ends. What mount may not do is take a page-wide stream for the
		 * lifetime of an editor, which is what made the deleted sweep flip damaging.
		 */
		const POINTER_STREAM = /^(?:mouse|pointer|drag|touch)/

		/** `[type, handler]` as a comparable string — handlers are identified by reference. */
		function listenerKeys(calls: readonly (readonly unknown[])[], ids: Map<unknown, number>): string[] {
			return calls.map(([type, handler]) => {
				if (!ids.has(handler)) ids.set(handler, ids.size)
				return `${String(type)}#${ids.get(handler)}`
			})
		}

		it('mounting takes no page-wide pointer stream', () => {
			const addSpy = vi.spyOn(document, 'addEventListener')
			const store = new Store()
			store.host.container(document.createElement('div'))

			const streams = addSpy.mock.calls.map(([type]) => type).filter(type => POINTER_STREAM.test(type))
			expect(streams).toEqual([])
			addSpy.mockRestore()
		})

		it('unmounting removes exactly the document listeners mounting added', () => {
			const addSpy = vi.spyOn(document, 'addEventListener')
			const removeSpy = vi.spyOn(document, 'removeEventListener')
			const store = new Store()
			store.host.container(document.createElement('div'))

			const ids = new Map<unknown, number>()
			const added = listenerKeys(addSpy.mock.calls, ids)
			// Not vacuous: mounting really does attach `selectionchange` handlers.
			expect(added.length).toBeGreaterThan(0)

			store.host.container(null)

			const removed = listenerKeys(removeSpy.mock.calls, ids)
			expect(removed.toSorted()).toEqual(added.toSorted())
			addSpy.mockRestore()
			removeSpy.mockRestore()
		})
	})

	describe('restoration via tokens.bound', () => {
		// THE DOM CLOCK, and these cases are what pins it rather than the commit clock: every one
		// of them writes its caret intent BEFORE any element is bound, then binds. Measured on
		// the first case — consigning fires `bound` and `committed` NOT AT ALL, and the caret is
		// unplaced until that binding lands — so a driver reading `committed` would leave the
		// caret where it was, having never been told the handles exist.
		it('restores range after the model announces consistency', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)

			store.props.set({defaultValue: 'hello'})
			store.host.container(container)
			consignRendered(store, container)
			caretAt(store, 5)

			const sel = window.getSelection()
			expect(sel?.focusNode).toBe(span.firstChild)
			expect(sel?.focusOffset).toBe(5)
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
			consignRendered(store, container)
			caretAt(store, 999)

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
			consignRendered(store, container)
			store.tokens.selection.select(store.tokens.anchorAt(999), store.tokens.anchorAt(1000))

			// Both anchors are `'end'`, so the selection is collapsed rather than clamped.
			expect(selectionRange(store)).toEqual({start: 5, end: 5})
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
})