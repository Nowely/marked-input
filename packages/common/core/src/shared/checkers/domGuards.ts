/** Type guard: checks if a value is an HTMLElement. */
export function isHtmlElement(el: unknown): el is HTMLElement {
	return typeof HTMLElement !== 'undefined' && el instanceof HTMLElement
}

/** Type guard: checks if a value is a Text node. */
export function isTextNode(node: unknown): node is Text {
	return node instanceof Text
}

/** Get the i-th child of an element as HTMLElement, or undefined if out of bounds or wrong type. */
export function childAt(parent: Element | null | undefined, index: number): HTMLElement | undefined {
	const child = parent?.children[index]
	return child instanceof HTMLElement ? child : undefined
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

/** Get the last element child as HTMLElement, or null. */
export function lastHtmlChild(parent: Element | null | undefined): HTMLElement | null {
	const child = parent?.lastElementChild
	return child instanceof HTMLElement ? child : null
}

/** Safely narrow an event's target to HTMLElement. */
export function htmlTarget(event: {target: EventTarget | null}): HTMLElement | null {
	const {target} = event
	return target instanceof HTMLElement ? target : null
}

/** Safely narrow an event's target to Node. */
export function nodeTarget(event: {target: EventTarget | null}): Node | null {
	const {target} = event
	return target instanceof Node ? target : null
}

/** Get the next node from a TreeWalker as Text, or null. */
export function nextText(walker: TreeWalker): Text | null {
	const node = walker.nextNode()
	return node?.nodeType === 3 ? (node as Text) : null
}