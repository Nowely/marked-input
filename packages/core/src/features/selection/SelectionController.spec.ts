import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

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

function mountStructuralNestedWithChildSequence(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const control = document.createElement('input')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	control.type = 'checkbox'
	host.style.display = 'contents'
	host.append(before, inner, after)
	outer.append(control, host)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.host.container(container)
	// The registration is id-keyed since S1.8 step 4, so it has to come AFTER the mount
	// publishes a tree: an adapter registers from the render of a token that already has
	// an id, and a spec has to do the same.
	store.tokens.children(store.tokens.keyOf(store.tokens.current()[1]))(host)
	store.host.rendered()
	return {store, container, leading, outer, control, host, before, inner, after, trailing}
}

function mountStructuralBlockWithControl(value: string) {
	const store = enableStructuralStore(value, {layout: 'block'})
	const container = document.createElement('div')
	const row = document.createElement('div')
	const control = document.createElement('button')
	const textSurface = document.createElement('span')
	control.textContent = 'x'
	row.append(control, textSurface)
	container.append(row)
	document.body.append(container)
	store.host.container(container)
	store.tokens.control()(control)
	store.host.rendered()
	const textNode = textSurface.firstChild
	const controlText = control.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	if (!(controlText instanceof Text)) throw new Error('Structural control did not render a text node')
	return {store, container, row, control, controlText, textSurface, textNode}
}

