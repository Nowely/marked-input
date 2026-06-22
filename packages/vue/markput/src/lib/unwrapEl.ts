/**
 * Unwrap a Vue ref-callback argument to a plain HTMLElement (or null). Vue 3
 * passes either the raw element (native target) or the component instance (with
 * a `$el` property), depending on whether the ref target is a native element or
 * a component.
 */
export const unwrapEl = (el: unknown): HTMLElement | null => {
	if (el instanceof HTMLElement) return el
	// oxlint-disable-next-line no-unsafe-type-assertion -- a non-element ref arg is a Vue component instance; unwrap its $el
	const instance = el as {$el?: HTMLElement} | null
	return instance?.$el ?? null
}