/** Type guard: checks if a value is an HTMLElement. */
export function isHtmlElement(el: unknown): el is HTMLElement {
	return typeof HTMLElement !== 'undefined' && el instanceof HTMLElement
}

/** Get all children of an element as HTMLElement[], filtering out non-HTML elements. */
export function htmlChildren(parent: Element | null | undefined): HTMLElement[] {
	if (!parent) return []
	return Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
}

/** Get the first element child as HTMLElement, or null. */
export function firstHtmlChild(parent: Element | null | undefined): HTMLElement | null {
	const child = parent?.firstElementChild
	return child instanceof HTMLElement ? child : null
}

/** Safely narrow an event's target to Node. */
export function nodeTarget(event: {target: EventTarget | null}): Node | null {
	const {target} = event
	return target instanceof Node ? target : null
}

/** Get the next node from a TreeWalker as Text, or null. */
export function nextText(walker: TreeWalker): Text | null {
	const node = walker.nextNode()
	// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text; instanceof Text breaks in test envs
	return node?.nodeType === 3 ? (node as Text) : null
}