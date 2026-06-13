import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../store/Store'

type Mounted = {store: Store; container: HTMLElement}

/** Inline fixture: text "he" [0,2], mark "@[x]" [2,6], text "llo" [6,9]. */
function mountWithMark(): Mounted {
	const store = new Store()
	store.props.set({
		defaultValue: 'he@[x]llo',
		options: [{markup: '@[__value__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

/**
 * Block fixture (pattern from BlockController.spec.ts): mark "one\n\n" [0,5]
 * with child text "one" [0,3], mark "two\n\n" [5,10] with child text "two"
 * [5,8]. One row div per mark, the mark element holding one text surface.
 */
function mountBlock(): Mounted {
	const store = new Store()
	store.props.set({
		defaultValue: 'one\n\ntwo\n\n',
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const mark = document.createElement('span')
		const text = document.createElement('span')
		mark.append(text)
		row.append(mark)
		container.append(row)
	}
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

/**
 * All (node, offset) probes worth checking in a container. Node index 0 is the
 * container itself; subsequent indices follow TreeWalker (element + text) order.
 * @yields each [node, nodeIndex, offset] DOM boundary
 */
function* probes(container: HTMLElement): Generator<[Node, number, number]> {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
	let index = 0
	for (let node: Node | null = container; node; node = walker.nextNode(), index++) {
		const max = node instanceof Text ? node.length : node.childNodes.length
		for (let offset = 0; offset <= max; offset++) yield [node, index, offset]
	}
}

type BoundaryTriple = [nodeIndex: number, offset: number, affinity: 'before' | 'after', position: number]

/**
 * Known-good `(node, offset, affinity) → position` tables, captured from the
 * last green run of the dual-run parity spec (facade vs the since-deleted
 * `SelectionController.rawPositionFromBoundary`). Probes absent from a table
 * were `undefined` in that run and must stay `undefined`.
 *
 * HOW TO REGENERATE after a legitimate parser or DOM change:
 * 1. Build a green reference (the commit just before the change, or a
 *    passing CI run on `next`).
 * 2. In the probe loop below, temporarily collect results instead of
 *    asserting: push `[nodeIndex, offset, affinity, actual]` into an array
 *    when `actual !== undefined`, then fail the test with
 *    `expect(rows).toEqual([])` to dump the full array to the console.
 * 3. Copy the printed array as the new table body (one entry per line).
 * 4. Revert the temporary collection and verify the spec is green again.
 * Keep the regeneration in a known-good build only — a broken build's output
 * would silently pin wrong values.
 */
const boundaryTables: Record<string, BoundaryTriple[]> = {
	// Fixture: text "he" [0,2], mark "@[x]" [2,6], text "llo" [6,9].
	// Node indices: 0 container, 1 span("he"), 2 #text"he", 3 mark span,
	// 4 #text"x", 5 span("llo"), 6 #text"llo".
	'inline with mark': [
		[0, 0, 'before', 0],
		[0, 0, 'after', 0],
		[0, 1, 'before', 2],
		[0, 1, 'after', 2],
		[0, 2, 'before', 6],
		[0, 2, 'after', 6],
		[0, 3, 'before', 9],
		[0, 3, 'after', 9],
		[1, 0, 'before', 0],
		[1, 0, 'after', 0],
		[1, 1, 'before', 2],
		[1, 1, 'after', 2],
		[2, 0, 'before', 0],
		[2, 0, 'after', 0],
		[2, 1, 'before', 1],
		[2, 1, 'after', 1],
		[2, 2, 'before', 2],
		[2, 2, 'after', 2],
		[3, 0, 'before', 2],
		[3, 0, 'after', 2],
		[3, 1, 'before', 6],
		[3, 1, 'after', 6],
		[4, 0, 'before', 6],
		[4, 0, 'after', 2],
		[4, 1, 'before', 6],
		[4, 1, 'after', 2],
		[5, 0, 'before', 6],
		[5, 0, 'after', 6],
		[5, 1, 'before', 9],
		[5, 1, 'after', 9],
		[6, 0, 'before', 6],
		[6, 0, 'after', 6],
		[6, 1, 'before', 7],
		[6, 1, 'after', 7],
		[6, 2, 'before', 8],
		[6, 2, 'after', 8],
		[6, 3, 'before', 9],
		[6, 3, 'after', 9],
	],
	// Fixture: mark "one\n\n" [0,5] (text "one" [0,3]), mark "two\n\n" [5,10]
	// (text "two" [5,8]). Node indices: 0 container, 1 row div, 2 mark span,
	// 3 text span, 4 #text"one", 5 row div, 6 mark span, 7 text span, 8 #text"two".
	'block layout': [
		[0, 0, 'before', 0],
		[0, 0, 'after', 0],
		[0, 1, 'before', 5],
		[0, 1, 'after', 5],
		[0, 2, 'before', 10],
		[0, 2, 'after', 10],
		[1, 0, 'before', 0],
		[1, 0, 'after', 0],
		[1, 1, 'before', 5],
		[1, 1, 'after', 5],
		[2, 0, 'before', 0],
		[2, 0, 'after', 0],
		[2, 1, 'before', 5],
		[2, 1, 'after', 5],
		[3, 0, 'before', 0],
		[3, 0, 'after', 0],
		[3, 1, 'before', 3],
		[3, 1, 'after', 3],
		[4, 0, 'before', 0],
		[4, 0, 'after', 0],
		[4, 1, 'before', 1],
		[4, 1, 'after', 1],
		[4, 2, 'before', 2],
		[4, 2, 'after', 2],
		[4, 3, 'before', 3],
		[4, 3, 'after', 3],
		[5, 0, 'before', 5],
		[5, 0, 'after', 5],
		[5, 1, 'before', 10],
		[5, 1, 'after', 10],
		[6, 0, 'before', 5],
		[6, 0, 'after', 5],
		[6, 1, 'before', 10],
		[6, 1, 'after', 10],
		[7, 0, 'before', 5],
		[7, 0, 'after', 5],
		[7, 1, 'before', 8],
		[7, 1, 'after', 8],
		[8, 0, 'before', 5],
		[8, 0, 'after', 5],
		[8, 1, 'before', 6],
		[8, 1, 'after', 6],
		[8, 2, 'before', 7],
		[8, 2, 'after', 7],
		[8, 3, 'before', 8],
		[8, 3, 'after', 8],
	],
}

describe('TokenModel facade boundary behavior (pinned from dual-run parity)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	for (const [name, mount] of [
		['inline with mark', mountWithMark],
		['block layout', mountBlock],
	] as const) {
		it(`boundaryFor matches the pinned table — ${name}`, () => {
			const {store, container} = mount()
			const table = boundaryTables[name]
			// Non-vacuous guard: the pinned table must carry real expectations.
			expect(table.length).toBeGreaterThan(0)
			const expected = new Map(table.map(([n, o, a, pos]) => [`${n}:${o}:${a}`, pos]))

			let probed = 0
			for (const [node, nodeIndex, offset] of probes(container)) {
				for (const affinity of ['before', 'after'] as const) {
					probed++
					const actual = store.tokens.boundaryFor(node, offset, affinity)
					expect
						.soft(actual, `${node.nodeName}#${nodeIndex}@${offset}/${affinity}`)
						.toBe(expected.get(`${nodeIndex}:${offset}:${affinity}`))
				}
			}
			// Every pinned triple must have been visited by the probe walk.
			expect(probed).toBeGreaterThanOrEqual(table.length)
		})

		it(`readSelection reads the live selection as absolute positions — ${name}`, () => {
			const {store, container} = mount()
			const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
			if (!(firstText instanceof Text) || firstText.length === 0) throw new Error('expected a text node')
			const sel = window.getSelection()
			const range = document.createRange()
			range.setStart(firstText, 0)
			range.setEnd(firstText, Math.min(1, firstText.length))
			sel?.removeAllRanges()
			sel?.addRange(range)
			// Both fixtures start their first text token at absolute position 0.
			expect(store.tokens.selection()?.raw).toEqual({range: {start: 0, end: 1}, direction: 'forward'})
			expect(store.tokens.selectedContent()).toEqual({
				html: firstText.data.slice(0, 1),
				text: firstText.data.slice(0, 1),
			})
		})
	}

	it('tokenAt finds the containing text surface and the next one after a gap', () => {
		const {store} = mountWithMark()
		// value: he@[x]llo → text "he" [0,2], mark [2,6], text "llo" [6,9]
		expect(store.tokens.tokenAt(1)?.address().path).toEqual([0])
		expect(store.tokens.tokenAt(2)?.address().path).toEqual([0]) // inclusive end of "he"
		expect(store.tokens.tokenAt(5)?.address().path).toEqual([2]) // inside mark: no containing surface → next start ≥ 5 is "llo"
		expect(store.tokens.tokenAt(9)?.address().path).toEqual([2])
		expect(store.tokens.tokenAt(10)).toBeUndefined() // past the last surface
	})
})

describe('TokenModel placement commands', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('placeCaret(raw) places inside the right surface; readSelection round-trips', () => {
		const {store} = mountWithMark()
		expect(store.tokens.placeCaret(1)).toBe(true)
		expect(store.tokens.selection()?.raw?.range).toEqual({start: 1, end: 1})
	})

	it('placeCaret at a mark/text shared boundary resolves to the text surface', () => {
		const {store} = mountWithMark()
		const mark = store.tokens.tokens().find(t => t.type === 'mark')
		if (!mark) throw new Error('expected mark')
		// mark [2,6]: position 6 is also the inclusive start of text "llo" [6,9].
		// The text surface wins because textTargetAt finds "llo" before markBoundaryAt
		// is consulted — the mark branch in #placeAtRawPosition is therefore not
		// exercised here.
		expect(store.tokens.placeCaret(mark.position.end)).toBe(true)
		expect(store.tokens.selection()?.raw?.range.start).toBe(mark.position.end)
	})

	// Note: the mark-only branch of #placeAtRawPosition (markBoundaryAt) is not
	// directly reachable via a raw position in this fixture because the parser always
	// emits an empty leading text token when a mark is first in the value (confirmed
	// for '@[x]llo' → [{type:'text',position:{0,0}}, {type:'mark',position:{0,4}},
	// {type:'text',position:{4,7}}]). textTargetAt therefore always matches before
	// markBoundaryAt is tried. The mark-form of placeCaret({handle, offset}) that
	// drives the same underlying placeAtChildBoundary call is covered by the
	// 'placeCaret({handle, offset}) targets the handle's token explicitly' test.

	it("placeCaret({handle, offset}) targets the handle's token explicitly", () => {
		const {store} = mountWithMark()
		const token = store.tokens.tokens()[2] // text "llo" [6,9]
		const handle = store.tokens.handle(token.id!)
		if (!handle) throw new Error('expected handle')
		expect(store.tokens.placeCaret({handle, offset: 1})).toBe(true)
		expect(store.tokens.selection()?.raw?.range.start).toBe(token.position.start + 1) // 6 + 1 = 7
	})

	it('selectRange spans two text surfaces', () => {
		const {store} = mountWithMark()
		const last = store.tokens.tokens().at(-1)
		if (!last) throw new Error('expected tokens')
		expect(store.tokens.selectRange(0, last.position.end)).toBe(true)
		const read = store.tokens.selection()?.raw
		expect(read?.range).toEqual({start: 0, end: last.position.end})
	})

	it('handle.placeCaret + handle.caretIndex round-trip', () => {
		const {store} = mountWithMark()
		const handle = store.tokens.tokenAt(0)
		if (!handle) throw new Error('expected handle')
		expect(handle.placeCaret(2)).toBe(true)
		expect(handle.caretIndex()).toBe(2)
		expect(handle.textLength()).toBe(handle.text().length)
	})
})

describe('TokenModel selection() — the one snapshot', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined when there is no range', () => {
		const {store} = mountWithMark()
		window.getSelection()?.removeAllRanges()
		expect(store.tokens.selection()).toBeUndefined()
	})

	it('carries raw absolute positions, anchor, collapsed, focusNode, rect, and intersects', () => {
		const {store, container} = mountWithMark()
		const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
		if (!(firstText instanceof Text) || firstText.length < 2) throw new Error('expected the "he" text node')
		const range = document.createRange()
		range.setStart(firstText, 0)
		range.setEnd(firstText, 2)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		const snapshot = store.tokens.selection()
		if (!snapshot) throw new Error('expected a selection snapshot')
		// "he" is [0,2] absolute.
		expect(snapshot.raw?.range).toEqual({start: 0, end: 2})
		expect(snapshot.collapsed).toBe(false)
		expect(snapshot.anchor.node).toBe(firstText)
		expect(snapshot.anchor.isCollapsed).toBe(false)
		expect(snapshot.focusNode).toBe(firstText)
		expect(snapshot.rect).toBeInstanceOf(DOMRect)
		expect(snapshot.intersects(firstText)).toBe(true)
		expect(snapshot.intersects(document.body)).toBe(true)
	})

	it('collapsed is true and raw is a zero-width range for a caret', () => {
		const {store, container} = mountWithMark()
		const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
		if (!(firstText instanceof Text) || firstText.length < 1) throw new Error('expected the "he" text node')
		const range = document.createRange()
		range.setStart(firstText, 1)
		range.collapse(true)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		const snapshot = store.tokens.selection()
		if (!snapshot) throw new Error('expected a selection snapshot')
		expect(snapshot.collapsed).toBe(true)
		expect(snapshot.raw?.range).toEqual({start: 1, end: 1})
	})
})