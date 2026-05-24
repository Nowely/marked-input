import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

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
	store.bridge.childrenFor([1])(host)
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
	store.bridge.controlFor([0])(control)
	store.host.rendered()
	const textNode = textSurface.firstChild
	const controlText = control.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	if (!(controlText instanceof Text)) throw new Error('Structural control did not render a text node')
	return {store, container, row, control, controlText, textSurface, textNode}
}

describe('DomSelectionBridge', () => {
	describe('raw boundary mapping', () => {
		it('maps registered child sequence host boundaries to nested child positions', () => {
			const {store, container, host} = mountStructuralNestedWithChildSequence()
			const tokenIndex = store.tokens.index()
			const beforeToken = tokenIndex.resolve([1, 0])
			const innerToken = tokenIndex.resolve([1, 1])
			const afterToken = tokenIndex.resolve([1, 2])

			expect(beforeToken?.position.end).toBe(9)
			expect(innerToken?.position.start).toBe(9)
			expect(innerToken?.position.end).toBe(18)
			expect(afterToken?.position.start).toBe(18)
			expect(store.selection.rawPositionFromBoundary(host, 1, 'before')).toEqual({
				ok: true,
				value: beforeToken?.position.end,
			})
			expect(store.selection.rawPositionFromBoundary(host, 1, 'after')).toEqual({
				ok: true,
				value: innerToken?.position.start,
			})
			expect(store.selection.rawPositionFromBoundary(host, 2, 'before')).toEqual({
				ok: true,
				value: innerToken?.position.end,
			})
			expect(store.selection.rawPositionFromBoundary(host, 2, 'after')).toEqual({
				ok: true,
				value: afterToken?.position.start,
			})
			container.remove()
		})

		it('maps text-surface boundaries to raw UTF-16 positions', () => {
			const {store, container, textNode} = mountStructuralInline('hello')

			expect(store.selection.rawPositionFromBoundary(textNode, 2)).toEqual({ok: true, value: 2})
			container.remove()
		})

		it('rejects boundaries that split surrogate pairs', () => {
			const {store, container, textNode} = mountStructuralInline('a😀b')

			expect(store.selection.rawPositionFromBoundary(textNode, 2)).toEqual({ok: false, reason: 'invalidBoundary'})
			container.remove()
		})

		it('maps token shell boundaries by affinity', () => {
			const {store, container, textSurface} = mountStructuralInline('hello')

			expect(store.selection.rawPositionFromBoundary(textSurface, 0, 'before')).toEqual({ok: true, value: 0})
			expect(store.selection.rawPositionFromBoundary(textSurface, 1, 'after')).toEqual({ok: true, value: 5})
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

			expect(store.selection.rawPositionFromBoundary(descendantText, 0, 'after')).toEqual({
				ok: false,
				reason: 'invalidBoundary',
			})
			container.remove()
		})

		it('returns mixedBoundary for selections crossing controls', () => {
			const {store, container, textNode, controlText} = mountStructuralBlockWithControl('hello')
			const selection = window.getSelection()!
			const range = document.createRange()
			range.setStart(textNode, 0)
			range.setEnd(controlText, 1)
			selection.removeAllRanges()
			selection.addRange(range)

			expect(store.selection.readRaw()).toEqual({ok: false, reason: 'mixedBoundary'})
			container.remove()
		})
	})
})