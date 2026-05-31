import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'

function mountInline(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const span = document.createElement('span')
	container.append(span)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, span}
}

describe('TokenModel index', () => {
	it('exposes indexed event', () => {
		const store = new Store()
		expect(typeof store.tokens.indexed).toBe('function')
	})

	it('fires indexed after rendered()', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hi'})
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.append(span)
		document.body.append(container)
		store.host.container(container)

		const onIndexed = vi.fn()
		watch(store.tokens.indexed, onIndexed)

		store.host.rendered()

		expect(onIndexed).toHaveBeenCalledTimes(1)
		container.remove()
	})

	it('locate(node) returns a token lookup with the matching TokenNode', () => {
		const {store, container, span} = mountInline('hello')

		const lookup = store.tokens.locate(span)
		expect(lookup?.kind).toBe('token')
		if (lookup?.kind !== 'token') throw new Error('expected token lookup')
		expect(lookup.node.tokenElement).toBe(span)
		expect(lookup.node.textElement).toBe(span)
		expect(lookup.element).toBe(span)
		container.remove()
	})

	it('locate(node) returns undefined when node is outside container', () => {
		const {store, container} = mountInline('hello')
		const stray = document.createElement('div')

		expect(store.tokens.locate(stray)).toBeUndefined()
		container.remove()
	})

	it('locate(node) on a registered control returns kind=control', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello', layout: 'block'})
		const container = document.createElement('div')
		const row = document.createElement('div')
		const control = document.createElement('button')
		const tokenEl = document.createElement('span')
		row.append(control, tokenEl)
		container.append(row)
		document.body.append(container)
		store.host.container(container)
		store.tokens.control([0])(control)
		store.host.rendered()

		expect(store.tokens.locate(control)?.kind).toBe('control')
		container.remove()
	})

	it('nodeFor(address) returns the node registered for that address', () => {
		const {store, container, span} = mountInline('hello')
		const address = store.tokens.index().addressFor([0])!

		expect(store.tokens.nodeFor(address)?.tokenElement).toBe(span)
		container.remove()
	})

	it('nodes() iterates all indexed TokenNodes', () => {
		const {store, container} = mountInline('hello')

		const all = Array.from(store.tokens.nodes())
		expect(all).toHaveLength(1)
		container.remove()
	})

	it('locate and nodeFor return undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const span = document.createElement('span')
		// intentionally NOT attaching span to a container nor setting store.host.container()

		expect(store.tokens.locate(span)).toBeUndefined()
		const address = store.tokens.index().addressFor([0])!
		expect(store.tokens.nodeFor(address)).toBeUndefined()
	})

	it('setting selection range before any commit has run does not throw', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		// intentionally NOT setting store.host.container() — no commit has run

		expect(() => store.selection.range({start: 0, end: 0})).not.toThrow()
	})
})