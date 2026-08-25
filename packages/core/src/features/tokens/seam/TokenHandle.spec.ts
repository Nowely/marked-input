import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../../store/Store'
import {anchorsAt, consignRendered} from '../__testing__/mountFixtures'
import {joinNodes} from '../tree/tree'

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

/**
 * Block layout (issue 08's row world): paragraph rows, no markup. Each RowNode's
 * wrapper div is the row's own token element (the Block wrapper's role); each row
 * text child gets a surface span the text effect writes into.
 */
function mountBlock(value: string) {
	const store = new Store()
	store.props.set({
		defaultValue: value,
		layout: 'block',
		options: [],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)

	for (const node of store.tokens.nodes()) {
		void node
		container.append(buildRow())
	}

	consignRows(store, container)
	return {store, container}
}

/** One block row as the adapters render it: the Block's wrapper around the row's surface. */
function buildRow(): HTMLElement {
	const rowEl = document.createElement('div')
	rowEl.append(document.createElement('span'))
	return rowEl
}

/**
 * Consign a block document: each row's wrapper as the ROW's own element and, inside it,
 * a surface per row text child. Explicit rather than {@link consignRendered} because that
 * pairs the container's children with the roots directly and cannot descend into rows.
 */
function consignRows(store: Store, container: HTMLElement): void {
	store.tokens.nodes().forEach((node, index) => {
		const rowEl = container.children[index]
		if (!(rowEl instanceof HTMLElement)) throw new Error(`no row element for root ${index}`)
		const surface = rowEl.firstElementChild
		if (!(surface instanceof HTMLElement)) throw new Error(`no surface element in row ${index}`)
		store.tokens.consign(node.id)(rowEl)
		const child = node.kind === 'row' ? node.children()[0] : undefined
		if (child?.kind === 'text') store.tokens.consign(child.id)(surface)
	})
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
		expect(handle.node()?.textElement).toBe(span)
		expect(span.textContent).toBe('hello')
		expect(handle.alive()).toBe(true)
	})

	it('returns the same handle for the same path across commits', () => {
		const {store, span} = mountInline('hello')

		const first = store.tokens.handleAt(span)
		const second = store.tokens.handleAt(span)
		expect(second).toBe(first)
	})

	it('handle(id) returns the bound handle for a token id', () => {
		const {store} = mountInline('hello')

		const id = store.tokens.nodes()[0].id!
		const handle = store.tokens.handle(id)
		expect(handle).toBeDefined()
	})

	it('follows its node on a value edit, with no re-render', () => {
		// The per-surface effect is the writer: the spec does not paint the new text,
		// the model does.
		const {store, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')

		store.tokens.setValue('hello!')

		expect(handle.alive()).toBe(true)
		expect(span.textContent).toBe('hello!')
	})

	it('kills handles whose token disappears (dead-handle contract)', () => {
		// Block layout: two text rows "alpha\n\n" and "beta\n\n".
		// We capture the handle for row 2's token, then reduce the value to one
		// row, update the DOM to one row, and re-bind. The handle should die.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')

		// Grab the second row's handle (path [1])
		const handle = store.tokens.handle(store.tokens.nodes()[1].id!)
		if (!handle) throw new Error('expected handle for row 1')

		const element = handle.element()

		// Reduce to one row — remove the second row from the DOM
		const secondRow = container.children[1]
		if (!(secondRow instanceof HTMLElement)) throw new Error('expected HTMLElement')
		secondRow.remove()

		// Update the parsed value so the token tree shrinks too
		store.tokens.setValue('alpha\n\n')

		expect(handle.alive()).toBe(false)
		expect(handle.element()).toBeUndefined()
		// The element it held is untouched — kill clears the binding, it does not repaint.
		expect(element?.textContent).toBe('beta')

		// placeCaret returns false on a dead handle
		expect(handle.placeCaret(0)).toBe(false)

		// A fresh lookup after re-adding the row returns a DIFFERENT handle
		container.append(buildRow())
		store.tokens.setValue('alpha\n\nbeta\n\n')
		consignRows(store, container)

		const newHandle = store.tokens.handle(store.tokens.nodes()[1].id!)
		expect(newHandle).toBeDefined()
		expect(newHandle).not.toBe(handle)
	})

	it('handle survives a structural shift that changes its path (id-keyed identity)', () => {
		// Block layout: two rows "alpha\n\n" and "beta\n\n". We capture row 2's
		// handle, then PREPEND a new row via the real edit path (so the reconcile
		// hint marks the shift). Under path-keying the handle at path [1] would be
		// re-bound to a different token (or killed); under id-keying the SAME
		// handle object follows its token to path [2] and reports a move.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')

		const handle = store.tokens.handle(store.tokens.nodes()[1].id!)
		if (!handle) throw new Error('expected handle for row 1')
		expect(handle.element()?.textContent).toBe('beta')

		// Prepend a row through the edit controller (records the edit hint)
		store.edit.replace(...anchorsAt(store, 0, 0), 'new\n\n')

		// Mirror the render: insert the new row's DOM at the front and consign it
		container.prepend(buildRow())
		consignRows(store, container)

		// The same handle object now lives at the shifted path
		expect(handle.alive()).toBe(true)
		// A row's own projection is its content alone: the separator between rows comes from
		// the JOIN, so a one-row list carries none.
		expect(joinNodes([store.tokens.nodes()[2]])).toBe('beta')

		// Resolving the shifted id returns the SAME handle object
		expect(store.tokens.handle(store.tokens.nodes()[2].id!)).toBe(handle)
	})

	it('handleAt returns "control" inside control elements and undefined outside', () => {
		const {store, container, span} = mountInline('hello')

		const control = document.createElement('button')
		container.append(control)
		store.tokens.control()(control)

		expect(store.tokens.handleAt(control)).toBe('control')
		expect(store.tokens.handleAt(document.body)).toBeUndefined()
		expect(store.tokens.handleAt(span)).not.toBeUndefined()
	})
})