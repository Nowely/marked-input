/** The box a popup hangs off, in VIEWPORT coordinates — a caret rect, or a grip's button rect. */
export interface PopupAnchor {
	top: number
	bottom: number
	left: number
}

/**
 * WHERE A POPUP GOES, and the one answer for both of them: the overlay list hanging off the caret
 * and the row menu hanging off the grip.
 *
 * BELOW THE ANCHOR IS THE PREFERENCE, NOT THE RULE. Both popups used to be positioned by
 * `anchor.bottom + gap` and nothing else, so at the bottom of a page a menu was measured at
 * top 836 with height 196 in a 900px viewport — two thirds of it below the fold, with no way to
 * reach the entries it was hiding. A popup that does not fit below FLIPS above, and one that fits
 * neither way is clamped into the viewport rather than left hanging off it.
 *
 * `size` is what the popup CURRENTLY MEASURES, which is `{0, 0}` until it has mounted — the
 * caller reads it off the element it has just handed the previous answer to. Nothing measured
 * means nothing to fit, so the unflipped anchor is what the first paint uses and the mount's own
 * signal write re-runs this with a size. That is a frame, not a flash: both adapters attach the
 * popup ref in the commit phase, before paint.
 */
export function fitPopup(
	anchor: PopupAnchor,
	size: {width: number; height: number},
	viewport: {width: number; height: number},
	gap: number
): {left: number; top: number} {
	const below = anchor.bottom + gap
	if (size.height <= 0) return {left: anchor.left, top: below}

	const above = anchor.top - gap - size.height
	// Neither side fits — clamp the preferred one instead of flipping into a worse overflow.
	const top =
		below + size.height <= viewport.height || above < 0
			? Math.min(below, Math.max(0, viewport.height - size.height))
			: above

	return {left: Math.min(anchor.left, Math.max(0, viewport.width - size.width)), top}
}

/** The live viewport, as {@link fitPopup} takes it. */
export function windowViewport(): {width: number; height: number} {
	return {width: window.innerWidth, height: window.innerHeight}
}

/** What an element currently measures, or nothing at all when it has not mounted. */
export function popupSize(element: HTMLElement | null): {width: number; height: number} {
	if (!element) return {width: 0, height: 0}
	const rect = element.getBoundingClientRect()
	return {width: rect.width, height: rect.height}
}