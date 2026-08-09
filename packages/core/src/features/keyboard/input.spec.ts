import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'

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
	it('inserts text through replaceRange using target ranges', () => {
		const {store, container, textNode} = mountStructuralInline()
		const replaceRange = vi.spyOn(store.edit, 'replace')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertText', range, {data: 'x'})

		// Drive handleBeforeInput through the beforeinput listener enableInput
		// wired at mount (capture phase on the container).
		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(replaceRange).toHaveBeenCalledWith({start: 1, end: 1}, 'x')
		expect(store.selection.range()).toEqual({start: 2, end: 2})
		container.remove()
	})

	it('ignores beforeinput from editable mark descendants', () => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const replaceRange = vi.spyOn(store.value, 'replace')
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

		expect(store.value.current()).toBe('hello')
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
		expect(store.value.current()).toBe('a')
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
		expect(store.value.current()).toBe('')
		container.remove()
	})
})