import {afterEach, describe, expect, it} from 'vitest'

import {mountValue, mountWithMark} from '../__testing__/mountFixtures'

describe('anchorFor', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined for a node outside the container', () => {
		const {store} = mountWithMark()
		const orphan = document.createElement('span')
		expect(store.tokens.anchorFor(orphan, 0)).toBeUndefined()
	})

	it('returns start for a boundary in a rootless document', () => {
		// Only block layout can be rootless: inline keeps the empty text token of an
		// empty value, block filters it out.
		const {store, container} = mountValue('', {layout: 'block'})
		expect(store.tokens.anchorFor(container, 0)).toBe('start')
	})

	it('anchors a container boundary before the first root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 0)).toEqual({before: roots[0]})
	})

	it('anchors a container boundary past the last child after the last root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 3)).toEqual({after: roots[2]})
	})

	it('resolves an interior container boundary by affinity', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 1, 'before')).toEqual({after: roots[0]})
		expect(store.tokens.anchorFor(container, 1, 'after')).toEqual({before: roots[1]})
	})

	it('anchors a text-surface boundary to the live node and a local offset', () => {
		const {store, text1} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text1.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[0], offset: 1})
	})

	it('anchors the second text surface with an offset local to ITS node, not the document', () => {
		const {store, text2} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		// The document position here is 7; the anchor must say 1.
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[2], offset: 1})
	})

	it('returns undefined for a boundary that splits a surrogate pair', () => {
		const {store, surfaces} = mountValue('\u{1F600}a')
		const textNode = surfaces[0].firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toBeUndefined()
	})

	it('holds a text anchor through the adopt→bind window that goes stale numerically', () => {
		const {store, text1, text2} = mountWithMark()
		const dom1 = text1.firstChild
		const dom2 = text2.firstChild
		if (!(dom1 instanceof Text) || !(dom2 instanceof Text)) throw new Error('expected rendered text nodes')

		// Structural (a mark is added), so the commit latches for its bind instead of
		// self-healing; no `host.rendered()` follows, so the DOM stays one generation
		// behind. 'he' shrinks to 'h' in the same edit.
		store.tokens.replace({start: 0, end: -1}, 'h@[x]llo@[z]')
		expect(dom1.data).toBe('he')

		// G2: the offset is local to a node the edit did not touch, so the anchor is
		// right — while the numeric walk adds that node's stale `position.start` and
		// answers 7 where the live document position is 6.
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(dom2, 1)).toEqual({node: roots[2], offset: 1})
		expect(roots[2].range().start + 1).toBe(6)
		expect(store.tokens.boundaryFor(dom2, 1)).toBe(7)

		// D4's second fail-closed arm: the DOM offset outlives the text it indexes.
		// The numeric walk has no equivalent — it answers a plausible, wrong number.
		expect(store.tokens.anchorFor(dom1, 2)).toBeUndefined()
		expect(store.tokens.boundaryFor(dom1, 2)).toBe(2)
	})
})