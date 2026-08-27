/**
 * Unwrap a Vue ref-callback argument to a plain HTMLElement (or null). Vue 3
 * passes either the raw element (native target) or the component instance (with
 * a `$el` property), depending on whether the ref target is a native element or
 * a component.
 *
 * A COMPONENT'S `$el` IS NOT ALWAYS AN ELEMENT, and the case is reachable from a consumer's own
 * component: one that renders nothing has a Comment placeholder there, and a multi-root one has
 * the fragment's first node. Consigned, either reaches the mount-state write, which sets
 * attributes — a row kind whose component returned `null` threw
 * `tokenElement.removeAttribute is not a function` out of the ref callback, from inside Vue's own
 * patch. Nothing is registered instead, which is the truth about such a component: it painted no
 * element the editor can bind.
 */
export const unwrapEl = (el: unknown): HTMLElement | null => {
	if (el instanceof HTMLElement) return el
	// oxlint-disable-next-line no-unsafe-type-assertion -- a non-element ref arg is a Vue component instance; unwrap its $el
	const instance = el as {$el?: unknown} | null
	return instance?.$el instanceof HTMLElement ? instance.$el : null
}