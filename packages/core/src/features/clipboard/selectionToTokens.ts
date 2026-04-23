import type {Store} from '../../store'
import type {Token} from '../parsing'

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

/** Structural type shared by Range and StaticRange — only boundary properties are read. */
export interface RangeBoundary {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

/**
 * Returns the character offset of a range boundary within a container child.
 * Walks all text nodes in document order to compute a cumulative character
 * offset, which correctly handles nested marks with multiple text nodes.
 * Falls back to 0 (start) or full text length (end) for out-of-child boundaries.
 *
 * Spec: selectionToTokens.spec.ts (unit) · Clipboard.react.spec.tsx (integration)
 */
export function getBoundaryOffset(range: RangeBoundary, child: Element, isStart: boolean): number {
	const targetNode = isStart ? range.startContainer : range.endContainer
	const targetOffset = isStart ? range.startOffset : range.endOffset

	if (!child.contains(targetNode)) {
		return isStart ? 0 : child.textContent.length
	}

	let charOffset = 0
	const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT)
	// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
	let current = walker.nextNode() as Text | null
	while (current) {
		if (current === targetNode) {
			return charOffset + targetOffset
		}
		charOffset += current.length
		// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
		current = walker.nextNode() as Text | null
	}

	return isStart ? 0 : child.textContent.length
}

export interface SelectionTokenRange {
	tokens: Token[]
	/** Char offset within the first token where the selection starts. */
	startOffset: number
	/** Char offset within the last token where the selection ends. */
	endOffset: number
}

/**
 * Map a browser Selection to the subset of tokens it covers.
 * Returns null if selection is collapsed, empty, or outside the container.
 */
export function selectionToTokens(store: Store): SelectionTokenRange | null {
	const container = store.feature.slots.state.container()
	if (!container) return null

	const sel = window.getSelection()
	if (!sel || sel.isCollapsed || !sel.rangeCount) return null

	const range = sel.getRangeAt(0)

	if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
		return null
	}

	const tokens = store.feature.parsing.state.tokens()

	let startIndex = findContainerChildIndex(range.startContainer, container)
	let endIndex = findContainerChildIndex(range.endContainer, container)

	if (startIndex === -1 || endIndex === -1) return null

	if (startIndex > endIndex) {
		;[startIndex, endIndex] = [endIndex, startIndex]
	}

	const startChild = container.children.item(startIndex)
	const endChild = container.children.item(endIndex)

	return {
		tokens: tokens.slice(startIndex, endIndex + 1),
		startOffset: startChild ? getBoundaryOffset(range, startChild, true) : 0,
		endOffset: endChild ? getBoundaryOffset(range, endChild, false) : 0,
	}
}