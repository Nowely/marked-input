import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'
import {TokenHandle} from './model/LiveNode'
import {createTextToken} from './parser/utils/createTextToken'

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

describe('TokenModel lookups', () => {
	it('exposes the changed event', () => {
		const store = new Store()
		expect(typeof store.tokens.changed).toBe('function')
	})

	it('fires changed after rendered()', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hi'})
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.append(span)
		document.body.append(container)
		store.host.container(container)

		const onChanged = vi.fn()
		watch(store.tokens.changed, onChanged)

		store.host.rendered()

		expect(onChanged).toHaveBeenCalledTimes(1)
		container.remove()
	})

	it('handleAt(node) returns the live handle for the owning token', () => {
		const {store, container, span} = mountInline('hello')

		const handle = store.tokens.handleAt(span)
		expect(handle).toBeInstanceOf(TokenHandle)
		if (!(handle instanceof TokenHandle)) throw new Error('expected token handle')
		expect(handle.element()).toBe(span)
		expect(handle.hasTextSurface()).toBe(true)
		container.remove()
	})

	it('handleAt(node) returns undefined when node is outside container', () => {
		const {store, container} = mountInline('hello')
		const stray = document.createElement('div')

		expect(store.tokens.handleAt(stray)).toBeUndefined()
		container.remove()
	})

	it('handleAt(node) on a registered control returns control', () => {
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

		expect(store.tokens.handleAt(control)).toBe('control')
		container.remove()
	})

	it('handleFor(address) returns the handle bound at that path', () => {
		const {store, container, span} = mountInline('hello')
		const address = {path: [0], token: store.tokens.tree()[0]}

		expect(store.tokens.handleFor(address)?.element()).toBe(span)
		container.remove()
	})

	it('handles() iterates all bound tokens as live handles', () => {
		const {store, container, span} = mountInline('hello')

		const all = [...store.tokens.handles()]
		expect(all).toHaveLength(1)
		expect(all[0].address().path).toEqual([0])
		expect(all[0].element()).toBe(span)
		container.remove()
	})

	it('handleAt and handleFor return undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const span = document.createElement('span')
		// intentionally NOT attaching span to a container nor setting store.host.container()

		expect(store.tokens.handleAt(span)).toBeUndefined()
		expect(store.tokens.handleFor({path: [0], token: createTextToken('hello')})).toBeUndefined()
	})

	it('setting selection range before any commit has run does not throw', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		// intentionally NOT setting store.host.container() — no commit has run

		expect(() => store.selection.range({start: 0, end: 0})).not.toThrow()
	})
})