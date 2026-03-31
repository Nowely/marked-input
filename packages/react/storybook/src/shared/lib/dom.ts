import type {Locator} from 'vitest/browser'

// oxlint-disable-next-line no-unsafe-type-assertion
/** Narrow Locator.element() (HTMLElement | SVGElement) to HTMLElement */
export function getElement(locator: Locator): HTMLElement {
	return locator.element() as HTMLElement
}

// oxlint-disable-next-line no-unsafe-type-assertion
/** Typed firstElementChild -> HTMLElement | null */
export function firstChild(element: Element): HTMLElement | null {
	return element.firstElementChild as HTMLElement | null
}

// oxlint-disable-next-line no-unsafe-type-assertion
/** Typed children[index] -> HTMLElement | null */
export function childAt(element: Element, index: number): HTMLElement | null {
	return element.children[index] as HTMLElement | null
}

// oxlint-disable-next-line no-unsafe-type-assertion
/** Typed children -> HTMLElement[] */
export function childrenOf(element: Element): HTMLElement[] {
	return Array.from(element.children) as HTMLElement[]
}

// oxlint-disable-next-line no-unsafe-type-assertion
/** Typed document.activeElement -> HTMLElement | null */
export function getActiveElement(): HTMLElement | null {
	return document.activeElement as HTMLElement | null
}