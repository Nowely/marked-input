import {describe, expect, it} from 'vitest'

import type {TokenDelta} from '../features/tokens/model/commitInput'
import type {Markup} from '../features/tokens/parser/types'
import type {TextNode} from '../features/tokens/tree/types'
import {watch} from '../shared/signals'
import type {MarkputApi} from './MarkputApi'
import {Store} from './Store'

const MARKUP: Markup = '@[__value__](__meta__)'
const SLOT_MARKUP: Markup = '#[__value__]{__slot__}'

/**
 * Mounted fixture: one span per top-level token (marks render childless). The verbs resolve
 * through the live node layer, so they need a seeded store; mounting is how production gets
 * one, and it keeps the selection watches wired.
 */
function setup(value: string, opts: {controlled?: boolean; onChange?: (value: string) => void} = {}) {
	const store = new Store()
	store.props.set({
		...(opts.controlled ? {value} : {defaultValue: value}),
		onChange: opts.onChange,
		Mark: () => null,
		options: [{markup: MARKUP}, {markup: SLOT_MARKUP}],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	container.replaceChildren(...store.tokens.current().map(() => document.createElement('span')))
	store.host.rendered()
	return {store, api: store.api}
}

function textAt(api: MarkputApi, index: number): TextNode {
	const node = api.nodes()[index]
	if (node.kind !== 'text') throw new Error(`expected a text node at index ${index}`)
	return node
}

describe('MarkputApi (spec §2.3)', () => {
	it('value() and nodes() describe the same document, and every node carries an id', () => {
		const {api} = setup('a@[x](m)b')
		expect(api.value()).toBe('a@[x](m)b')
		expect(api.nodes().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		expect(api.nodes().map(n => typeof n.id)).toEqual(['number', 'number', 'number'])
	})

	it('find resolves a live id and misses an unknown one', () => {
		const {api} = setup('a@[x](m)b')
		const mark = api.nodes()[1]
		expect(api.find(mark.id)).toBe(mark)
		expect(api.find(9999)).toBeUndefined()
	})

	it('changed carries the ids of one commit', () => {
		const {api} = setup('hello')
		const seen: TokenDelta[] = []
		// `changed` is an Event, so the subscription verb is `watch` — CALLING it emits. That
		// is why both adapter barrels re-export `watch`: without it a userland consumer of
		// @markput/react cannot consume the documented event at all.
		watch(api.changed, delta => seen.push(delta))
		const id = api.nodes()[0].id
		api.replaceText({node: textAt(api, 0), start: 0, end: 1}, 'H')
		expect(seen).toHaveLength(1)
		expect(seen[0].updated).toEqual([id])
		expect(seen[0].added).toEqual([])
	})

	it("insertMark inserts at an anchor and at 'caret', and rejects when there is no selection", () => {
		const {api} = setup('ab')
		const fresh = api.insertMark({node: textAt(api, 0), offset: 1}, {markup: MARKUP, value: 'x', meta: 'm'})
		expect(api.value()).toBe('a@[x](m)b')
		expect(fresh?.kind).toBe('mark')

		// Nothing is selected yet: `'caret'` has no offset to resolve and the verb rejects.
		expect(api.insertMark('caret', {markup: MARKUP, value: 'y'})).toBeUndefined()
		expect(api.value()).toBe('a@[x](m)b')

		api.caret({node: textAt(api, 0), offset: 0})
		expect(api.insertMark('caret', {markup: MARKUP, value: 'y'})?.kind).toBe('mark')
		expect(api.value()).toBe('@[y]()a@[x](m)b')
	})

	it('insertMark returns undefined in controlled mode but still emits', () => {
		// The fixture is LOAD-BEARING: it puts an existing mark AT the insertion offset, so the
		// positional lookup would answer with THAT node if the controlled early return were
		// dropped. With a mark-free offset the mutation survives — measured.
		const emitted: string[] = []
		const {api} = setup('@[a](m)b', {controlled: true, onChange: v => emitted.push(v)})
		expect(api.insertMark('start', {markup: MARKUP, value: 'x'})).toBeUndefined()
		expect(emitted).toEqual(['@[x]()@[a](m)b'])
		expect(api.value()).toBe('@[a](m)b') // controlled: nothing committed
	})

	it('insertMark returns the mark it created, not the first mark in the document', () => {
		// Discriminates the positional lookup: with a mark BEFORE the insertion point, a
		// "first mark in the tree" implementation returns the wrong node.
		const {api} = setup('@[a](m)tail')
		const existing = api.nodes()[1]
		const fresh = api.insertMark('end', {markup: MARKUP, value: 'b', meta: 'n'})
		expect(api.value()).toBe('@[a](m)tail@[b](n)')
		expect(fresh?.id).not.toBe(existing.id)
		expect(fresh && api.find(fresh.id)).toBe(fresh)
	})

	it('replaceText edits inside the node and rejects a range past its end', () => {
		const {api} = setup('hello')
		expect(api.replaceText({node: textAt(api, 0), start: 0, end: 5}, 'howdy')).toBe(true)
		expect(api.value()).toBe('howdy')
		expect(api.replaceText({node: textAt(api, 0), start: 0, end: 99}, 'x')).toBe(false)
		expect(api.value()).toBe('howdy')
	})

	it('replaceRange spans a mark and normalizes a reversed pair', () => {
		const {api} = setup('ab@[x](m)cd')
		const from = {node: textAt(api, 0), offset: 1}
		const to = {node: textAt(api, 2), offset: 1}
		// Reversed on purpose: `from` after `to` is legal (spec §2.3).
		expect(api.replaceRange(to, from, 'Z')).toBe(true)
		expect(api.value()).toBe('aZd')
	})

	it("setValue replaces the whole value, including to '' and back", () => {
		const {api} = setup('hello @[world](m)')
		expect(api.setValue('')).toBe(true)
		expect(api.value()).toBe('')
		expect(api.setValue('again')).toBe(true)
		expect(api.value()).toBe('again')
	})

	it('tx composes two disjoint ops into one emission and rejects an overlapping pair', () => {
		const emitted: string[] = []
		const {api} = setup('abcdef', {onChange: v => emitted.push(v)})
		const node = textAt(api, 0)
		const composed = api.tx(() => {
			api.replaceText({node, start: 0, end: 1}, 'X')
			api.replaceText({node, start: 5, end: 6}, 'Y')
		})
		expect(composed).toBe(true)
		expect(api.value()).toBe('XbcdeY')
		expect(emitted).toEqual(['XbcdeY'])

		const fresh = textAt(api, 0)
		const overlapping = api.tx(() => {
			api.replaceText({node: fresh, start: 0, end: 3}, 'P')
			api.replaceText({node: fresh, start: 2, end: 5}, 'Q')
		})
		expect(overlapping).toBe(false)
		expect(api.value()).toBe('XbcdeY')
		expect(emitted).toEqual(['XbcdeY'])
	})

	it('selection() reports the STORED anchors, not the derived numbers', () => {
		const {api} = setup('hello')
		const node = textAt(api, 0)
		api.select({node, offset: 2})
		const anchor = api.selection()?.anchor
		// The typeof guard is required before `in`: `NodeAnchor` includes the two string edges.
		if (typeof anchor === 'string' || anchor === undefined || !('node' in anchor)) {
			throw new Error('expected a text anchor')
		}
		expect(anchor.offset).toBe(2)
		expect(anchor.node).toBe(node)
	})

	it('caret places a collapsed selection that selectionRange reads back', () => {
		const {api} = setup('hello')
		expect(api.selectionRange()).toBeUndefined()
		expect(api.caret({node: textAt(api, 0), offset: 3})).toBe(true)
		expect(api.selectionRange()).toEqual({start: 3, end: 3})
	})

	it('select() spans two anchors', () => {
		const {api} = setup('ab@[x](m)cd')
		expect(api.select({node: textAt(api, 0), offset: 1}, {node: textAt(api, 2), offset: 1})).toBe(true)
		expect(api.selectionRange()).toEqual({start: 1, end: 10})
	})

	it('select() rejects an anchor whose node has left the tree', () => {
		// A dangling anchor's stored `position` is whatever adoption last wrote, so resolving
		// it would splice at an arbitrary offset (plan decision D-f).
		const {api} = setup('a@[x](m)b')
		const mark = api.nodes()[1]
		api.setValue('plain')
		expect(api.find(mark.id)).toBeUndefined()
		expect(api.select({before: mark})).toBe(false)
		expect(api.selectionRange()).toBeUndefined()
	})

	it('exposes the container and a callable focus', () => {
		const {store, api} = setup('hello')
		expect(api.container).toBe(store.host.container())
		expect(api.container).toBeInstanceOf(HTMLElement)
		expect(() => api.focus()).not.toThrow()
	})
})