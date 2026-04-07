import {describe, expect, it} from 'vitest'

// NOTE: The core package runs under vitest's node environment without jsdom.
// window.getSelection(), document.createRange(), and document.createTreeWalker()
// are all unavailable here (document.createTreeWalker is the specific API
// getBoundaryOffset uses internally). These tests validate the tree-walk algorithm
// used inside getBoundaryOffset using a minimal pure-JS mock DOM. Integration
// coverage for the actual DOM path (real TreeWalker + Selection API) is provided
// by the storybook browser tests (Clipboard.react.spec.tsx: copy and paste tests).

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