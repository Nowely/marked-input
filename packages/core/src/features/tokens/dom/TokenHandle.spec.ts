import {afterEach, describe, expect, it, vi} from 'vitest'

import {Store} from '../../../store/Store'
import {mountStructuralInline} from '../__testing__/mountFixtures'
import {markToken, textToken} from '../__testing__/tokenFactories'
import type {Token} from '../parser/types'
import {createTokenTree} from '../tree/tree'
import type {TextNode, TreeNode} from '../tree/types'
import {TokenHandle} from './TokenHandle'

/** One live node for a fixture token — `bindElements`' second argument. */
function nodeOf(token: Token): TreeNode {
	return createTokenTree([token]).roots()[0]
}

function textNodeOf(content: string): TextNode {
	const node = nodeOf(textToken(content, 0))
	if (node.kind !== 'text') throw new Error('expected a text node')
	return node
}

/** One bare text span inside the editing host — the one-host shape `bind` renders. */
function mountSurface(content: string) {
	const container = document.createElement('div')
	container.contentEditable = 'true'
	const span = document.createElement('span')
	span.textContent = content
	container.append(span)
	document.body.append(container)
	return {container, span}
}

/** A ce=false mark between two bare text spans, all under the one editing host. */
function mountMark() {
	const container = document.createElement('div')
	container.contentEditable = 'true'
	const before = document.createElement('span')
	before.textContent = 'ab'
	const mark = document.createElement('mark')
	mark.contentEditable = 'false'
	mark.append(document.createElement('b'))
	const after = document.createElement('span')
	after.textContent = 'cd'
	container.append(before, mark, after)
	document.body.append(container)
	return {container, mark}
}

/**
 * Block layout (issue 08's row world): paragraph rows, no markup. Each RowNode's
 * wrapper div is the row's own token element (the Block wrapper's role); each row
 * text child gets a surface span. `unmount` is the pair of null ref calls the
 * adapter makes when the row component goes away.
 */
