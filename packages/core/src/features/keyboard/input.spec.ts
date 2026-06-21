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
})