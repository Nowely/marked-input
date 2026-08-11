import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../../store/Store'
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

function mountSurface(content: string) {
	const container = document.createElement('div')
	const span = document.createElement('span')
	span.textContent = content
	container.append(span)
	document.body.append(container)
	return {container, span}
}

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
			const row = document.createElement('div')
			const host = document.createElement('div')
			const node = textNodeOf('hello')
			const handle = new TokenHandle(1)
			expect(handle.node()).toBeUndefined()

			handle.bindElements({tokenElement: span, textElement: span, rowElement: row, childSequenceHost: host}, node)
			expect(handle.element()).toBe(span)
			expect(handle.node()).toEqual({
				tokenElement: span,
				textElement: span,
				rowElement: row,
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
			expect(handle.caretOnFirstLine()).toBe(true)
			expect(handle.caretOnLastLine()).toBe(true)

			const rect = handle.rect()
			const spanRect = span.getBoundingClientRect()
			expect(rect?.left).toBe(spanRect.left)
			expect(rect?.width).toBe(spanRect.width)
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
			handle.bindElements({tokenElement: span, textElement: span, rowElement: row}, textNodeOf('hello'))

			expect(handle.textLength()).toBe(6)
			expect(handle.rect()?.width).toBe(row.getBoundingClientRect().width)
		})

		it('returns inert defaults when nothing is bound', () => {
			const handle = new TokenHandle(1)

			expect(handle.hasTextSurface()).toBe(false)
			expect(handle.textLength()).toBe(0)
			expect(handle.caretIndex()).toBeUndefined()
			expect(handle.rect()).toBeUndefined()
			expect(handle.caretOnFirstLine()).toBe(true)
			expect(handle.caretOnLastLine()).toBe(true)
		})
	})

	describe('commands', () => {
		it('no-ops false when no elements are bound', () => {
			const handle = new TokenHandle(1)

			expect(handle.placeCaret(0)).toBe(false)
			expect(handle.placeCaretAtX(10, 10)).toBe(false)
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

		it('collapses to child boundaries on tokens without a text surface', () => {
			const container = document.createElement('div')
			const tokenElement = document.createElement('span')
			tokenElement.append(document.createElement('b'), document.createElement('i'))
			container.append(tokenElement)
			document.body.append(container)

			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement}, nodeOf(markToken('m', '@[m]', 0)))

			expect(handle.placeCaret(0)).toBe(true)
			let selection = window.getSelection()
			expect(selection?.anchorNode).toBe(tokenElement)
			expect(selection?.anchorOffset).toBe(0)

			expect(handle.placeCaret(1)).toBe(true)
			selection = window.getSelection()
			expect(selection?.anchorNode).toBe(tokenElement)
			expect(selection?.anchorOffset).toBe(tokenElement.childNodes.length)
		})

		it('focuses the scope element', () => {
			const {span} = mountSurface('hello')
			span.tabIndex = 0
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			expect(handle.focus()).toBe(true)
			expect(document.activeElement).toBe(span)
		})

		it('placeCaretAtX resolves a viewport point inside the scope', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1)
			handle.bindElements({tokenElement: span, textElement: span}, textNodeOf('hello'))

			const rect = span.getBoundingClientRect()
			expect(handle.placeCaretAtX(rect.left + 2, rect.top + rect.height / 2)).toBe(true)
			const selection = window.getSelection()
			expect(selection?.anchorNode && span.contains(selection.anchorNode)).toBe(true)
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
			expect(handle.placeCaretAtX(0)).toBe(false)
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
		const {store, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.alive()).toBe(true)
	})

	it('alive() is false once the handle is killed', () => {
		// Block layout: capture row 1's handle, then shrink to one row so bind kills it.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')
		const handle = store.tokens.handle(store.tokens.nodes()[1].id!)
		if (!handle) throw new Error('expected handle for row 1')
		const secondRow = container.children[1]
		if (!(secondRow instanceof HTMLElement)) throw new Error('expected HTMLElement')
		secondRow.remove()
		store.tokens.setValue('alpha\n\n')
		store.host.rendered()
		expect(handle.alive()).toBe(false)
	})
})