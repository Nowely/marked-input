import {page, userEvent} from 'vitest/browser'

/**
 * THE ROW DRAG, DRIVEN BY THE BROWSER — one place, because every spec that fabricated its own
 * ended up blind in the same two ways and neither is visible by reading the file.
 *
 * WHAT A FABRICATED DRAG CANNOT SEE. A hand-built `dragstart`/`dragover`/`drop` triple hands the
 * same `DataTransfer` object to all three, which no browser ever does — the target gets a
 * protected store whose `getData` answers `''` — and it skips Chromium's own
 * `dragenter`/`dropEffect` negotiation, which refuses a drop whose last accepted operation was
 * `none`. Neither hid a defect on its own. What did was the third thing: a synthetic event carries
 * only the coordinates the author remembered to set, and `Drag.spec.ts` set `clientY` alone. The
 * drop depth is the pointer's `clientX`, so every drop that file made resolved to the shallowest
 * candidate and the suite was structurally incapable of nesting a row at all — which is how a drag
 * that wrote a row into a parent that paints none of its children shipped under a green suite.
 *
 * A real drag has no such half. It is `userEvent.dragAndDrop`, which is Playwright's own
 * `Input.dispatchDragEvent` sequence: real pointer positions, a real protected payload, and the
 * browser deciding whether the drop happens at all.
 */

/** The grip's accessible name — one of the two gutter controls the editor's controls layer paints. */
export const GRIP = {name: 'Drag to reorder or click for options'} as const

/** The other one: the gutter's `+`, which runs the menu's first entry on the hovered row. */
export const ADD_ROW = {name: 'Add a row below'} as const

/**
 * The grip for `row`. It lives in the controls layer rather than inside the row, so it is found on
 * the HOST and follows the pointer: hovering a row is what puts the grip on that row.
 */
export async function gripOfRow(host: HTMLElement, row: HTMLElement) {
	await userEvent.hover(row)
	return page.elementLocator(host).getByRole('button', GRIP)
}

/**
 * A whole drag of `from`'s row, released at the VIEWPORT point `{clientX, clientY}`.
 *
 * BOTH COORDINATES, because the drop reads both and they answer different questions: the Y names
 * the gap between two lines, the X names the depth inside that gap. The point is given in viewport
 * coordinates and handed to Playwright relative to `target`, which may be any element the point
 * falls in or near — the release lands where the pointer is, not where the element is.
 */
export async function dragRowTo(
	host: HTMLElement,
	from: HTMLElement,
	target: HTMLElement,
	{clientX, clientY}: {clientX: number; clientY: number}
) {
	const grip = await gripOfRow(host, from)
	const box = target.getBoundingClientRect()
	await userEvent.dragAndDrop(grip, page.elementLocator(target), {
		targetPosition: {x: clientX - box.left, y: clientY - box.top},
	})
}