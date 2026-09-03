import {describe, expect, it} from 'vitest'

import {fitPopup} from './fitPopup'

const VIEWPORT = {width: 1200, height: 900}

/** A caret-sized anchor whose bottom is `bottom`. */
const caretAt = (bottom: number, left = 100) => ({top: bottom - 16, bottom, left})

describe('fitPopup', () => {
	it('hangs the popup under the anchor when it fits there', () => {
		expect(fitPopup(caretAt(200), {width: 180, height: 196}, VIEWPORT, 1)).toEqual({left: 100, top: 201})
	})

	/**
	 * THE MEASURED DEFECT: a menu at top 836 with height 196 in a 900px viewport, two thirds of it
	 * below the fold. Above the anchor it fits whole.
	 */
	it('flips above the anchor when the space below cannot hold it', () => {
		expect(fitPopup(caretAt(836), {width: 180, height: 196}, VIEWPORT, 1)).toEqual({left: 100, top: 623})
	})

	/** Neither side holds it: clamp the preferred side rather than flip into a worse overflow. */
	it('clamps into the viewport when it fits neither way', () => {
		expect(fitPopup(caretAt(500), {width: 180, height: 880}, VIEWPORT, 1)).toEqual({left: 100, top: 20})
	})

	it('pulls a popup that would overflow the right edge back inside it', () => {
		expect(fitPopup(caretAt(200, 1150), {width: 180, height: 100}, VIEWPORT, 1)).toEqual({left: 1020, top: 201})
	})

	/**
	 * NOTHING MEASURED IS NOT A DECISION. The popup has not mounted, so there is no box to fit and
	 * the plain anchor is what the first paint uses — the behaviour every popup had before the
	 * flip existed, which is what keeps a popup that fits from moving at all.
	 */
	it('returns the plain anchor while the popup has no measured size', () => {
		expect(fitPopup(caretAt(836), {width: 0, height: 0}, VIEWPORT, 4)).toEqual({left: 100, top: 840})
	})

	/** The gap is the caller's: 1px under a caret, 4px under a grip button. */
	it('takes the gap from the caller on both sides of the flip', () => {
		expect(fitPopup(caretAt(836), {width: 180, height: 196}, VIEWPORT, 4).top).toBe(620)
	})
})