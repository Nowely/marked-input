/**
 * Returns true when `target` is outside `element` (i.e. not contained by it).
 * Useful for closing a menu when the user clicks outside of it.
 */
export function isClickOutside(target: EventTarget | null, element: Element | null): boolean {
	return !!element && !element.contains(target instanceof Node ? target : null)
}

/**
 * Returns true when the keyboard event is the Escape key.
 */
export function isEscapeKey(e: KeyboardEvent): boolean {
	return e.key === 'Escape'
}