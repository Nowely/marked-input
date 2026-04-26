import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {applySpanInput, enableInput, handleBeforeInput, replaceAllContentWith} from './input'

function mountStructuralInline(value = 'hello') {
	const store = new Store()
	store.props.set({defaultValue: value})
	store.value.enable()
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	container.append(textSurface)
	document.body.append(container)
	store.dom.container(container)
	store.dom.enable()
	store.lifecycle.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural text surface did not render a text node')
	return {store, container, textSurface, textNode}
}

function mountStructuralMarkWithDescendant(value = '@[world]') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup: '@[__value__]'}]})
	store.value.enable()
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
	store.dom.container(container)
	store.dom.enable()
	store.lifecycle.rendered()
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

describe('applySpanInput()', () => {
	it('delete the next character when deleteContentForward has no target ranges', () => {
		const focus = {
			content: '!',
			caret: 0,
		}
		const event = {
			inputType: 'deleteContentForward',
			getTargetRanges: () => [],
			preventDefault: vi.fn(),
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- applySpanInput only touches content/caret in this focused regression test
		expect(applySpanInput(focus as never, event as never)).toBe(true)
		expect(event.preventDefault).toHaveBeenCalledOnce()
		expect(focus.content).toBe('')
		expect(focus.caret).toBe(0)
	})
})

describe('replaceAllContentWith()', () => {
	it('controlled full-content replace emits without committing current', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.value.enable()

		replaceAllContentWith(store, 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})
})

describe('handleBeforeInput()', () => {
	it('inserts text through replaceRange using target ranges', () => {
		const {store, container, textNode} = mountStructuralInline()
		const replaceRange = vi.spyOn(store.value, 'replaceRange')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertText', range, {data: 'x'})

		handleBeforeInput(store, event)

		expect(event.defaultPrevented).toBe(true)
		expect(replaceRange).toHaveBeenCalledWith({start: 1, end: 1}, 'x', {
			source: 'input',
			recover: {kind: 'caret', rawPosition: 2},
		})
		container.remove()
	})

	it('does not commit beforeinput during composition', () => {
		const {store, container, textNode} = mountStructuralInline()
		const replaceRange = vi.spyOn(store.value, 'replaceRange')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertText', range, {data: 'x'})

		store.dom.compositionStarted()
		handleBeforeInput(store, event)

		expect(replaceRange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		container.remove()
	})

	it('ignores beforeinput from editable mark descendants', () => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const replaceRange = vi.spyOn(store.value, 'replaceRange')
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 0)
		const event = inputEvent('insertText', range, {data: 'x'})

		handleBeforeInput(store, event)

		expect(event.defaultPrevented).toBe(false)
		expect(replaceRange).not.toHaveBeenCalled()
		container.remove()
	})
})

describe('composition input', () => {
	it('commits composition text at the original raw selection', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const disable = enableInput(store)
		const selection = window.getSelection()
		const initialRange = document.createRange()
		initialRange.setStart(textNode, 1)
		initialRange.collapse(true)
		selection?.removeAllRanges()
		selection?.addRange(initialRange)

		container.dispatchEvent(new Event('compositionstart', {bubbles: true}))
		textNode.textContent = 'aXb'

		const finalRange = document.createRange()
		finalRange.setStart(textNode, 2)
		finalRange.collapse(true)
		selection?.removeAllRanges()
		selection?.addRange(finalRange)
		const compositionEnd = new Event('compositionend', {bubbles: true})
		Object.defineProperty(compositionEnd, 'data', {value: 'X'})

		container.dispatchEvent(compositionEnd)

		expect(store.value.current()).toBe('aXb')
		disable()
		container.remove()
	})
})