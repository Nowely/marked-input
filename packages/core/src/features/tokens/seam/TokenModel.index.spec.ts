import {describe, it, expect, vi} from 'vitest'

import {effect, watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {caretAt, consignRendered} from '../__testing__/mountFixtures'
import {treeShape} from '../__testing__/tokenFactories'
import {TokenHandle} from '../dom/TokenHandle'

function mountInline(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const span = document.createElement('span')
	container.append(span)
	document.body.append(container)
	store.host.container(container)
	consignRendered(store, container)
	return {store, container, span}
}

describe('TokenModel lookups', () => {
	it('fires bound on a consignment, with no commit behind it', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hi'})
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.append(span)
		document.body.append(container)
		store.host.container(container)

		// A ref IS the bind now, so the clock this subject means is the DOM one. The commit clock
		// already pulsed when the container seeded the tree, before this watch existed — and a
		// registration is not a commit, so it stays silent here.
		const onBound = vi.fn()
		const onCommitted = vi.fn()
		watch(store.tokens.bound, onBound)
		watch(store.tokens.committed, onCommitted)

		store.tokens.consign(store.tokens.nodes()[0].id)(span)

		expect(onBound).toHaveBeenCalledTimes(1)
		expect(onCommitted).toHaveBeenCalledTimes(0)
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
		store.tokens.control()(control)

		expect(store.tokens.handleAt(control)).toBe('control')
		container.remove()
	})

	it('handle(id) returns the handle for that token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.nodes()[0].id!

		expect(store.tokens.handle(id)?.element()).toBe(span)
		container.remove()
	})

	it('handle(id) returns the bound handle for a token id', () => {
		const {store, container, span} = mountInline('hello')

		const id = store.tokens.nodes()[0].id!
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

		expect(() => caretAt(store, 0)).not.toThrow()
	})
})

describe('TokenModel.nodes() — the fresh reconciled read', () => {
	it('current() returns the reconciled tree, consistent with value.current()', () => {
		const {store, container} = mountInline('hello')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
		])
		container.remove()
	})

	it('current() stays fresh across a text-path edit — content tracks value.current()', () => {
		const {store, container} = mountInline('hello')
		store.tokens.replaceBetween(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '!')
		// text-path commit: the renderer is not woken, but the live tree is the
		// reconciled latest — fresh content, consistent with the new value.
		expect(store.tokens.value()).toBe('hello!')
		expect(treeShape(store.tokens.nodes())[0]).toMatchObject({
			kind: 'text',
			content: 'hello!',
			position: {start: 0, end: 6},
		})
		container.remove()
	})

	it('nodes() is [] before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(treeShape(store.tokens.nodes())).toEqual([])
	})

	it('nodes() is reactive — an effect re-runs on a structural change', () => {
		// Measured: without this, wrapping `nodes()` in `untracked` survives the entire suite. It
		// moved down here from the public handle's spec when the handle stopped answering reads;
		// both adapters render straight off this one, so its reactive half has to stay gated.
		const store = new Store()
		store.props.set({defaultValue: 'hello', Mark: () => null, options: [{markup: '@[__value__](__meta__)'}]})
		const container = document.createElement('div')
		container.append(document.createElement('span'))
		document.body.append(container)
		store.host.container(container)
		consignRendered(store, container)

		let runs = 0
		const stop = effect(() => {
			store.tokens.nodes()
			runs++
		})
		expect(runs).toBe(1)
		expect(store.tokens.setValue('a@[x](m)b')).toBe(true)
		expect(runs).toBe(2)

		stop()
		container.remove()
	})
})

describe('TokenModel.handle(id) — the id-keyed fail-closed lookup', () => {
	it('handle(id) returns the live handle for a reconciled token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.nodes()[0].id
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