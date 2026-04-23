import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../store'
import type {Token} from '../parsing'
import {selectionToTokens, getBoundaryOffset} from './selectionToTokens'

// NOTE: The core package runs under vitest's browser environment (Playwright/Chromium).
// Real DOM APIs (window.getSelection, document.createTreeWalker, etc.) are available.
// The mock DOM tests below validate the tree-walk algorithm independently.
// The selectionToTokens tests use real browser APIs to cover the actual DOM path.

// ---------------------------------------------------------------------------
// Minimal DOM mock — supports the subset of DOM APIs used by getBoundaryOffset:
//   Node / Text / HTMLElement creation, appendChild, contains, createTreeWalker
// ---------------------------------------------------------------------------

class MockNode {
	readonly childNodes: MockNode[] = []
	parentNode: MockNode | null = null

	appendChild(child: MockNode): MockNode {
		child.parentNode = this
		this.childNodes.push(child)
		return child
	}

	contains(node: MockNode | null): boolean {
		if (!node) return false
		// oxlint-disable-next-line no-this-alias
		let current: MockNode | null = node
		while (current) {
			if (current === this) return true
			current = current.parentNode
		}
		return false
	}
}

class MockText extends MockNode {
	readonly nodeType = 3
	constructor(public data: string) {
		super()
	}
	get length(): number {
		return this.data.length
	}
}

class MockElement extends MockNode {
	readonly nodeType = 1
	constructor(public tagName: string) {
		super()
	}
}

/** Collect all text nodes in document order via a simple recursive walk. */
function textNodesInOrder(node: MockNode): MockText[] {
	const result: MockText[] = []
	function walk(n: MockNode) {
		if (n instanceof MockText) {
			result.push(n)
		}
		for (const child of n.childNodes) {
			walk(child)
		}
	}
	walk(node)
	return result
}

// ---------------------------------------------------------------------------
// computeOffset — mirrors the getBoundaryOffset algorithm from selectionToTokens.ts
// ---------------------------------------------------------------------------

function computeOffset(child: MockElement, targetNode: MockNode, targetOffset: number): number {
	if (!child.contains(targetNode)) {
		return 0
	}
	let charOffset = 0
	for (const text of textNodesInOrder(child)) {
		if (text === targetNode) {
			return charOffset + targetOffset
		}
		charOffset += text.length
	}
	return 0
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a mock element containing multiple text nodes (simulating a nested mark).
 * Returns [element, t1 ("hello"), t2 (" world")].
 * DOM structure: <span>"hello"<em>" world"</em></span>
 */
function makeNestedElement(): [MockElement, MockText, MockText] {
	const el = new MockElement('span')
	const t1 = new MockText('hello')
	const inner = new MockElement('em')
	const t2 = new MockText(' world')
	inner.appendChild(t2)
	el.appendChild(t1)
	el.appendChild(inner)
	return [el, t1, t2]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getBoundaryOffset (cumulative text walk)', () => {
	it('returns correct offset when boundary is in first text node', () => {
		const [el, t1] = makeNestedElement()
		// Boundary in t1 ("hello") at offset 2 → "he"
		expect(computeOffset(el, t1, 2)).toBe(2)
	})

	it('returns correct cumulative offset when boundary is in second text node', () => {
		const [el, , t2] = makeNestedElement()
		// t1 = "hello" (5 chars), boundary in t2 (" world") at offset 3 → 5 + 3 = 8
		expect(computeOffset(el, t2, 3)).toBe(8)
	})

	it('returns 0 when target node is not inside child', () => {
		const [el] = makeNestedElement()
		const outsideNode = new MockText('outside')
		expect(computeOffset(el, outsideNode, 0)).toBe(0)
	})

	it('returns full offset at end of second text node', () => {
		const [el, , t2] = makeNestedElement()
		// t2 = " world" (6 chars), end boundary at offset 6 → 5 + 6 = 11
		expect(computeOffset(el, t2, t2.length)).toBe(11)
	})
})

// ---------------------------------------------------------------------------
// getBoundaryOffset — real browser DOM tests
// ---------------------------------------------------------------------------

describe('getBoundaryOffset (real DOM)', () => {
	afterEach(() => {
		while (document.body.lastChild && document.body.lastChild !== document.body.firstChild) {
			document.body.removeChild(document.body.lastChild)
		}
	})

	it('returns correct offset for a text node inside an element', () => {
		const el = document.createElement('span')
		const text = document.createTextNode('hello world')
		el.appendChild(text)
		document.body.appendChild(el)

		expect(
			getBoundaryOffset({startContainer: text, startOffset: 3, endContainer: text, endOffset: 8}, el, true)
		).toBe(3)
		expect(
			getBoundaryOffset({startContainer: text, startOffset: 0, endContainer: text, endOffset: 8}, el, false)
		).toBe(8)
	})

	it('returns correct cumulative offset for nested text nodes', () => {
		const el = document.createElement('span')
		const t1 = document.createTextNode('hello')
		const inner = document.createElement('em')
		const t2 = document.createTextNode(' world')
		inner.appendChild(t2)
		el.appendChild(t1)
		el.appendChild(inner)
		document.body.appendChild(el)

		// t1 = "hello" (5 chars), offset in t2 at 3 → 5 + 3 = 8
		expect(getBoundaryOffset({startContainer: t2, startOffset: 3, endContainer: t2, endOffset: 6}, el, true)).toBe(
			8
		)
		expect(getBoundaryOffset({startContainer: t2, startOffset: 3, endContainer: t2, endOffset: 6}, el, false)).toBe(
			11
		)
	})

	it('returns 0 for isStart when target node is outside child', () => {
		const el = document.createElement('span')
		el.textContent = 'inside'
		document.body.appendChild(el)

		const outside = document.createTextNode('outside')
		document.body.appendChild(outside)

		expect(
			getBoundaryOffset({startContainer: outside, startOffset: 0, endContainer: outside, endOffset: 3}, el, true)
		).toBe(0)
	})

	it('returns text length for isEnd when target node is outside child', () => {
		const el = document.createElement('span')
		el.textContent = 'inside'
		document.body.appendChild(el)

		const outside = document.createTextNode('outside')
		document.body.appendChild(outside)

		expect(
			getBoundaryOffset({startContainer: outside, startOffset: 0, endContainer: outside, endOffset: 3}, el, false)
		).toBe(6)
	})
})

