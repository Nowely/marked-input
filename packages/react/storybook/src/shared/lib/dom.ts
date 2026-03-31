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