describe('SelectionController', () => {
	it('exposes range', () => {
		const store = new Store()
		expect(typeof store.selection.range).toBe('function')
	})

	it('range starts undefined', () => {
		expect(new Store().selection.range()).toBeUndefined()
	})

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

	describe('position', () => {
		it('is undefined when range is undefined', () => {
			expect(new Store().selection.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			// `defaultValue` is load-bearing now (plan decision D-f): an anchor addresses a
			// NODE, so offset 5 has to exist in the document for the write to resolve.
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.position(5)
			expect(store.selection.position()).toBe(5)
		})
		it('write collapses range to {pos, pos}', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.position(5)
			expect(store.selection.range()).toEqual({start: 5, end: 5})
		})
		it('write does not change isUserSelecting', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.isUserSelecting(true)
			store.selection.position(5)
			expect(store.selection.isUserSelecting()).toBe(true)
		})
		it('write collapses an extended range', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.selectAll()
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
			store.selection.position(2)
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns false for a partial range', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.select(store.tokens.anchorAt(1), store.tokens.anchorAt(3))
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns true when range spans the entire value', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.selectAll()
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

	describe('boundary mapping', () => {
		it('maps registered child sequence host boundaries to nested child positions', () => {
			const {store, container, host} = mountStructuralNestedWithChildSequence()
			const outer = store.tokens.current()[1]
			if (outer.type !== 'mark') throw new Error('expected the outer mark')
			// The path layer went at S1.8 step 4; the fixture's three slot children are read
			// straight off the mark that owns them.
			const [beforeToken, innerToken, afterToken] = outer.children

			expect(beforeToken.position.end).toBe(9)
			expect(innerToken.position.start).toBe(9)
			expect(innerToken.position.end).toBe(18)
			expect(afterToken.position.start).toBe(18)
			expect(store.tokens.boundaryFor(host, 1, 'before')).toBe(beforeToken.position.end)
			expect(store.tokens.boundaryFor(host, 1, 'after')).toBe(innerToken.position.start)
			expect(store.tokens.boundaryFor(host, 2, 'before')).toBe(innerToken.position.end)
			expect(store.tokens.boundaryFor(host, 2, 'after')).toBe(afterToken.position.start)
			container.remove()
		})

		it('maps text-surface boundaries to raw UTF-16 positions', () => {
			const {store, container, textNode} = mountStructuralInline('hello')

			expect(store.tokens.boundaryFor(textNode, 2)).toBe(2)
			container.remove()
		})

		it('rejects boundaries that split surrogate pairs', () => {
			const {store, container, textNode} = mountStructuralInline('a😀b')

			expect(store.tokens.boundaryFor(textNode, 2)).toBeUndefined()
			container.remove()
		})

		it('maps token shell boundaries by affinity', () => {
			const {store, container, textSurface} = mountStructuralInline('hello')

			expect(store.tokens.boundaryFor(textSurface, 0, 'before')).toBe(0)
			expect(store.tokens.boundaryFor(textSurface, 1, 'after')).toBe(5)
			container.remove()
		})

		it('rejects editable boundaries inside mark presentation descendants', () => {
			const {store, container, mark} = mountStructuralInlineMark('@[world]')
			const descendant = document.createElement('span')
			descendant.contentEditable = 'true'
			descendant.textContent = 'inner'
			mark.append(descendant)
			const descendantText = descendant.firstChild
			if (!(descendantText instanceof Text)) throw new Error('Mark descendant did not render a text node')
			store.host.rendered()

			expect(store.tokens.boundaryFor(descendantText, 0, 'after')).toBeUndefined()
			container.remove()
		})

		it('returns undefined for selections crossing controls', () => {
			const {store, container, textNode, controlText} = mountStructuralBlockWithControl('hello')
			const selection = window.getSelection()!
			const range = document.createRange()
			range.setStart(textNode, 0)
			range.setEnd(controlText, 1)
			selection.removeAllRanges()
			selection.addRange(range)

			expect(store.selection.readRaw()).toBeUndefined()
			container.remove()
		})
	})

	describe('caret repair (spec D7, AC-3.2/3.3/3.4)', () => {
		/**
		 * `store.tokens.replace` — NOT `store.edit.replace` (it was `store.value.replace`
		 * until S1.8 step 5 deleted the facade). EditController writes the caret itself
		 * afterwards, which would mask everything these cases assert.
		 */
		it('keeps node and offset when the edit is outside the anchor, and still reports the NEW offset', () => {
			// AC-3.2 and the #generation gate in one case, hand-traced:
			//   'ab@[x]cd' → text[0,2] mark[2,6] text[6,8]; caret 7 = {node: cd, offset: 1}.
			//   insert 'Z' at 0 → window {0,0,1} → map(7) = 8 → anchorAt(8) → cd is now [7,9]
			//   → {node: cd, offset: 1} — the SAME node object and the SAME local offset, so
			//   the `#anchors` write is deduped and notifies nothing. Only the generation bump
			//   makes range() answer 8; without it the computed returns the cached 7.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			store.selection.position(7)
			expect(store.selection.range()).toEqual({start: 7, end: 7})

			store.tokens.replace({start: 0, end: 0}, 'Z')

			expect(store.tokens.value()).toBe('Zab@[x]cd')
			expect(store.selection.range()).toEqual({start: 8, end: 8})
			container.remove()
		})

		it('maps a caret inside the edited region to the end of the inserted text', () => {
			// AC-3.3. Caret 7 (inside 'cd'), replace [6,8] with 'ZZZZ' → window {6,8,4} →
			// map(7) → 6 + 4 = 10.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			store.selection.position(7)

			store.tokens.replace({start: 6, end: 8}, 'ZZZZ')

			expect(store.selection.range()).toEqual({start: 10, end: 10})
			container.remove()
		})

		it('survives the anchor node being REMOVED by the transaction', () => {
			// AC-3.3's second half. Whole-value write: gapWindow('ab@[x]cd','zz') = {0,8,2};
			// adoption pairs by index, so root 0 is retained and the mark AND 'cd' — the
			// anchor's node — are removed. map(7) → inside the window → 0 + 2 = 2.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			store.selection.position(7)

			store.tokens.replace({start: 0, end: -1}, 'zz')

			expect(store.tokens.value()).toBe('zz')
			expect(store.selection.range()).toEqual({start: 2, end: 2})
			container.remove()
		})

		it('maps a cross-node replacement spanning a mark to the end of the replacement', () => {
			// AC-3.4. Caret 8 (document end), replace [1,7] with 'Q' → 'aQd', window {1,7,1},
			// delta -5 → map(8) = 3.
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			store.selection.position(8)

			store.tokens.replace({start: 1, end: 7}, 'Q')

			expect(store.tokens.value()).toBe('aQd')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('repairs the caret through the EXACT edit window, not a narrowed one', () => {
			// Gates the offset shim's whole-value-only narrowing (S1.6a mutation 6, spec D8).
			// 'hello' + replace [0,3) with 'hey': the exact window {0,3,3} maps a caret at 1 to 3
			// (inside → start + insertedLength). Narrowing to the shared-prefix gap window
			// {2,3,1} maps it to 1 instead, because 1 is then strictly BEFORE the window.
			const {store, container} = mountStructuralInline('hello')
			store.selection.position(1)

			store.tokens.replace({start: 0, end: 3}, 'hey')

			expect(store.tokens.value()).toBe('heylo')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('leaves the selection alone when there was none', () => {
			const {store, container} = mountStructuralInlineMark('ab@[x]cd')
			expect(store.selection.range()).toBeUndefined()
			store.tokens.replace({start: 0, end: 0}, 'Z')
			expect(store.selection.range()).toBeUndefined()
			container.remove()
		})
	})

	describe('controlled caret (spec AC-4.4)', () => {
		it('repairs at the echo, once, with no optimistic move', () => {
			// THE integration gate for plan decisions D-a AND D-e simultaneously:
			//   left affinity answers 3 → range {2,2} after the echo;
			//   keeping the optimistic write answers {4,4} (the captured caret is already 3).
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next})})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace({start: 2, end: 2}, 'X')

			expect(store.tokens.value()).toBe('heXllo')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('a rejecting parent moves no caret at all', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({value: 'hello', onChange})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace({start: 2, end: 2}, 'X')

			expect(onChange).toHaveBeenCalledWith('heXllo')
			expect(store.tokens.value()).toBe('hello')
			expect(store.selection.range()).toEqual({start: 2, end: 2})
			container.remove()
		})

		it("captures an 'end' anchor in TREE space, not against the props value", () => {
			// The only case that separates `offsetOfAnchor('end')` (the last root's end) from a
			// `value.current().length` read: during an ECHO's capture the tree still holds the
			// pre-edit projection while `value.current()` is already the parent's next string.
			// An out-of-range intent is the idiom that produces an `'end'` anchor (see the two
			// out-of-range cases above). A DELETION is required — under an insertion the
			// over-read and `map`'s shift saturate back onto the same document end.
			//   correct: capture 5 → window {0,1,0} → map(5) = 4;
			//   props-length read: capture 4 → map(4) = 3.
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next})})
			const {container} = mountInline(store)
			store.selection.position(999)

			store.edit.replace({start: 0, end: 1}, '')

			expect(store.tokens.value()).toBe('ello')
			expect(store.selection.range()).toEqual({start: 4, end: 4})
			container.remove()
		})

		it('a transforming parent still repairs, through the gap window', () => {
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next.toUpperCase()})})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace({start: 2, end: 2}, 'X')

			expect(store.tokens.value()).toBe('HEXLLO')
			// gapWindow('hello','HEXLLO') = {0,5,6}; map(2) is inside → 0 + 6 = 6. Best effort,
			// which is what AC-4.2/4.4 promise for a transform.
			expect(store.selection.range()).toEqual({start: 6, end: 6})
			container.remove()
		})
	})
})