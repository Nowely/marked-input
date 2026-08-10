import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {selectionRange} from '../tokens/__testing__/mountFixtures'

function mountStructuralInline(value = 'hello') {
	const store = new Store()
	store.props.set({defaultValue: value})
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

function mountStructuralMarkWithDescendant(value = '@[world]') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const before = document.createElement('span')
	const mark = document.createElement('mark')
	const after = document.createElement('span')
	const descendant = document.createElement('span')
	descendant.contentEditable = 'true'
	descendant.textContent = 'inner'
	mark.append(descendant)
	container.append(before, mark, after)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	const descendantText = descendant.firstChild
	if (!(descendantText instanceof Text)) throw new Error('Structural mark descendant did not render a text node')
	return {store, container, descendantText}
}

function inputEvent(inputType: string, range: Range, init?: InputEventInit): InputEvent {
	const event = new InputEvent('beforeinput', {
		inputType,
		bubbles: true,
		cancelable: true,
		...init,
	})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [range]})
	return event
}

describe('handleBeforeInput()', () => {
	it('inserts text at the target range resolved as anchors', () => {
		const {store, container, textNode} = mountStructuralInline()
		const replace = vi.spyOn(store.edit, 'replace')
		const node = store.tokens.nodes()[0]
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertText', range, {data: 'x'})

		// Drive handleBeforeInput through the beforeinput listener enableInput
		// wired at mount (capture phase on the container).
		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		// The DOM boundary resolves to the LIVE node, not to the number 1 (spec S2 §4.5).
		expect(replace).toHaveBeenCalledWith({node, offset: 1}, {node, offset: 1}, 'x')
		expect(selectionRange(store)).toEqual({start: 2, end: 2})
		container.remove()
	})

	it('ignores beforeinput from editable mark descendants', () => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const replaceRange = vi.spyOn(store.tokens, 'replaceBetween')
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 0)
		const event = inputEvent('insertText', range, {data: 'x'})

		// Through the wired beforeinput listener (see above).
		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(replaceRange).not.toHaveBeenCalled()
		container.remove()
	})

	it('does not wipe the value when an unhandled input type arrives with everything selected', () => {
		// MEASURED BUG, not a hypothesis: the all-selected branch used to compute
		// `event.data ?? ''` for every non-delete input type, so Enter (insertParagraph,
		// data === null) preventDefaulted and replaced the WHOLE value with ''. Measured
		// on a mounted store with defaultValue 'hello': {value: '', prevented: true}.
		// The ordinary (not-all-selected) path already ignores these types, because
		// replacementForInput returns undefined for them.
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		expect(store.selection.isAllSelected()).toBe(true)
		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(store.tokens.value()).toBe('hello')
		expect(event.defaultPrevented).toBe(false)
		container.remove()
	})

	it('still replaces the whole value on insertText with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'a',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a')
		container.remove()
	})

	it('still clears the whole value on a delete input type with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'deleteContentBackward',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
		container.remove()
	})

	/**
	 * THE mark-swallow gate (spec S2 AC-4.4), and the only one outside the browser suites:
	 * a caret sitting exactly on a mark's boundary deletes the WHOLE mark, not one character
	 * of the neighbouring text.
	 *
	 * Both directions are asserted because that is what makes the case discriminate —
	 * measured: inverting `anchorsForDelete`'s direction (`-1`/`+1` swapped) turns BOTH red,
	 * where either one alone would only pin "some mark got deleted".
	 */
	describe('mark swallow', () => {
		function mountMarkFixture() {
			const store = new Store()
			store.props.set({defaultValue: 'he@[x]llo', Mark: () => null, options: [{markup: '@[__value__]'}]})
			const container = document.createElement('div')
			const head = document.createElement('span')
			head.append(document.createTextNode('he'))
			const mark = document.createElement('span')
			mark.append(document.createTextNode('x'))
			const tail = document.createElement('span')
			tail.append(document.createTextNode('llo'))
			container.append(head, mark, tail)
			document.body.append(container)
			store.host.container(container)
			store.host.rendered()
			return {store, container, head, tail}
		}

		function caretAt(node: Node, offset: number) {
			const selection = window.getSelection()
			if (!selection) throw new Error('no window selection')
			const range = document.createRange()
			range.setStart(node, offset)
			range.setEnd(node, offset)
			selection.removeAllRanges()
			selection.addRange(range)
		}

		it('Backspace right AFTER a mark deletes the mark', () => {
			const {store, container, tail} = mountMarkFixture()
			caretAt(tail.firstChild!, 0)

			container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true}))

			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})

		it('Delete right BEFORE a mark deletes the mark', () => {
			const {store, container, head} = mountMarkFixture()
			caretAt(head.firstChild!, 2)

			container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true}))

			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})
	})

	/**
	 * The keydown path had NO direct coverage before S1.8. It was flagged as redundant with its
	 * own fallthrough — the DOM read on an all-selected editor spans the whole document, which
	 * the delete target passes straight through — and the first case below does NOT discriminate
	 * it: deleting the branch keeps that one green. The second case does, and that is what
	 * refutes the claim. The two paths diverge exactly when the STORED selection says
	 * all-selected while the DOM selection is gone: the branch still preventDefaults and clears,
	 * the fallthrough bails on `domAnchors()` and lets the browser mutate contenteditable behind
	 * the model's back.
	 */
	describe('handleDeleteKey()', () => {
		it('clears the whole value on Backspace with everything selected', () => {
			const {store, container} = mountStructuralInline()
			store.selection.selectAll()

			const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('')
			container.remove()
		})

		it('clears the whole value even when the DOM selection is gone', () => {
			// THE discriminating case (see the note above): the only one that fails when the
			// all-selected branch is deleted.
			const {store, container} = mountStructuralInline()
			store.selection.selectAll()
			window.getSelection()?.removeAllRanges()

			const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('')
			container.remove()
		})
	})
})