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

function mountStructuralMarkWithDescendant(value = '@[world]', editableSpelling = 'true') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const before = document.createElement('span')
	const mark = document.createElement('mark')
	const after = document.createElement('span')
	const descendant = document.createElement('span')
	// The ATTRIBUTE, in the consumer's own spelling — Chromium normalizes '' and 'TRUE'
	// to the `contentEditable` property value 'true', which is what the guard reads.
	descendant.setAttribute('contenteditable', editableSpelling)
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

/** A registered control root (block menu, custom chrome) holding its own `<input>`. */
function mountInlineWithControl(value = 'hello') {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	const control = document.createElement('div')
	const controlInput = document.createElement('input')
	control.append(controlInput)
	container.append(textSurface, control)
	document.body.append(container)
	store.host.container(container)
	store.tokens.control()(control)
	store.host.rendered()
	return {store, container, controlInput}
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
		// Enter now HAS a replacement ('\n', pinned below), so the unhandled type this
		// case needs is one the guard cannot express at all — and under one host it is
		// dropped rather than let through.
		const {store, container} = mountStructuralInline()
		store.tokens.selection.selectAll()
		expect(store.tokens.selection.isAllSelected()).toBe(true)
		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(store.tokens.value()).toBe('hello')
		expect(event.defaultPrevented).toBe(true)
		container.remove()
	})

	it('replaces the whole value with a newline on Enter with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('\n')
		container.remove()
	})

	it('insertParagraph maps to a newline through the guard', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertParagraph', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
		container.remove()
	})

	it('insertLineBreak maps to a newline through the guard', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertLineBreak', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
		container.remove()
	})

	it('an unhandled cancelable inputType is prevented and changes nothing (fail closed)', () => {
		// Under one host every default this guard leaves standing edits the DOM the model
		// owns, so an input type it cannot express as an edit is dropped, not forwarded.
		const {store, container} = mountStructuralInline('ab')
		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('fails an unhandled type closed even when it originates BELOW the container', () => {
		// THE discriminating shape: a real beforeinput carries a target range INSIDE the
		// host, and everything in there INHERITS `isContentEditable` from the container.
		// An inherited-editability test therefore reads every ordinary edit as a consumer
		// island and lets it through — the case dispatched on the container cannot see it.
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 0)
		range.setEnd(textNode, 2)
		const event = inputEvent('formatBold', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('leaves an unhandled type alone inside an EXPLICIT contenteditable island', () => {
		// The consumer's own DOM, marked as such by an explicit attribute — the model
		// neither owns it nor resolves boundaries in it, so cancelling would only freeze
		// the widget.
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 5)
		const event = inputEvent('formatBold', range)

		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('@[world]')
		container.remove()
	})

	it.each([
		['the empty-string spelling', ''],
		['an upper-case spelling', 'TRUE'],
	])('leaves an unhandled type alone inside an island written with %s', (_label, spelling) => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant('@[world]', spelling)
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 5)
		const event = inputEvent('formatBold', range)

		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('@[world]')
		container.remove()
	})

	it('inserts the dropped text at the target range', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const dataTransfer = new DataTransfer()
		dataTransfer.setData('text/plain', 'X')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertFromDrop', range, {dataTransfer})

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('aXb')
		container.remove()
	})

	it('a non-cancelable inputType passes through untouched', () => {
		// A CHARACTERIZATION pin, and it cannot be otherwise: `preventDefault` on an
		// uncancelable event is a no-op, so deleting the guard's `!event.cancelable` return
		// keeps this green. That return earns its place by keeping Chromium from logging
		// "Ignored attempt to cancel a beforeinput event with cancelable=false" on every
		// composition keystroke — console noise no assertion here can see.
		const {store, container} = mountStructuralInline('ab')
		const event = new InputEvent('beforeinput', {
			inputType: 'insertCompositionText',
			bubbles: true,
			cancelable: false,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('leaves a control root alone even when the model believes everything is selected', () => {
		// MEASURED HARM the consumer-origin test prevents: the all-selected branch keys on
		// the STORED selection, so a character typed into a control's own `<input>` used to
		// replace the whole value with that character.
		const {store, container, controlInput} = mountInlineWithControl()
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'z',
			bubbles: true,
			cancelable: true,
		})

		controlInput.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('hello')
		container.remove()
	})

	it('leaves Ctrl/Cmd+A to a control root', () => {
		const {store, container, controlInput} = mountInlineWithControl()

		const event = new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})
		controlInput.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.selection.isAllSelected()).toBe(false)
		container.remove()
	})

	it('Ctrl/Cmd+A selects all from the input keydown path', () => {
		const {store, container} = mountStructuralInline('ab')

		const event = new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.selection.isAllSelected()).toBe(true)
		container.remove()
	})

	it('still replaces the whole value on insertText with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.tokens.selection.selectAll()
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
		store.tokens.selection.selectAll()
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
			store.tokens.selection.selectAll()

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
			store.tokens.selection.selectAll()
			window.getSelection()?.removeAllRanges()

			const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('')
			container.remove()
		})
	})
})