function mountRowDoc(value: string) {
	const store = new Store()
	store.props.set({
		defaultValue: value,
		separator: '\n\n',
		options: [],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)

	const rows = store.tokens.nodes().map(node => {
		const rowElement = document.createElement('div')
		const surface = document.createElement('span')
		rowElement.append(surface)
		container.append(rowElement)
		const consign = store.tokens.consign(node.id)
		consign(rowElement)
		const child = node.kind === 'row' ? node.children()[0] : undefined
		const consignSurface = child?.kind === 'text' ? store.tokens.consign(child.id) : undefined
		consignSurface?.(surface)
		return {
			unmount: () => {
				consignSurface?.(null)
				consign(null)
				rowElement.remove()
			},
		}
	})

	return {store, rows}
}

describe('TokenHandle', () => {
	afterEach(() => {
		window.getSelection()?.removeAllRanges()
		document.body.replaceChildren()
	})

	describe('creation', () => {
		it('exposes its id and starts unbound', () => {
			const handle = new TokenHandle(7)

			expect(handle.id).toBe(7)
			expect(handle.element()).toBeUndefined()
		})
	})

	describe('element bindings', () => {
		it('bindElements exposes the live DOM, unbind clears it, rebinding while alive works', () => {
			const {container, span} = mountSurface('hello')
			const host = document.createElement('div')
			const node = textNodeOf('hello')
			const handle = new TokenHandle(1)
			expect(handle.node()).toBeUndefined()

			handle.bindElements({tokenElement: span, textElement: span, childSequenceHost: host}, node)
			expect(handle.element()).toBe(span)
			expect(handle.node()).toEqual({
				tokenElement: span,
				textElement: span,
				childSequenceHost: host,
			})

			handle.unbind()
			expect(handle.element()).toBeUndefined()
			expect(handle.node()).toBeUndefined()
			expect(handle.placeCaret(0)).toBe(false)

			const other = document.createElement('span')
			container.append(other)
			handle.bindElements({tokenElement: other}, node)
			expect(handle.element()).toBe(other)
			expect(handle.node()).toEqual({tokenElement: other})
		})
	})

	describe('the text effect', () => {
		it('reconciles on bind and follows the node afterwards', () => {
			const {span} = mountSurface('stale')
			const node = textNodeOf('hello')
			const handle = new TokenHandle(1)

			handle.bindElements({tokenElement: span, textElement: span}, node)
			expect(span.textContent).toBe('hello')

			node.text('hello!')
			expect(span.textContent).toBe('hello!')
		})

		it('stops following the node once unbound, and again once killed', () => {
			const {span} = mountSurface('hello')
			const node = textNodeOf('hello')
			const handle = new TokenHandle(1)

			handle.bindElements({tokenElement: span, textElement: span}, node)
			handle.unbind()
			node.text('after unbind')
			expect(span.textContent).toBe('hello')

			handle.bindElements({tokenElement: span, textElement: span}, node)
			expect(span.textContent).toBe('after unbind')
			handle.kill()
			node.text('after kill')
			expect(span.textContent).toBe('after unbind')
		})

		it('arms nothing for a mark root, which owns no text surface', () => {
			const {span} = mountSurface('presentation')
			const node = nodeOf(markToken('m', '@[m]', 0))
			const handle = new TokenHandle(1)

			handle.bindElements({tokenElement: span}, node)

			expect(span.textContent).toBe('presentation')
		})
	})

	describe('measurements', () => {
		it('measures the bound text surface', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			expect(handle.hasTextSurface()).toBe(true)
			expect(handle.textLength()).toBe(5)

			expect(handle.placeCaret(3)).toBe(true)
			expect(handle.caretIndex()).toBe(3)
		})

		it('prefers the row element as the measurement scope', () => {
			const container = document.createElement('div')
			const row = document.createElement('div')
			const span = document.createElement('span')
			span.textContent = 'hello'
			const sibling = document.createElement('span')
			sibling.textContent = '!'
			row.append(span, sibling)
			container.append(row)
			document.body.append(container)

			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: row}, textNodeOf('hello'))

			// 6, not 5: the measure scope is the token element — for a row handle that IS
			// the block wrapper — so the sibling's text counts too.
			expect(handle.textLength()).toBe(6)
		})

		it('returns inert defaults when nothing is bound', () => {
			const handle = new TokenHandle(1)

			expect(handle.hasTextSurface()).toBe(false)
			expect(handle.textLength()).toBe(0)
			expect(handle.caretIndex()).toBeUndefined()
		})
	})

	describe('commands', () => {
		it('no-ops false when no elements are bound', () => {
			const handle = new TokenHandle(1)

			expect(handle.placeCaret(0)).toBe(false)
			expect(handle.focus()).toBe(false)
		})

		it('places the caret in the text surface with clamping (Infinity is end)', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			expect(handle.placeCaret(2)).toBe(true)
			expect(handle.caretIndex()).toBe(2)
			expect(handle.placeCaret(Infinity)).toBe(true)
			expect(handle.caretIndex()).toBe(5)
			expect(handle.placeCaret(-3)).toBe(true)
			expect(handle.caretIndex()).toBe(0)
			expect(handle.placeCaret(99)).toBe(true)
			expect(handle.caretIndex()).toBe(5)

			const selection = window.getSelection()
			expect(selection?.anchorNode && span.contains(selection.anchorNode)).toBe(true)
		})

		it('placeCaret on a mark handle lands in the PARENT coordinate space, not inside the mark', () => {
			// A mark is atomic (ce=false): a boundary INSIDE it is not a position the caret
			// can occupy, so its two caret positions are the parent indices around it.
			const {container, mark} = mountMark()
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: mark}, nodeOf(markToken('m', '@[m]', 0)))
			const index = Array.prototype.indexOf.call(container.childNodes, mark)

			expect(handle.placeCaret(Infinity)).toBe(true)
			let selection = window.getSelection()
			expect(selection?.anchorNode).toBe(container)
			expect(selection?.anchorOffset).toBe(index + 1)
			expect(document.activeElement).toBe(container)

			expect(handle.placeCaret(0)).toBe(true)
			selection = window.getSelection()
			expect(selection?.anchorNode).toBe(container)
			expect(selection?.anchorOffset).toBe(index)
		})

		it('declines when a mark has no parent to place in', () => {
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: document.createElement('mark')}, nodeOf(markToken('m', '@[m]', 0)))

			expect(handle.placeCaret(0)).toBe(false)
		})

		it('a model-initiated placement focuses the editing host, not the bare surface', () => {
			// The reason `focusEditingHost` exists: a placement with no click behind it — the
			// `handle.focus()` / `placeAtHandle` / block `focusRow` path — must pull focus INTO
			// the editor, and the old per-element focus was a no-op on a bare span.
			//
			// THE CALL, not just `activeElement`, and the difference is MEASURED: in a focused
			// frame Chromium moves the focused element to the editing host a new selection
			// lands in, so the outcome below is green even with the focus dropped — but only
			// once something in the frame has been focused (alone, the same case is red). The
			// host write is what makes the placement focus the editor unconditionally.
			const {container, span} = mountSurface('hello')
			const focused = vi.spyOn(container, 'focus')
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			expect(handle.placeCaret(2)).toBe(true)

			expect(focused).toHaveBeenCalledTimes(1)
			expect(document.activeElement).toBe(container)
			expect(window.getSelection()?.anchorNode).toBe(span.firstChild)
			expect(handle.caretIndex()).toBe(2)
		})

		it('focuses the editing host of the scope element', () => {
			const {container, span} = mountSurface('hello')
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			expect(handle.focus()).toBe(true)
			expect(document.activeElement).toBe(container)
		})
	})

	describe('dead contract', () => {
		it('kill freezes reads, disables commands and never resurrects', () => {
			const {span} = mountSurface('hello')
			const node = textNodeOf('hello')
			const handle = new TokenHandle(5)
			handle.bindElements({tokenElement: span, textElement: span}, node)
			expect(handle.alive()).toBe(true)

			handle.kill()

			expect(handle.alive()).toBe(false)
			expect(handle.element()).toBeUndefined()
			expect(handle.node()).toBeUndefined()

			// Idempotent: a second kill is silent (no throw, still dead).
			handle.kill()
			expect(handle.alive()).toBe(false)

			// Commands no-op false, measurements collapse to their unbound defaults.
			expect(handle.placeCaret(0)).toBe(false)
			expect(handle.focus()).toBe(false)
			expect(handle.textLength()).toBe(0)
			expect(handle.caretIndex()).toBeUndefined()
			expect(handle.hasTextSurface()).toBe(false)

			// Never resurrected: bindElements is inert on a dead handle — the surface
			// stays unbound AND unwritten.
			handle.bindElements({tokenElement: span, textElement: span}, node)
			node.text('zombie')
			expect(handle.alive()).toBe(false)
			expect(handle.element()).toBeUndefined()
			expect(span.textContent).toBe('hello')
		})
	})

	it('alive() is true while bound', () => {
		const {store, textSurface} = mountStructuralInline('hello')
		const handle = store.tokens.handleAt(textSurface)
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.alive()).toBe(true)
	})

	it('alive() is false once the handle is killed', () => {
		// Block layout: capture row 1's handle, then shrink to one row so bind kills it.
		const {store, rows} = mountRowDoc('alpha\n\nbeta\n\n')
		const rowId = store.tokens.nodes()[1].id
		const handle = store.tokens.handle(rowId)
		if (!handle) throw new Error('expected handle for row 1')
		expect(handle.alive()).toBe(true)

		rows[1].unmount()
		store.tokens.setValue('alpha\n\n')

		expect(handle.alive()).toBe(false)
		// KILLED, not merely unbound, and `alive()` alone cannot tell the two apart — it is
		// false for both. Only an id absent from the TREE leaves the node layer; a token
		// deconsigned while the tree still owns it stays in the map, unbound.
		expect(store.tokens.handle(rowId)).toBeUndefined()
	})
})