// ---------------------------------------------------------------------------
// selectionToTokens(Store) — real browser DOM tests
// ---------------------------------------------------------------------------

function createTestStore(tokens: Token[]): {store: Store; container: HTMLDivElement} {
	const store = new Store()
	const container = document.createElement('div')
	document.body.appendChild(container)

	store.feature.slots.container(container)
	store.feature.parsing.tokens(tokens)

	return {store, container}
}

function setSelection(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
	const sel = window.getSelection()!
	sel.removeAllRanges()
	const range = document.createRange()
	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)
	sel.removeAllRanges()
	sel.addRange(range)
}

function clearSelection() {
	const sel = window.getSelection()
	if (sel) sel.removeAllRanges()
}

describe('selectionToTokens(Store)', () => {
	afterEach(() => {
		clearSelection()
		while (document.body.lastChild && document.body.lastChild !== document.body.firstChild) {
			document.body.removeChild(document.body.lastChild)
		}
	})

	it('returns null when container is not set', () => {
		const store = new Store()
		expect(selectionToTokens(store)).toBeNull()
	})

	it('returns null when there is no selection', () => {
		clearSelection()
		const {store} = createTestStore([])
		expect(selectionToTokens(store)).toBeNull()
	})

	it('returns null when selection is collapsed', () => {
		const {store, container} = createTestStore([])
		container.textContent = 'hello'
		document.body.appendChild(container)
		setSelection(container.firstChild!, 2, container.firstChild!, 2)
		expect(selectionToTokens(store)).toBeNull()
	})

	it('returns null when selection is outside container', () => {
		const {store} = createTestStore([])
		const outside = document.createElement('div')
		outside.textContent = 'outside'
		document.body.appendChild(outside)

		setSelection(outside.firstChild!, 0, outside.firstChild!, 3)
		expect(selectionToTokens(store)).toBeNull()
	})

	it('returns single text token for a pure-text selection', () => {
		const token: Token = {type: 'text', content: 'hello world', position: {start: 0, end: 11}}
		const {store, container} = createTestStore([token])

		const span = document.createElement('span')
		span.textContent = 'hello world'
		container.appendChild(span)

		setSelection(span.firstChild!, 0, span.firstChild!, 5)

		const result = selectionToTokens(store)
		expect(result).not.toBeNull()
		expect(result!.tokens).toEqual([token])
		expect(result!.startOffset).toBe(0)
		expect(result!.endOffset).toBe(5)
	})

	it('returns multiple tokens spanning selection across children', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'hello ', position: {start: 0, end: 6}},
			{type: 'text', content: 'world', position: {start: 6, end: 11}},
		]
		const {store, container} = createTestStore(tokens)

		const span1 = document.createElement('span')
		span1.textContent = 'hello '
		const span2 = document.createElement('span')
		span2.textContent = 'world'
		container.appendChild(span1)
		container.appendChild(span2)

		setSelection(span1.firstChild!, 2, span2.firstChild!, 3)

		const result = selectionToTokens(store)
		expect(result).not.toBeNull()
		expect(result!.tokens).toEqual(tokens)
		expect(result!.startOffset).toBe(2)
		expect(result!.endOffset).toBe(3)
	})

	it('handles partial selection within a single child', () => {
		const token: Token = {type: 'text', content: 'abcdef', position: {start: 0, end: 6}}
		const {store, container} = createTestStore([token])

		const span = document.createElement('span')
		span.textContent = 'abcdef'
		container.appendChild(span)

		setSelection(span.firstChild!, 1, span.firstChild!, 4)

		const result = selectionToTokens(store)
		expect(result).not.toBeNull()
		expect(result!.tokens).toEqual([token])
		expect(result!.startOffset).toBe(1)
		expect(result!.endOffset).toBe(4)
	})

	it('handles selection within nested mark elements', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'before ', position: {start: 0, end: 7}},
			{
				type: 'mark',
				content: '@[John](john)',
				position: {start: 7, end: 20},
				descriptor: {
					markup: '@[__value__](__meta__)',
					index: 0,
					segments: ['@[', '](', ')'],
					gapTypes: ['value' as const, 'meta' as const],
					hasSlot: false,
					hasTwoValues: false,
					segmentGlobalIndices: [],
				},
				value: 'John',
				meta: 'john',
				children: [],
			},
		]
		const {store, container} = createTestStore(tokens)

		const span1 = document.createElement('span')
		span1.textContent = 'before '
		const span2 = document.createElement('span')
		const markInner = document.createElement('em')
		markInner.textContent = 'John'
		span2.appendChild(markInner)
		container.appendChild(span1)
		container.appendChild(span2)

		setSelection(span1.firstChild!, 3, markInner.firstChild!, 2)

		const result = selectionToTokens(store)
		expect(result).not.toBeNull()
		expect(result!.tokens).toEqual(tokens)
		expect(result!.startOffset).toBe(3)
		expect(result!.endOffset).toBe(2)
	})
})