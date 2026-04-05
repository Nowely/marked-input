import type {Token} from '../parsing'
import type {Store} from '../store'

/**
 * Walk up the DOM from `node` until reaching a direct child of `container`.
 * Returns the index of that child in container.children, or -1 if not found.
 *
 * Works for both drag and non-drag modes:
 * - Non-drag: container children are Token-rendered elements (1:1 with tokens)
 * - Drag: container children are Block wrappers (1:1 with tokens)
 * - Nested marks: walks past inner mark elements to the top-level container child
 */
function findContainerChildIndex(node: Node, container: HTMLElement): number {
	let current: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement
	while (current && current.parentElement !== container) {
		current = current.parentElement
	}
	if (!current) return -1
	return Array.from(container.children).indexOf(current)
}

/**
 * Check whether the selection range fully covers a container child element
 * at the given boundary (start or end).
 *
 * Uses text-node-level ranges for comparison because browser selections
 * resolve to text nodes, while selectNodeContents resolves to the element —
 * making compareBoundaryPoints mismatch.
 */
function isBoundaryFullyCovered(range: Range, container: HTMLElement, childIndex: number, isStart: boolean): boolean {
	const child = container.children.item(childIndex)
	if (!child) return false

	// Find the first and last text nodes inside the child
	const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT)
	const firstText = walker.nextNode()
	if (!firstText) return false

	let lastText = firstText
	while (walker.nextNode()) {
		lastText = walker.currentNode
	}

	const fullRange = document.createRange()
	fullRange.setStart(firstText, 0)
	fullRange.setEnd(lastText, lastText.textContent?.length ?? 0)

	if (isStart) {
		return range.compareBoundaryPoints(Range.START_TO_START, fullRange) <= 0
	}
	return range.compareBoundaryPoints(Range.END_TO_END, fullRange) >= 0
}

export interface SelectionTokenRange {
	tokens: Token[]
	firstFullySelected: boolean
	lastFullySelected: boolean
}

/**
 * Map a browser Selection to the subset of tokens it covers.
 * Reports whether boundary tokens are fully covered by the selection.
 * Returns null if selection is collapsed, empty, or outside the container.
 */
export function selectionToTokens(store: Store): SelectionTokenRange | null {
	const container = store.refs.container
	if (!container) return null

	const sel = window.getSelection()
	if (!sel || sel.isCollapsed || !sel.rangeCount) return null

	const range = sel.getRangeAt(0)

	if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
		return null
	}

	const tokens = store.state.tokens.get()

	let startIndex = findContainerChildIndex(range.startContainer, container)
	let endIndex = findContainerChildIndex(range.endContainer, container)

	if (startIndex === -1 || endIndex === -1) return null

	if (startIndex > endIndex) {
		;[startIndex, endIndex] = [endIndex, startIndex]
	}

	const selectedTokens = tokens.slice(startIndex, endIndex + 1)

	return {
		tokens: selectedTokens,
		firstFullySelected: isBoundaryFullyCovered(range, container, startIndex, true),
		lastFullySelected: isBoundaryFullyCovered(range, container, endIndex, false),
	}
}