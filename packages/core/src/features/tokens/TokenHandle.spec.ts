import {afterEach, describe, expect, it, vi} from 'vitest'

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

/**
 * Block layout: two rows with mark tokens using the block controller pattern
 * (Mark + markup '__slot__\n\n').
 */
function mountBlock(value: string) {
	const store = new Store()
	store.props.set({
		defaultValue: value,
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)

	// Build DOM rows: one div+span per mark token
	const rows = value.split('\n\n').filter(r => r.length > 0)
	for (const row of rows) {
		const rowEl = document.createElement('div')
		const tokenEl = document.createElement('span')
		tokenEl.textContent = row
		rowEl.append(tokenEl)
		container.append(rowEl)
	}

	store.host.rendered()
	return {store, container}
}

describe('TokenHandle', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('handleAt resolves a token element to a live handle', () => {
		const {store, span} = mountInline('hello')

		const handle = store.tokens.handleAt(span)
		expect(handle).not.toBe('control')
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.element()).toBe(span)
		expect(handle.text()).toBe('hello')
		expect(handle.token().type).toBe('text')
		expect(handle.dead()).toBe(false)
	})

	it('returns the same handle for the same path across commits', () => {
		const {store, span} = mountInline('hello')

		const first = store.tokens.handleAt(span)
		store.host.rendered()
		const second = store.tokens.handleAt(span)
		expect(second).toBe(first)
	})

	it('handles() lazily materializes one handle per indexed token, handleFor returns same object', () => {
		const {store} = mountInline('hello')

		// Call handles() BEFORE any handleFor/handleAt — must still yield one handle
		const allBefore = [...store.tokens.handles()]
		expect(allBefore).toHaveLength(1)

		// handleFor must return the SAME handle object already yielded by handles()
		const address = store.tokens.index().addressFor([0])
		if (!address) throw new Error('expected address')
		const handle = store.tokens.handleFor(address)
		expect(handle?.address().path).toEqual([0])
		expect(handle).toBe(allBefore[0])
	})

	it('fires text change and refreshes snapshots on value edit', () => {
		const {store, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')

		const onChange = vi.fn()
		watch(handle.changed, onChange)

		store.value.current('hello!')
		span.textContent = 'hello!'
		store.host.rendered()

		expect(onChange).toHaveBeenCalledWith({kind: 'text', previous: 'hello'}, undefined)
		expect(handle.text()).toBe('hello!')
	})

	it('kills handles whose token disappears (dead-handle contract)', () => {
		// Block layout: two text rows "alpha\n\n" and "beta\n\n".
		// We capture the handle for row 2's token, then reduce the value to one
		// row, update the DOM to one row, and rendered(). The handle should die.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')

		// Grab the second row's token element (index path [1])
		const address1 = store.tokens.index().addressFor([1])
		if (!address1) throw new Error('expected address for row 1')
		const handle = store.tokens.handleFor(address1)
		if (!handle) throw new Error('expected handle for row 1')

		const onChange = vi.fn()
		watch(handle.changed, onChange)

		const lastToken = handle.token()

		// Reduce to one row — remove the second row from the DOM
		const secondRow = container.children[1]
		if (!(secondRow instanceof HTMLElement)) throw new Error('expected HTMLElement')
		secondRow.remove()

		// Update the parsed value so the token tree shrinks too
		store.value.current('alpha\n\n')

		store.host.rendered()

		expect(onChange).toHaveBeenCalledWith({kind: 'unmounted'}, undefined)
		expect(handle.dead()).toBe(true)
		expect(handle.element()).toBeUndefined()
		// token() still returns the last snapshot
		expect(handle.token()).toBe(lastToken)
		// placeCaret returns false on a dead handle
		expect(handle.placeCaret(0)).toBe(false)

		// A fresh lookup after re-adding the row returns a DIFFERENT handle
		const rowEl = document.createElement('div')
		const tokenEl = document.createElement('span')
		tokenEl.textContent = 'beta'
		rowEl.append(tokenEl)
		container.append(rowEl)
		store.value.current('alpha\n\nbeta\n\n')
		store.host.rendered()

		const newAddress1 = store.tokens.index().addressFor([1])
		if (!newAddress1) throw new Error('expected fresh address for row 1')
		const newHandle = store.tokens.handleFor(newAddress1)
		expect(newHandle).not.toBe(handle)
	})

	it('handle survives a structural shift that changes its path (id-keyed identity)', () => {
		// Block layout: two rows "alpha\n\n" and "beta\n\n". We capture row 2's
		// handle, then PREPEND a new row via the real edit path (so the reconcile
		// hint marks the shift). Under path-keying the handle at path [1] would be
		// re-bound to a different token (or killed); under id-keying the SAME
		// handle object follows its token to path [2] and reports a move.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')

		const address1 = store.tokens.index().addressFor([1])
		if (!address1) throw new Error('expected address for row 1')
		const handle = store.tokens.handleFor(address1)
		if (!handle) throw new Error('expected handle for row 1')
		expect(handle.text()).toBe('beta\n\n')

		const onChange = vi.fn()
		watch(handle.changed, onChange)

		// Prepend a row through the edit controller (records the edit hint)
		store.edit.replace({start: 0, end: 0}, 'new\n\n')

		// Mirror the render: insert the new row's DOM at the front
		const rowEl = document.createElement('div')
		const tokenEl = document.createElement('span')
		tokenEl.textContent = 'new'
		rowEl.append(tokenEl)
		container.prepend(rowEl)

		store.host.rendered()

		// The same handle object now lives at the shifted path
		expect(handle.dead()).toBe(false)
		expect(handle.address().path).toEqual([2])
		expect(handle.text()).toBe('beta\n\n')

		// It fired a move (and was NOT unmounted, NOT a text change)
		const kinds = onChange.mock.calls.map(([change]) => change.kind)
		expect(kinds).toEqual(['moved'])
		const [moved] = onChange.mock.calls[0]
		expect(moved.previousAddress.path).toEqual([1])

		// Resolving the shifted address returns the SAME handle object
		const shiftedAddress = store.tokens.index().addressFor([2])
		if (!shiftedAddress) throw new Error('expected shifted address')
		expect(store.tokens.handleFor(shiftedAddress)).toBe(handle)
	})

	it('handleAt returns "control" inside control elements and undefined outside', () => {
		const {store, container, span} = mountInline('hello')

		const control = document.createElement('button')
		container.append(control)
		store.tokens.control()(control)
		store.host.rendered()

		expect(store.tokens.handleAt(control)).toBe('control')
		expect(store.tokens.handleAt(document.body)).toBeUndefined()
		expect(store.tokens.handleAt(span)).not.toBeUndefined()
	})
})