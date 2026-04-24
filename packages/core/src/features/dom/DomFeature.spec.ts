import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

function mountRegisteredInline(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	store.value.enable()
	const container = document.createElement('div')
	const shell = document.createElement('span')
	const textSurface = document.createElement('span')
	container.append(shell)
	shell.append(textSurface)
	document.body.append(container)
	store.dom.refFor({role: 'container'})(container)
	store.dom.refFor({role: 'token', path: [0]})(shell)
	store.dom.refFor({role: 'text', path: [0]})(textSurface)
	store.dom.enable()
	store.lifecycle.rendered({container, layout: 'inline'})
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Registered text surface did not render a text node')
	return {store, container, shell, textSurface, textNode}
}

describe('DomFeature registration', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
		store.value.enable()
		store.value.replaceAll('hello @[world]')
	})

	it('returns stable ref callbacks for the same target', () => {
		const first = store.dom.refFor({role: 'text', path: [0]})
		const second = store.dom.refFor({role: 'text', path: [0]})
		const third = store.dom.refFor({role: 'text', path: [2]})

		expect(first).toBe(second)
		expect(first).not.toBe(third)
	})

	it('publishes one dom index per rendered commit', () => {
		const container = document.createElement('div')
		const textShell = document.createElement('span')
		const textSurface = document.createElement('span')
		container.append(textShell)
		textShell.append(textSurface)

		store.dom.refFor({role: 'container'})(container)
		store.dom.refFor({role: 'token', path: [0]})(textShell)
		store.dom.refFor({role: 'text', path: [0]})(textSurface)

		store.dom.enable()
		store.lifecycle.rendered({container, layout: 'inline'})

		expect(store.dom.index()).toEqual({generation: 1})
		expect(store.dom.locateNode(textSurface)).toMatchObject({ok: true})
	})

	it('resolves ref paths through the current parse generation during rendered commit', () => {
		const container = document.createElement('div')
		const shell = document.createElement('span')
		container.append(shell)
		store.dom.refFor({role: 'container'})(container)
		store.dom.refFor({role: 'token', path: [0]})(shell)
		store.dom.enable()

		const oldGeneration = store.parsing.index().generation
		store.value.replaceAll('changed')
		store.lifecycle.rendered({container, layout: 'inline'})

		const result = store.dom.locateNode(shell)
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.value.address.parseGeneration).not.toBe(oldGeneration)
	})

	it('returns control for registered controls', () => {
		const container = document.createElement('div')
		const control = document.createElement('button')
		container.append(control)
		store.dom.refFor({role: 'container'})(container)
		store.dom.refFor({role: 'control', ownerPath: [1]})(control)
		store.dom.enable()
		store.lifecycle.rendered({container, layout: 'block'})

		expect(store.dom.locateNode(control)).toEqual({ok: false, reason: 'control'})
	})

	it('reconciles registered text surfaces from accepted tokens', () => {
		const container = document.createElement('div')
		const shell = document.createElement('span')
		const textSurface = document.createElement('span')
		textSurface.textContent = 'stale'
		container.append(shell)
		shell.append(textSurface)

		store.dom.refFor({role: 'container'})(container)
		store.dom.refFor({role: 'token', path: [0]})(shell)
		store.dom.refFor({role: 'text', path: [0]})(textSurface)
		store.dom.enable()
		store.lifecycle.rendered({container, layout: 'inline'})

		expect(textSurface.textContent).toBe('hello ')
		expect(textSurface.contentEditable).toBe('true')
	})

	it('returns a fresh structural key identity when structure-driving props change', () => {
		const before = store.dom.structuralKey()

		store.props.set({layout: 'block'})

		expect(store.dom.structuralKey()).not.toBe(before)
	})

	it('places the caret at a raw position inside a registered text surface', () => {
		const {store, container, textSurface} = mountRegisteredInline('hello')

		expect(store.dom.placeCaretAtRawPosition(3, 'after')).toEqual({ok: true, value: undefined})

		const selection = window.getSelection()
		expect(selection?.focusNode).toBe(textSurface.firstChild)
		expect(selection?.focusOffset).toBe(3)
		container.remove()
	})

	it('focuses the element for an address', () => {
		const {store, container, textSurface} = mountRegisteredInline('hello')
		const address = store.parsing.index().addressFor([0])!

		expect(store.dom.focusAddress(address)).toEqual({ok: true, value: undefined})
		expect(document.activeElement).toBe(textSurface)
		container.remove()
	})
})