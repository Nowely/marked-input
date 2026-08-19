import {describe, expect, it} from 'vitest'

import {consignRendered} from '../features/tokens/__testing__/mountFixtures'
import type {Markup} from '../features/tokens/parser/types'
import type {TextNode} from '../features/tokens/tree/types'
import {effect, watch} from '../shared/signals'
import type {MarkputApi} from './MarkputApi'
import {Store} from './Store'

const MARKUP: Markup = '@[__value__](__meta__)'
const SLOT_MARKUP: Markup = '#[__value__]{__slot__}'

/**
 * Mounted fixture: one span per top-level token (marks render childless), consigned the way an
 * adapter's refs would. The verbs resolve through the live node layer, so they need a seeded
 * store; mounting is how production gets one, and it keeps the selection watches wired.
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
	container.replaceChildren(...store.tokens.nodes().map(() => document.createElement('span')))
	consignRendered(store, container)
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

	it('changed pulses once per commit, carries nothing, and lands on a settled model', () => {
		const {api} = setup('hello')
		const payloads: unknown[] = []
		const valueAtPulse: string[] = []
		// `changed` is an Event, so the subscription verb is `watch` — CALLING it emits. That
		// is why both adapter barrels re-export `watch`: without it a userland consumer of
		// @markput/react cannot consume the documented event at all.
		watch(api.changed, payload => {
			payloads.push(payload)
			valueAtPulse.push(api.value())
		})
		api.replaceText({node: textAt(api, 0), start: 0, end: 1}, 'H')
		// PAYLOAD-FREE by contract, pinned as the literal value a subscriber receives: the
		// `{added, removed, updated}` id lists are gone and a consumer re-reads `nodes()`/`find()`.
		expect(payloads).toEqual([undefined])
		// THE MODEL CLOCK: `value()` already answers the committed string when the pulse lands,
		// which is what makes the read-back the documented replacement for the payload.
		expect(valueAtPulse).toEqual(['Hello'])
	})

	it('changed pulses on a structural commit, with no bind in between', () => {
		// Retimed: `changed` is now the COMMIT clock, not the post-bind one. This fixture consigns
		// once and never re-renders, so a structural commit binds nothing afterwards — under the
		// fused post-bind event it announced nothing here at all.
		const {api} = setup('hello')
		let pulses = 0
		watch(api.changed, () => pulses++)
		expect(api.setValue('a@[x](m)b')).toBe(true)
		expect(pulses).toBe(1)
		expect(api.nodes().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
	})

	it('changed pulses once for a tx, not once per op inside it', () => {
		// "Once per COMMIT" is the whole of the count contract, and a tx is the case that
		// discriminates it from "once per write verb".
		const {api} = setup('abcdef')
		let pulses = 0
		watch(api.changed, () => pulses++)
		const node = textAt(api, 0)
		const composed = api.tx(() => {
			api.replaceText({node, start: 0, end: 1}, 'X')
			api.replaceText({node, start: 5, end: 6}, 'Y')
		})
		expect(composed).toBe(true)
		expect(pulses).toBe(1)
	})

	it("insertMark inserts at an anchor and at 'caret', and rejects when there is no selection", () => {
		const {api} = setup('ab')
		expect(api.insertMark({node: textAt(api, 0), offset: 1}, {markup: MARKUP, value: 'x', meta: 'm'})).toBe(true)
		expect(api.value()).toBe('a@[x](m)b')

		// Nothing is selected yet: `'caret'` has no offset to resolve and the verb rejects.
		expect(api.insertMark('caret', {markup: MARKUP, value: 'y'})).toBe(false)
		expect(api.value()).toBe('a@[x](m)b')

		api.caret({node: textAt(api, 0), offset: 0})
		expect(api.insertMark('caret', {markup: MARKUP, value: 'y'})).toBe(true)
		expect(api.value()).toBe('@[y]()a@[x](m)b')
	})

	it('insertMark reports ACCEPTANCE in controlled mode, where no node exists yet', () => {
		// The distinction the old `MarkNode | undefined` shape could not draw: this write is
		// accepted and emitted, and only the parent's echo can commit it (spec D6). Answering
		// `undefined` here made it indistinguishable from the rejection above.
		const emitted: string[] = []
		const {api} = setup('@[a](m)b', {controlled: true, onChange: v => emitted.push(v)})
		expect(api.insertMark('start', {markup: MARKUP, value: 'x'})).toBe(true)
		expect(emitted).toEqual(['@[x]()@[a](m)b'])
		expect(api.value()).toBe('@[a](m)b') // controlled: nothing committed
	})

	it('insertMark at the document end appends', () => {
		const {api} = setup('@[a](m)tail')
		expect(api.insertMark('end', {markup: MARKUP, value: 'b', meta: 'n'})).toBe(true)
		expect(api.value()).toBe('@[a](m)tail@[b](n)')
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

	it('caret places a collapsed selection that selection() reads back', () => {
		// `selectionRange()` was the read here until S2.6 deleted it (spec S2 D11): the public
		// surface answers with ANCHORS, and both ends of a caret are the same one.
		const {api} = setup('hello')
		const node = textAt(api, 0)
		expect(api.selection()).toBeUndefined()
		expect(api.caret({node, offset: 3})).toBe(true)
		expect(api.selection()).toEqual({anchor: {node, offset: 3}, head: {node, offset: 3}})
	})

	it('select() spans two anchors', () => {
		const {api} = setup('ab@[x](m)cd')
		const first = textAt(api, 0)
		const last = textAt(api, 2)
		expect(api.select({node: first, offset: 1}, {node: last, offset: 1})).toBe(true)
		expect(api.selection()).toEqual({anchor: {node: first, offset: 1}, head: {node: last, offset: 1}})
	})

	it('select() rejects an anchor whose node has left the tree', () => {
		// A dangling anchor's stored `position` is whatever adoption last wrote, so resolving
		// it would splice at an arbitrary offset (plan decision D-f).
		const {api} = setup('a@[x](m)b')
		const mark = api.nodes()[1]
		api.setValue('plain')
		expect(api.find(mark.id)).toBeUndefined()
		expect(api.select({before: mark})).toBe(false)
		expect(api.selection()).toBeUndefined()
	})

	it('exposes the container', () => {
		const {store, api} = setup('hello')
		expect(api.container).toBe(store.host.container())
		expect(api.container).toBeInstanceOf(HTMLElement)
	})

	it('focus() puts the caret at the start of the first token', () => {
		const {api} = setup('hello')

		api.focus()

		const range = document.getSelection()?.getRangeAt(0)
		expect(range?.collapsed).toBe(true)
		expect(api.container?.contains(range?.startContainer ?? null)).toBe(true)

		// The stored anchors, not the DOM's: `focus()` goes through the selection driver, so
		// the model must agree that the caret sits at offset 0 of the FIRST token. A TEXT
		// anchor specifically — a boundary form would mean it landed beside the token.
		const selection = api.selection()
		if (!selection) throw new Error('expected a stored selection')
		const {anchor} = selection
		if (typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
		expect(anchor.offset).toBe(0)
		expect(anchor.node.id).toBe(api.nodes()[0].id)
		expect(selection.head).toEqual(anchor)
	})

	it('insertMark carries the slot through to the markup', () => {
		// Without this the `init.slot` passthrough is unproven — measured: dropping it from
		// `annotate` survives the whole suite.
		const {api} = setup('ab')
		expect(
			api.insertMark({node: textAt(api, 0), offset: 1}, {markup: SLOT_MARKUP, value: 'v', slot: 'inner'})
		).toBe(true)
		// The VALUE is the gate: dropping `slot` from `annotate` renders `a#[v]{}b`.
		expect(api.value()).toBe('a#[v]{inner}b')
	})

	it("insertMark at 'caret' with a RANGED selection inserts at the selection start", () => {
		// Discriminates `range().start` from `range().end`: every collapsed fixture agrees.
		const {api} = setup('abcd')
		const node = textAt(api, 0)
		api.select({node, offset: 1}, {node, offset: 3})
		expect(api.insertMark('caret', {markup: MARKUP, value: 'x'})).toBe(true)
		expect(api.value()).toBe('a@[x]()bcd')
	})

	it("insertMark at 'caret' with a BACKWARDS selection still inserts at the document-order start", () => {
		// The only case that gates `Selection.caretAnchor`'s comparison: `anchor` is the FIXED
		// end, so here it is the HIGH one. Taking `anchors.anchor` unconditionally inserts at 3
		// ('abc@[x]()d') and the forward fixture above cannot tell the two apart.
		const {api} = setup('abcd')
		const node = textAt(api, 0)
		api.select({node, offset: 3}, {node, offset: 1})
		expect(api.insertMark('caret', {markup: MARKUP, value: 'x'})).toBe(true)
		expect(api.value()).toBe('a@[x]()bcd')
	})

	it('nodes() is reactive — §2.3 says so, and an effect must re-run on a structural change', () => {
		// Measured: without this, wrapping `TokenModel.nodes()` in `untracked` survives the
		// entire suite, so the "reactive" half of §2.3's read contract is unproven.
		const {api} = setup('hello')
		let runs = 0
		const stop = effect(() => {
			api.nodes()
			runs++
		})
		expect(runs).toBe(1)
		api.setValue('a@[x](m)b')
		expect(runs).toBe(2)
		stop()
	})
})