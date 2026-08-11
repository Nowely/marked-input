import {afterEach, describe, expect, it} from 'vitest'

import {mountBlock, mountWithMark} from '../__testing__/mountFixtures'
import {joinNodes} from '../tree/tree'

describe('TokenModel facade selection reads', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	for (const [name, mount] of [
		['inline with mark', mountWithMark],
		['block layout', mountBlock],
	] as const) {
		it(`reads the live selection as node anchors — ${name}`, () => {
			const {store, container} = mount()
			const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
			if (!(firstText instanceof Text) || firstText.length === 0) throw new Error('expected a text node')
			const sel = window.getSelection()
			const range = document.createRange()
			range.setStart(firstText, 0)
			range.setEnd(firstText, Math.min(1, firstText.length))
			sel?.removeAllRanges()
			sel?.addRange(range)

			// Resolved through the DOM rather than named: the inline fixture opens with a
			// ROOT text node and the block one with a mark's slot CHILD, and the anchor is
			// local to whichever it is — which is the point (the deleted numeric read
			// answered 0 and 1 for both only because both start the document).
			const handle = store.tokens.handleAt(firstText)
			if (handle === undefined || handle === 'control') throw new Error('expected a bound token')
			const node = store.tokens.find(handle.id)
			expect(store.selection.domAnchors()).toEqual({anchor: {node, offset: 0}, head: {node, offset: 1}})
			expect(store.tokens.selectedContent()).toEqual({
				html: firstText.data.slice(0, 1),
				text: firstText.data.slice(0, 1),
			})
		})
	}
})

