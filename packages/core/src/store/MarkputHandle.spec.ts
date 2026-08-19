import {describe, expect, it} from 'vitest'

import {consignRendered} from '../features/tokens/__testing__/mountFixtures'
import type {Markup} from '../features/tokens/parser/types'
import {Store} from './Store'

const MARKUP: Markup = '@[__value__](__meta__)'

/**
 * Mounted fixture: one span per top-level token (marks render childless), consigned the way an
 * adapter's refs would. `focus()` resolves through the live node layer, so it needs a seeded
 * store; mounting is how production gets one, and it keeps the selection watches wired.
 */
function setup(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup: MARKUP}]})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	container.replaceChildren(...store.tokens.nodes().map(() => document.createElement('span')))
	consignRendered(store, container)
	return {store, api: store.api}
}

describe('MarkputHandle', () => {
	it('exposes the container', () => {
		const {store, api} = setup('hello')
		expect(api.container).toBe(store.host.container())
		expect(api.container).toBeInstanceOf(HTMLElement)
	})

	it('focus() puts the caret at the start of the first token', () => {
		const {store, api} = setup('hello')

		api.focus()

		const range = document.getSelection()?.getRangeAt(0)
		expect(range?.collapsed).toBe(true)
		expect(api.container?.contains(range?.startContainer ?? null)).toBe(true)

		// The stored anchors, not the DOM's: `focus()` goes through the selection driver, so the
		// model must agree that the caret sits at offset 0 of the FIRST token. A TEXT anchor
		// specifically — a boundary form would mean it landed beside the token. Read off the
		// token layer, which owns them; the handle stopped answering selection questions.
		const selection = store.tokens.selection.anchors()
		if (!selection) throw new Error('expected a stored selection')
		const {anchor} = selection
		if (typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
		expect(anchor.offset).toBe(0)
		expect(anchor.node.id).toBe(store.tokens.nodes()[0].id)
		expect(selection.head).toEqual(anchor)
	})
})