/**
 * Unwrap a Vue component instance or HTMLElement ref callback argument to a
 * plain HTMLElement (or null). Vue 3 passes either the component instance
 * (with a `$el` property) or the raw element, depending on whether the
 * target is a component or a native element.
 */
export const unwrapEl = (el: unknown): HTMLElement | null => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- el is a Vue ref callback arg: component instance or raw element
	const ref = el as {$el?: HTMLElement} | HTMLElement | null
	// oxlint-disable-next-line no-unsafe-type-assertion -- narrowed by $el presence check above
	return (ref && '$el' in ref ? ref.$el : ref) as HTMLElement | null
}