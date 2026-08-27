import {cdp} from 'vitest/browser'

// `CDPSession` ships as an EMPTY interface for a provider to fill in, so the one command this file
// sends is declared here. Narrow on purpose: it is the harness's whole vocabulary.
declare module 'vitest/internal/browser' {
	interface CDPSession {
		send(
			method: 'Input.dispatchMouseEvent',
			params: {type: string; x: number; y: number; button: string; buttons: number; clickCount: number}
		): Promise<unknown>
	}
}

/** A VIEWPORT coordinate — what every point this harness takes and passes on is. */
export type Point = {x: number; y: number}

/**
 * A TEXT SWEEP — the button held down and the pointer moved — driven at the browser's own input
 * layer, because nothing above it can express the gesture. Press at `from`, move to `to` in
 * `steps` moves with the button down, release.
 *
 * `userEvent` has no press-move-release: `click` is a down and an up at one point, `hover` moves
 * with no button, and `dragAndDrop` is the HTML5 drag protocol, which is a different gesture the
 * browser answers with a `dragstart` rather than with a growing selection. So the whole corpus
 * dispatched `mousemove` exactly twice, neither of them beginning a selection, and every backward
 * selection in it was a `setBaseAndExtent`, a Shift+click or a Shift+Arrow — a gesture the suite
 * had no vocabulary for is a gesture the suite cannot regress-test, and an upward mouse drag
 * selecting nothing shipped under a green suite because of it.
 *
 * `Input.dispatchMouseEvent` is the same entry point Playwright's own mouse uses, so the browser
 * decides what the gesture selects exactly as it does for a person. Nothing here reads or writes a
 * `Selection`: a sweep this file performed with `setBaseAndExtent` would pin the write rather than
 * the gesture, which is precisely the blind spot it exists to close.
 *
 * SEVERAL MOVES, not one: the defect this harness was built for is in what each move does to the
 * selection's own base, so a sweep that arrives in a single jump measures a different gesture.
 */
export async function sweepBetween(from: Point, to: Point, steps = 10): Promise<void> {
	const session = cdp()
	const send = (type: 'mouseMoved' | 'mousePressed' | 'mouseReleased', at: Point, buttons: number) =>
		session.send('Input.dispatchMouseEvent', {
			type,
			x: at.x,
			y: at.y,
			button: 'left',
			buttons,
			clickCount: type === 'mouseMoved' ? 0 : 1,
		})

	await send('mouseMoved', from, 0)
	await send('mousePressed', from, 1)
	for (let step = 1; step <= steps; step++) {
		await send('mouseMoved', between(from, to, step / steps), 1)
	}
	await send('mouseReleased', to, 0)
}

/**
 * A viewport point `fraction` of the way across `element`'s own TEXT, vertically centred.
 *
 * The text's box rather than the element's, because a row is a full-width block and its text is
 * not: half way across the BOX is past the end of the line on every short row, where a press
 * lands at the row's last position and a sweep that should have covered half the row covers
 * none of it.
 */
export function pointIn(element: HTMLElement, fraction: number): Point {
	const contents = document.createRange()
	contents.selectNodeContents(element)
	const box = contents.getBoundingClientRect()
	return {x: box.left + box.width * fraction, y: box.top + box.height / 2}
}

function between(from: Point, to: Point, ratio: number): Point {
	return {x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio}
}