import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'
import {TokenHandle} from './model/TokenHandle'

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

	it('handle(id) returns the handle for that token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.current()[0].id!

		expect(store.tokens.handle(id)?.element()).toBe(span)
		container.remove()
	})

	it('handle(id) returns the bound handle for a token id', () => {
		const {store, container, span} = mountInline('hello')

		const id = store.tokens.current()[0].id!
		const handle = store.tokens.handle(id)
		expect(handle?.element()).toBe(span)
		container.remove()
	})

	it('handleAt returns undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const span = document.createElement('span')

		expect(store.tokens.handleAt(span)).toBeUndefined()
	})

	it('setting the selection before any commit has run does not throw', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		// intentionally NOT setting store.host.container() — no commit has run

		expect(() => store.selection.position(0)).not.toThrow()
	})
})

describe('TokenModel.current() — the fresh reconciled read', () => {
	it('current() returns the reconciled tree, consistent with value.current()', () => {
		const {store, container} = mountInline('hello')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		container.remove()
	})

	it('current() stays fresh across a text-path edit — content tracks value.current()', () => {
		const {store, container} = mountInline('hello')
		store.value.replace({start: 5, end: 5}, '!')
		// text-path commit: renderTree keeps its reference, but current() is the
		// reconciled latest — fresh content, consistent with the new value.
		expect(store.value.current()).toBe('hello!')
		expect(store.tokens.current()[0]).toMatchObject({type: 'text', content: 'hello!', position: {start: 0, end: 6}})
		container.remove()
	})

	it('current() is [] before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(store.tokens.current()).toEqual([])
	})
})

describe('TokenModel.handle(id) — the id-keyed fail-closed lookup', () => {
	it('handle(id) returns the live handle for a reconciled token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.current()[0].id
		expect(id).toBeTypeOf('number')
		const handle = store.tokens.handle(id!)
		expect(handle).toBeInstanceOf(TokenHandle)
		expect(handle?.element()).toBe(span)
		container.remove()
	})

	it('handle(id) returns undefined for an id with no live node', () => {
		const {store, container} = mountInline('hello')
		expect(store.tokens.handle(999999)).toBeUndefined()
		container.remove()
	})

	it('handle(id) returns undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(store.tokens.handle(0)).toBeUndefined()
	})
})