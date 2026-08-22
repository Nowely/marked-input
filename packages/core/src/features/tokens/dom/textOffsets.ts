import {nextText} from '../../../shared/checkers'

function splitsSurrogatePair(text: string, offset: number): boolean {
	if (offset <= 0 || offset >= text.length) return false
	const prev = text.charCodeAt(offset - 1)
	const next = text.charCodeAt(offset)
	return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
}

export function textOffsetWithin(surface: HTMLElement, node: Node, offset: number): number | undefined {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? ''
		if (splitsSurrogatePair(text, offset)) return undefined
		return node instanceof Text ? textOffsetFromTreeWalker(surface, node, offset) : undefined
	}

	if (node === surface) return elementBoundaryOffset(surface, offset)
	return undefined
}

function textOffsetFromTreeWalker(surface: HTMLElement, target: Text, targetOffset: number): number | undefined {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextText(walker)
	while (current) {
		if (current === target) return total + targetOffset
		total += current.length
		current = nextText(walker)
	}
	return undefined
}

export function textLength(surface: HTMLElement): number {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextText(walker)
	while (current) {
		total += current.length
		current = nextText(walker)
	}
	return total
}

function elementBoundaryOffset(surface: HTMLElement, offset: number): number | undefined {
	if (offset <= 0) return 0
	if (offset >= surface.childNodes.length) return textLength(surface)

	let total = 0
	for (let i = 0; i < offset; i++) {
		const child = surface.childNodes.item(i)
		if (child.nodeType === Node.TEXT_NODE && child instanceof Text) {
			total += child.length
			continue
		}
		if (child instanceof HTMLElement) total += textLength(child)
	}
	return total
}

/**
 * A CONSUMER'S OWN editable island between `node` and `boundary` — the one thing inside a mark
 * that owns its caret, and the only reason this projection declines a boundary there.
 *
 * The `contentEditable` PROPERTY, never `isContentEditable`, which is the same rule
 * `keyboard/beforeInput.ts`'s `inExplicitEditableIsland` states and for the same reason: a slot
 * mark's root, its slot host and every element the consumer renders between them go BARE
 * (`bind.ts`'s `applyEditableState`), so they INHERIT `true` from the container. Reading the
 * inherited flag therefore answered true for a mark's own presentation and declined every
 * boundary on it — see `domBoundary.spec`'s "answers a mark EDGE on a slot mark presentation
 * that is merely INHERITED-editable".
 */
export function hasEditableAncestorBefore(node: Node, boundary: HTMLElement): boolean {
	let current = node instanceof HTMLElement ? node : node.parentElement
	while (current && current !== boundary) {
		if (current.contentEditable === 'true' || current.contentEditable === 'plaintext-only') {
			return true
		}
		current = current.parentElement
	}
	return false
}