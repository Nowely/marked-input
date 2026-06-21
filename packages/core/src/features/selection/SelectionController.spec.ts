import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import {resolvePath} from '../tokens/tokenIndex'

function enableStructuralStore(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	return store
}

function mountStructuralInline(value: string) {
	const store = enableStructuralStore(value)
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
	store.tokens.children([1])(host)
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
	store.tokens.control([0])(control)
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

	it('range write is structural-equality deduped', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.range({start: 5, end: 5})
		store.selection.range({start: 5, end: 5})
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('range undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.selection.range, notify)
		store.selection.range(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
	})

	describe('isAllSelected', () => {
		it('returns false when value is empty', () => {
			expect(new Store().selection.isAllSelected()).toBe(false)
		})
		it('returns false when range is collapsed', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 2, end: 2})
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns false for a partial range', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 1, end: 3})
			expect(store.selection.isAllSelected()).toBe(false)
		})
		it('returns true when range spans the entire value', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.range({start: 0, end: 5})
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
			store.selection.range({start: 5, end: 5})

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
			store.selection.range({start: 3, end: 3})

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
			store.selection.range({start: 3, end: 3})
			store.host.rendered()
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('clamps OOB caret range and places at maxPos', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.selection.range({start: 999, end: 999})
			store.host.rendered()

			expect(store.selection.range()).toEqual({start: 5, end: 5})
			container.remove()
		})

		it('clamps OOB selection range', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.appendChild(document.createTextNode('hello'))
			container.appendChild(span)
			document.body.appendChild(container)
			store.host.container(container)
			store.selection.range({start: 999, end: 1000})
			store.host.rendered()

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
			const tree = store.tokens.current()
			const beforeToken = resolvePath(tree, [1, 0])
			const innerToken = resolvePath(tree, [1, 1])
			const afterToken = resolvePath(tree, [1, 2])

			expect(beforeToken?.position.end).toBe(9)
			expect(innerToken?.position.start).toBe(9)
			expect(innerToken?.position.end).toBe(18)
			expect(afterToken?.position.start).toBe(18)
			expect(store.tokens.boundaryFor(host, 1, 'before')).toBe(beforeToken?.position.end)
			expect(store.tokens.boundaryFor(host, 1, 'after')).toBe(innerToken?.position.start)
			expect(store.tokens.boundaryFor(host, 2, 'before')).toBe(innerToken?.position.end)
			expect(store.tokens.boundaryFor(host, 2, 'after')).toBe(afterToken?.position.start)
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
})