describe('TokenModel placement commands', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it("placeCaret places inside the anchor's own surface", () => {
		const {store} = mountWithMark()
		const at = store.tokens.anchorAt(1)
		expect(store.tokens.placeCaret(at)).toBe(true)
		expect(store.selection.domAnchors()).toEqual({anchor: at, head: at})
	})

	it('places the document-edge anchors through the first and last roots', () => {
		// The edges name no node, so they are the one shape that has to resolve against the
		// live roots — and they are not theoretical: `anchorAt` answers `'end'` for ANY
		// out-of-range caret intent (spec S1 §4.6 item 5), which is what replaced the
		// deleted selection clamp. Declining them leaves such a caret unplaced.
		const {store, text1, text2} = mountWithMark()
		const roots = store.tokens.nodes()

		expect(store.tokens.placeCaret('end')).toBe(true)
		expect(document.activeElement).toBe(text2)
		expect(store.selection.domAnchors()?.anchor).toEqual({node: roots[2], offset: 3})

		expect(store.tokens.placeCaret('start')).toBe(true)
		expect(document.activeElement).toBe(text1)
		expect(store.selection.domAnchors()?.anchor).toEqual({node: roots[0], offset: 0})
	})

	it('places two anchors sharing one offset in their own surfaces', () => {
		// The mark '@[x]' ENDS at 6 and the text 'llo' STARTS at 6: one document position,
		// two anchors. The numeric predecessor could only answer with one of them (its
		// nearest-text-surface search always won, which is why its mark branch was
		// unreachable); each anchor now places through its own node.
		const {store, mark, text2} = mountWithMark()
		const markNode = store.tokens.nodes()[1]

		expect(store.tokens.placeCaret({after: markNode})).toBe(true)
		expect(document.activeElement).toBe(mark)

		expect(store.tokens.placeCaret(store.tokens.anchorAt(6))).toBe(true)
		expect(document.activeElement).toBe(text2)
	})

	it("handle.placeCaret targets the handle's token explicitly", () => {
		const {store} = mountWithMark()
		const node = store.tokens.nodes()[2] // text "llo"
		const handle = store.tokens.handle(node.id)
		if (!handle) throw new Error('expected handle')
		expect(handle.placeCaret(1)).toBe(true)
		expect(store.selection.domAnchors()?.anchor).toEqual({node, offset: 1})
	})

	it('selectRange spans two text surfaces, in either anchor order', () => {
		const {store} = mountWithMark()
		const roots = store.tokens.nodes()
		const from = store.tokens.anchorAt(0)
		const to = store.tokens.anchorAt(9)
		const spanned = {anchor: {node: roots[0], offset: 0}, head: {node: roots[2], offset: 3}}

		expect(store.tokens.selectRange(from, to)).toBe(true)
		expect(store.selection.domAnchors()).toEqual(spanned)

		// THE gate on the DOM-order normalization that replaced the numeric `min`/`max`:
		// a Range whose end precedes its start COLLAPSES rather than throwing, so a
		// reversed pair would silently select nothing.
		window.getSelection()?.removeAllRanges()
		expect(store.tokens.selectRange(to, from)).toBe(true)
		expect(store.selection.domAnchors()).toEqual(spanned)
	})

	it('selects to the END of a surface the browser split into two text nodes', () => {
		// THE gate on `#surfaceAt`'s length clamp. An `{after: node}` anchor means "the end
		// of this surface" and carries `Infinity` as its local offset; `findTextBoundary`
		// reads a non-finite offset as "ran out of text" and answers the FIRST text node's
		// end, which is indistinguishable from the right answer while a surface holds ONE
		// text node — the state every bind leaves it in. Contenteditable input splits one,
		// which is what this fixture reproduces.
		const {store, text2} = mountWithMark()
		const roots = store.tokens.nodes()
		const first = text2.firstChild
		if (!(first instanceof Text)) throw new Error('expected the "llo" text node')
		first.splitText(1)
		expect(text2.childNodes).toHaveLength(2)

		expect(store.tokens.selectRange(store.tokens.anchorAt(0), {after: roots[2]})).toBe(true)
		expect(store.selection.domAnchors()?.head).toEqual({node: roots[2], offset: 3})
	})

	it('handle.placeCaret + handle.caretIndex round-trip', () => {
		const {store} = mountWithMark()
		const handle = store.tokens.handle(store.tokens.nodes()[0].id!)
		if (!handle) throw new Error('expected handle')
		expect(handle.placeCaret(2)).toBe(true)
		expect(handle.caretIndex()).toBe(2)
		expect(handle.textLength()).toBe(joinNodes([store.tokens.nodes()[0]]).length)
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

	it('carries the window range, anchor, focusNode, rect, and intersects', () => {
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
		expect(snapshot.range.startOffset).toBe(0)
		expect(snapshot.range.endOffset).toBe(2)
		expect(snapshot.anchor.isCollapsed).toBe(false)
		expect(snapshot.anchor.node).toBe(firstText)
		expect(snapshot.focusNode).toBe(firstText)
		expect(snapshot.rect).toBeInstanceOf(DOMRect)
		expect(snapshot.intersects(firstText)).toBe(true)
		expect(snapshot.intersects(document.body)).toBe(true)
	})

	it("range is the window selection's own range, not a clone", () => {
		// THE gate on `SelectionSnapshot.range`'s identity, and the precondition for
		// `SelectionDriver.sync` resolving its boundaries. MEASURED, and narrower than
		// "live": Chromium caches one Range per selection, so `getRangeAt(0)` is
		// reference-stable AND writes through — but a `setBaseAndExtent` DETACHES the
		// handed-out object (it keeps its old boundaries while a fresh `getRangeAt(0)`
		// answers a new one). What `sync` relies on is therefore the PULL — `selection()`
		// re-reads the window on every call — not forward liveness. Both halves below fail
		// against a `cloneRange()`.
		const {store, container} = mountWithMark()
		const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
		if (!(firstText instanceof Text) || firstText.length < 2) throw new Error('expected the "he" text node')
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.setBaseAndExtent(firstText, 0, firstText, 1)

		const snapshot = store.tokens.selection()
		if (!snapshot) throw new Error('expected a selection snapshot')
		expect(snapshot.range).toBe(sel.getRangeAt(0))

		// Write-through: a clone could not move the window selection.
		snapshot.range.setEnd(firstText, 2)
		expect(sel.focusOffset).toBe(2)

		// The pull, which is what `sync` actually depends on.
		sel.setBaseAndExtent(firstText, 0, firstText, 1)
		expect(store.tokens.selection()?.range.endOffset).toBe(1)
	})

	it('anchor.isCollapsed and range.collapsed both report a caret', () => {
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
		expect(snapshot.anchor.isCollapsed).toBe(true)
		expect(snapshot.range.collapsed).toBe(true)
	})
})