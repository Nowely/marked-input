import {describe, it, expect, beforeEach, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

function enableStructuralStore(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	store.lifecycle.mounted()
	return store
}

function mountStructuralInline(value: string) {
	const store = enableStructuralStore(value)
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	container.append(textSurface)
	document.body.append(container)
	store.dom.container(container)
	store.lifecycle.rendered()
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
	store.dom.container(container)
	store.lifecycle.rendered()
	return {store, container, before, mark, after}
}

function mountStructuralNested(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	outer.append(before, inner, after)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.lifecycle.rendered()
	return {store, container, leading, outer, before, inner, after, trailing}
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
	store.dom.container(container)
	store.dom.childrenFor([1])(host)
	store.lifecycle.rendered()
	return {store, container, leading, outer, control, host, before, inner, after, trailing}
}

function mountStructuralNestedWithDuplicateChildSequences(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const hostA = document.createElement('span')
	const hostB = document.createElement('span')
	const trailing = document.createElement('span')
	outer.append(hostA, hostB)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.dom.childrenFor([1])(hostA)
	store.dom.childrenFor([1])(hostB)
	return {store, container, outer, hostA, hostB}
}

function mountStructuralNestedWithOutsideChildSequence(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const outsideHost = document.createElement('span')
	const trailing = document.createElement('span')
	leading.append(outsideHost)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.dom.childrenFor([1])(outsideHost)
	return {store, container, outer, outsideHost}
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
	store.dom.container(container)
	store.dom.controlFor([0])(control)
	store.lifecycle.rendered()
	const textNode = textSurface.firstChild
	const controlText = control.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	if (!(controlText instanceof Text)) throw new Error('Structural control did not render a text node')
	return {store, container, row, control, controlText, textSurface, textNode}
}

function mountStructuralBlockWithControls(value: string) {
	const store = enableStructuralStore(value, {layout: 'block'})
	const container = document.createElement('div')
	const row = document.createElement('div')
	const beforeControl = document.createElement('button')
	const afterControl = document.createElement('button')
	const textSurface = document.createElement('span')
	beforeControl.textContent = 'before'
	afterControl.textContent = 'after'
	row.append(beforeControl, textSurface, afterControl)
	container.append(row)
	document.body.append(container)
	store.dom.container(container)
	store.dom.controlFor([0])(beforeControl)
	store.dom.controlFor([0])(afterControl)
	store.lifecycle.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	return {store, container, row, beforeControl, afterControl, textSurface, textNode}
}

describe('DomController structural indexing', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
		store.value.current('hello @[world]')
	})

	it('owns the container ref signal', () => {
		const container = document.createElement('div')

		store.dom.container(container)

		expect(store.dom.container()).toBe(container)

		store.dom.container(null)

		expect(store.dom.container()).toBe(null)
	})

	it('publishes one dom index per rendered commit', () => {
		const {store, textSurface, container} = mountStructuralInline('hello')

		expect(store.dom.index()).toEqual({generation: 1})
		expect(store.dom.locateNode(textSurface)).toMatchObject({ok: true})
		container.remove()
	})

	it('maps inline token roots by rendered token order', () => {
		const {store, before, mark, after, container} = mountStructuralInlineMark()

		expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
		expect(store.dom.locateNode(mark)).toMatchObject({ok: true, value: {tokenElement: mark}})
		expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
		container.remove()
	})

	it('treats text token roots as editable text surfaces', () => {
		const {store, textSurface, container} = mountStructuralInline('hello')

		expect(store.dom.locateNode(textSurface)).toMatchObject({
			ok: true,
			value: {tokenElement: textSurface, textElement: textSurface},
		})
		expect(textSurface.textContent).toBe('hello')
		expect(textSurface.contentEditable).toBe('true')
		container.remove()
	})

	it('maps nested children without slot-root wrappers', () => {
		const {store, outer, before, inner, after, container} = mountStructuralNested()

		expect(store.dom.locateNode(outer)).toMatchObject({ok: true, value: {tokenElement: outer}})
		expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
		expect(store.dom.locateNode(inner)).toMatchObject({ok: true, value: {tokenElement: inner}})
		expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
		container.remove()
	})

	it('indexes nested children from a registered child sequence host', () => {
		const {store, container, outer, control, host, before, inner, after} = mountStructuralNestedWithChildSequence()

		expect(store.dom.locateNode(outer)).toMatchObject({ok: true, value: {tokenElement: outer}})
		expect(store.dom.locateNode(host)).toMatchObject({ok: true, value: {tokenElement: outer}})
		expect(store.dom.locateNode(control)).toMatchObject({ok: true, value: {tokenElement: outer}})
		expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
		expect(store.dom.locateNode(inner)).toMatchObject({ok: true, value: {tokenElement: inner}})
		expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
		expect(before.textContent).toBe('before ')
		expect(after.textContent).toBe(' after')
		container.remove()
	})

	it('maps registered child sequence host boundaries to nested child positions', () => {
		const {store, container, host} = mountStructuralNestedWithChildSequence()
		const tokenIndex = store.parsing.index()
		const beforeToken = tokenIndex.resolve([1, 0])
		const innerToken = tokenIndex.resolve([1, 1])
		const afterToken = tokenIndex.resolve([1, 2])

		expect(beforeToken?.position.end).toBe(9)
		expect(innerToken?.position.start).toBe(9)
		expect(innerToken?.position.end).toBe(18)
		expect(afterToken?.position.start).toBe(18)
		expect(store.dom.rawPositionFromBoundary(host, 1, 'before')).toEqual({
			ok: true,
			value: beforeToken?.position.end,
		})
		expect(store.dom.rawPositionFromBoundary(host, 1, 'after')).toEqual({
			ok: true,
			value: innerToken?.position.start,
		})
		expect(store.dom.rawPositionFromBoundary(host, 2, 'before')).toEqual({
			ok: true,
			value: innerToken?.position.end,
		})
		expect(store.dom.rawPositionFromBoundary(host, 2, 'after')).toEqual({
			ok: true,
			value: afterToken?.position.start,
		})
		container.remove()
	})

	it('emits diagnostics for duplicate child sequence hosts', () => {
		const diagnostics: unknown[] = []
		const {store, container} = mountStructuralNestedWithDuplicateChildSequences()
		const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))

		store.lifecycle.rendered()

		expect(diagnostics).toContainEqual({
			kind: 'ambiguousStructure',
			path: [1],
			reason: 'expected exactly 1 child sequence host for owner path 1 but found 2',
		})
		stop()
		container.remove()
	})

	it('emits diagnostics when child sequence host is outside owner mark root', () => {
		const diagnostics: unknown[] = []
		const {store, container} = mountStructuralNestedWithOutsideChildSequence()
		const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))

		store.lifecycle.rendered()

		expect(diagnostics).toContainEqual({
			kind: 'ambiguousStructure',
			path: [1],
			reason: 'child sequence host for owner path 1 is not contained by owner token element',
		})
		stop()
		container.remove()
	})

	it('returns control for registered controls', () => {
		const {store, control, container} = mountStructuralBlockWithControl('hello')

		expect(store.dom.locateNode(control)).toEqual({ok: false, reason: 'control'})
		container.remove()
	})

	it('excludes multiple controls owned by the same token path from block token indexing', () => {
		const {store, beforeControl, afterControl, textSurface, container} = mountStructuralBlockWithControls('hello')

		expect(store.dom.locateNode(beforeControl)).toEqual({ok: false, reason: 'control'})
		expect(store.dom.locateNode(afterControl)).toEqual({ok: false, reason: 'control'})
		expect(store.dom.locateNode(textSurface)).toMatchObject({
			ok: true,
			value: {tokenElement: textSurface, textElement: textSurface},
		})
		container.remove()
	})

	it('emits diagnostics when a nested mark omits child roots', () => {
		const diagnostics: unknown[] = []
		const store = enableStructuralStore('@[before @[nested] after]', {
			Mark: () => null,
			options: [{markup: '@[__slot__]'}],
		})
		const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))
		const container = document.createElement('div')
		const leading = document.createElement('span')
		const outer = document.createElement('mark')
		const trailing = document.createElement('span')
		container.append(leading, outer, trailing)
		document.body.append(container)
		store.dom.container(container)
		store.lifecycle.rendered()

		expect(diagnostics).toContainEqual({
			kind: 'ambiguousStructure',
			path: [1],
			reason: 'expected 3 child token elements but found 0',
		})
		expect(store.dom.locateNode(outer)).toMatchObject({ok: true})
		stop()
		container.remove()
	})

	it('places the caret at a raw position inside a structural text surface', () => {
		const {store, container, textSurface} = mountStructuralInline('hello')

		expect(store.dom.placeCaretAtRawPosition(3, 'after')).toEqual({ok: true, value: undefined})

		const selection = window.getSelection()
		expect(selection?.focusNode).toBe(textSurface.firstChild)
		expect(selection?.focusOffset).toBe(3)
		container.remove()
	})

	it('focuses the element for an address', () => {
		const {store, container, textSurface} = mountStructuralInline('hello')
		const address = store.parsing.index().addressFor([0])!

		expect(store.dom.focusAddress(address)).toEqual({ok: true, value: undefined})
		expect(document.activeElement).toBe(textSurface)
		container.remove()
	})

	it('clamps OOB caret range and places at maxPos', () => {
		const {store, container} = mountStructuralInline('hello')

		store.caret.range({start: 999, end: 999})
		store.lifecycle.rendered()

		expect(store.caret.range()).toEqual({start: 5, end: 5})
		container.remove()
	})

	it('clamps OOB selection range', () => {
		const {store, container} = mountStructuralInline('hello')

		store.caret.range({start: 999, end: 1000})
		store.lifecycle.rendered()

		expect(store.caret.range()).toEqual({start: 5, end: 5})
		container.remove()
	})

	it('applies caret.range to DOM after render', () => {
		const {store, container, textNode} = mountStructuralInline('hello')

		store.caret.range({start: 3, end: 3})
		store.lifecycle.rendered()

		const sel = window.getSelection()
		expect(sel?.focusNode).toBe(textNode)
		expect(sel?.focusOffset).toBe(3)
		container.remove()
	})

	it('clamps OOB range and places caret at clamped position', () => {
		const {store, container} = mountStructuralInline('hello') // length 5
		store.caret.range({start: 999, end: 999})
		store.lifecycle.rendered()

		// clamped to maxPos (5); structural equality prevents re-fire
		expect(store.caret.range()).toEqual({start: 5, end: 5})
		container.remove()
	})

	it('skips apply when drag-selecting', () => {
		const {store, container} = mountStructuralInline('hello')
		store.caret.range({start: 2, end: 2})
		store.caret.selecting('drag')
		store.lifecycle.rendered()

		expect(store.caret.range()).toEqual({start: 2, end: 2})
		container.remove()
	})

	describe('raw boundary mapping', () => {
		it('maps text-surface boundaries to raw UTF-16 positions', () => {
			const {store, container, textNode} = mountStructuralInline('hello')

			expect(store.dom.rawPositionFromBoundary(textNode, 2)).toEqual({ok: true, value: 2})
			container.remove()
		})

		it('rejects boundaries that split surrogate pairs', () => {
			const {store, container, textNode} = mountStructuralInline('a😀b')

			expect(store.dom.rawPositionFromBoundary(textNode, 2)).toEqual({ok: false, reason: 'invalidBoundary'})
			container.remove()
		})

		it('maps token shell boundaries by affinity', () => {
			const {store, container, textSurface} = mountStructuralInline('hello')

			expect(store.dom.rawPositionFromBoundary(textSurface, 0, 'before')).toEqual({ok: true, value: 0})
			expect(store.dom.rawPositionFromBoundary(textSurface, 1, 'after')).toEqual({ok: true, value: 5})
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
			store.lifecycle.rendered()

			expect(store.dom.rawPositionFromBoundary(descendantText, 0, 'after')).toEqual({
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

			expect(store.dom.readRawSelection()).toEqual({ok: false, reason: 'mixedBoundary'})
			container.remove()
		})
	})

	describe('indexed event and reconcile opts', () => {
		it('indexed event fires after commitRendered', () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hi'})
			store.lifecycle.mounted()
			store.dom.container(container)

			const fired = vi.fn()
			watch(store.dom.indexed, fired)
			store.lifecycle.rendered()
			expect(fired).toHaveBeenCalledTimes(1)
			container.remove()
		})

		it('reconcile respects selecting flag', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			container.appendChild(span)
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hello'})
			store.lifecycle.mounted()
			store.dom.container(container)
			store.lifecycle.rendered()

			store.dom.reconcile({selecting: true})
			expect(span.contentEditable).toBe('false')

			store.dom.reconcile({selecting: false})
			expect(span.contentEditable).toBe('true')

			container.remove()
		})

		it('readOnly computed reflects props', () => {
			const store = new Store()
			expect(store.dom.readOnly()).toBe(false)
			store.props.set({readOnly: true})
			expect(store.dom.readOnly()).toBe(true)
		})
	})
})