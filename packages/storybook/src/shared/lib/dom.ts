import type {Locator} from 'vitest/browser'

export function getElement(locator: Locator): HTMLElement {
	const el = locator.element()
	if (el instanceof HTMLElement) return el
	throw new Error('Expected HTMLElement')
}

export function firstChild(element: Element): HTMLElement | null {
	const child = element.firstElementChild
	return child instanceof HTMLElement ? child : null
}

export function childAt(element: Element, index: number): HTMLElement | null {
	const child = element.children[index]
	return child instanceof HTMLElement ? child : null
}

export function childrenOf(element: Element): HTMLElement[] {
	return Array.from(element.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
}

export function getActiveElement(): HTMLElement | null {
	return document.activeElement instanceof HTMLElement ? document.activeElement : null
}

/**
 * THE editing host: the container. Under the single-host topology it is the only element
 * carrying `contenteditable`, so it is also the only element that can hold focus — every
 * `toHaveFocus()` in the browser suites resolves through here.
 */
export function editingHost(element: Element): HTMLElement {
	const host = element.closest<HTMLElement>('[contenteditable="true"]')
	if (!host) throw new Error('Expected an editing host ancestor')
	return host
}

/**
 * THE editing host inside a rendered tree, found by the attribute only it carries. Story
 * decorators wrap the editor in panels, so `container.firstElementChild` is not it.
 */
export function findEditingHost(root: ParentNode): HTMLElement {
	const host = root.querySelector<HTMLElement>('[contenteditable]')
	if (!host) throw new Error('Expected an editing host')
	return host
}

/**
 * The node the caret sits in. Element-anchored boundaries (the caret between two atomics,
 * or at a container edge) resolve to the child they point at — `startContainer` alone would
 * answer the container for those and lose the position entirely.
 */
export function caretNode(): Node | null {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return null
	const {startContainer, startOffset} = selection.getRangeAt(0)
	if (!(startContainer instanceof Element)) return startContainer
	// `Array.at`, not an index read: `noUncheckedIndexedAccess` is off, so `childNodes[i]`
	// types as `ChildNode` and the fallbacks below would be linted away as impossible.
	const children = Array.from(startContainer.childNodes)
	if (startOffset === 0) return children.at(0) ?? startContainer
	return children.at(startOffset) ?? children.at(startOffset - 1) ?? startContainer
}

/**
 * The caret oracle that replaced `activeElement` for row identity: focus is on the container
 * under one host, so "which row am I in" is a question only the selection can answer.
 */
export function caretIsInside(element: Element): boolean {
	const node = caretNode()
	return node !== null && element.contains(node)
}

/**
 * The text-token surfaces of an inline editor: the host's direct `<span>` children, minus the
 * value-only mark roots (`contenteditable="false"`). Text spans are bare now, so the old
 * `[contenteditable="true"]` enumeration answers the container instead of them.
 */
export function textSurfaces(host: Element): HTMLElement[] {
	return Array.from(host.querySelectorAll<HTMLElement>(':scope > span:not([contenteditable])'))
}