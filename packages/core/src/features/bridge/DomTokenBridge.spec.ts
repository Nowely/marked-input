import {describe, it, expect, beforeEach, vi} from 'vitest'

import {watch} from '../../shared/signals'
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
	store.host.container(container)
	store.host.rendered()
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
	store.host.container(container)
	store.bridge.childrenFor([1])(host)
	store.host.rendered()
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
	store.host.container(container)
	store.bridge.childrenFor([1])(hostA)
	store.bridge.childrenFor([1])(hostB)
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
	store.host.container(container)
	store.bridge.childrenFor([1])(outsideHost)
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
	store.host.container(container)
	store.bridge.controlFor([0])(control)
	store.host.rendered()
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
	store.host.container(container)
	store.bridge.controlFor([0])(beforeControl)
	store.bridge.controlFor([0])(afterControl)
	store.host.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	return {store, container, row, beforeControl, afterControl, textSurface, textNode}
}

describe('DomTokenBridge', () => {
	it('exposes setSelecting that toggles structural-text contentEditable', () => {
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
		store.bridge.setSelecting(true)
		expect(span.contentEditable).toBe('false')
		store.bridge.setSelecting(false)
		expect(span.contentEditable).toBe('true')

		container.remove()
	})

	it('exposes compositionStarted/Ended that flip isComposing', () => {
		const store = new Store()
		expect(store.bridge.isComposing()).toBe(false)
		store.bridge.compositionStarted()
		expect(store.bridge.isComposing()).toBe(true)
		store.bridge.compositionEnded()
		expect(store.bridge.isComposing()).toBe(false)
	})

	it('owns controlFor and childrenFor registrations directly', () => {
		const store = new Store()
		const ref = store.bridge.controlFor()
		const childRef = store.bridge.childrenFor([0])
		expect(typeof ref).toBe('function')
		expect(typeof childRef).toBe('function')
	})

	describe('structural indexing', () => {
		let store: Store

		beforeEach(() => {
			vi.clearAllMocks()
			store = new Store()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.value.current('hello @[world]')
		})

		it('publishes one dom index per rendered commit', () => {
			const {store, textSurface, container} = mountStructuralInline('hello')

			expect(store.bridge.isIndexed()).toBe(true)
			expect(store.bridge.locateNode(textSurface)).toBeDefined()
			container.remove()
		})

		it('maps inline token roots by rendered token order', () => {
			const {store, before, mark, after, container} = mountStructuralInlineMark()

			expect(store.bridge.locateNode(before)).toMatchObject({tokenElement: before})
			expect(store.bridge.locateNode(mark)).toMatchObject({tokenElement: mark})
			expect(store.bridge.locateNode(after)).toMatchObject({tokenElement: after})
			container.remove()
		})

		it('treats text token roots as editable text surfaces', () => {
			const {store, textSurface, container} = mountStructuralInline('hello')

			expect(store.bridge.locateNode(textSurface)).toMatchObject({
				tokenElement: textSurface,
				textElement: textSurface,
			})
			expect(textSurface.textContent).toBe('hello')
			expect(textSurface.contentEditable).toBe('true')
			container.remove()
		})

		it('maps nested children without slot-root wrappers', () => {
			const {store, outer, before, inner, after, container} = mountStructuralNested()

			expect(store.bridge.locateNode(outer)).toMatchObject({tokenElement: outer})
			expect(store.bridge.locateNode(before)).toMatchObject({tokenElement: before})
			expect(store.bridge.locateNode(inner)).toMatchObject({tokenElement: inner})
			expect(store.bridge.locateNode(after)).toMatchObject({tokenElement: after})
			container.remove()
		})

		it('indexes nested children from a registered child sequence host', () => {
			const {store, container, outer, control, host, before, inner, after} =
				mountStructuralNestedWithChildSequence()

			expect(store.bridge.locateNode(outer)).toMatchObject({tokenElement: outer})
			expect(store.bridge.locateNode(host)).toMatchObject({tokenElement: outer})
			expect(store.bridge.locateNode(control)).toMatchObject({tokenElement: outer})
			expect(store.bridge.locateNode(before)).toMatchObject({tokenElement: before})
			expect(store.bridge.locateNode(inner)).toMatchObject({tokenElement: inner})
			expect(store.bridge.locateNode(after)).toMatchObject({tokenElement: after})
			expect(before.textContent).toBe('before ')
			expect(after.textContent).toBe(' after')
			container.remove()
		})

		it('completes indexing when duplicate child sequence hosts are registered', () => {
			const {store, container, outer} = mountStructuralNestedWithDuplicateChildSequences()

			store.host.rendered()

			expect(store.bridge.isIndexed()).toBe(true)
			expect(store.bridge.locateNode(outer)).toBeDefined()
			container.remove()
		})

		it('completes indexing when child sequence host is outside owner mark root', () => {
			const {store, container, outer} = mountStructuralNestedWithOutsideChildSequence()

			store.host.rendered()

			expect(store.bridge.isIndexed()).toBe(true)
			expect(store.bridge.locateNode(outer)).toBeDefined()
			container.remove()
		})

		it('reports registered controls without locating them as tokens', () => {
			const {store, control, container} = mountStructuralBlockWithControl('hello')

			expect(store.bridge.locateNode(control)).toBeUndefined()
			expect(store.bridge.isControlAncestor(control)).toBe(true)
			container.remove()
		})

		it('excludes multiple controls owned by the same token path from block token indexing', () => {
			const {store, beforeControl, afterControl, textSurface, container} =
				mountStructuralBlockWithControls('hello')

			expect(store.bridge.locateNode(beforeControl)).toBeUndefined()
			expect(store.bridge.locateNode(afterControl)).toBeUndefined()
			expect(store.bridge.isControlAncestor(beforeControl)).toBe(true)
			expect(store.bridge.isControlAncestor(afterControl)).toBe(true)
			expect(store.bridge.locateNode(textSurface)).toMatchObject({
				tokenElement: textSurface,
				textElement: textSurface,
			})
			expect(store.bridge.isControlAncestor(textSurface)).toBe(false)
			container.remove()
		})

		it('completes indexing when a nested mark renders no child elements', () => {
			const store = enableStructuralStore('@[before @[nested] after]', {
				Mark: () => null,
				options: [{markup: '@[__slot__]'}],
			})
			const container = document.createElement('div')
			const leading = document.createElement('span')
			const outer = document.createElement('mark')
			const trailing = document.createElement('span')
			container.append(leading, outer, trailing)
			document.body.append(container)
			store.host.container(container)
			store.host.rendered()

			expect(store.bridge.isIndexed()).toBe(true)
			expect(store.bridge.locateNode(outer)).toBeDefined()
			container.remove()
		})
	})

	describe('indexed event and reconcile opts', () => {
		it('indexed event fires after commitRendered', () => {
			const store = new Store()
			const container = document.createElement('div')
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hi'})
			store.host.container(container)

			const fired = vi.fn()
			watch(store.bridge.indexed, fired)
			store.host.rendered()
			expect(fired).toHaveBeenCalledTimes(1)
			container.remove()
		})

		it('reconcile respects isUserSelecting signal', () => {
			const store = new Store()
			const container = document.createElement('div')
			const span = document.createElement('span')
			container.appendChild(span)
			document.body.appendChild(container)
			store.props.set({defaultValue: 'hello'})
			store.host.container(container)
			store.host.rendered()

			store.selection.isUserSelecting(true)
			expect(span.contentEditable).toBe('false')

			store.selection.isUserSelecting(false)
			expect(span.contentEditable).toBe('true')

			container.remove()
		})
	})
})