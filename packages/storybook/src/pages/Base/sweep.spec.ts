import {describe, expect, it} from 'vitest'
import {userEvent} from 'vitest/browser'

import {rowsOf} from '../../shared/lib/dom'
import {settle} from '../../shared/lib/focus'
import {composePage, mountEcho} from '../../shared/lib/page'
import {pointIn, sweepBetween} from '../../shared/lib/sweep'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

const FIVE = 'one row here\ntwo rows here\nthree rows here\nfour rows here\nfive rows here'

/** What the user can see is selected, which is the only reading a sweep can be judged by. */
const selected = () => window.getSelection()?.toString() ?? ''

async function sweepRows(host: HTMLElement, from: number, to: number) {
	const rows = rowsOf(host)
	await sweepBetween(pointIn(rows[from], 0.5), pointIn(rows[to], 0.5))
	await settle()
}

/**
 * A MOUSE SWEEP, IN BOTH DIRECTIONS. The editor could not select backwards with a mouse: press in
 * a paragraph and drag UPWARD past a row boundary and the selection collapsed to a caret, so a
 * sweep up over five rows followed by Backspace killed one character. Downward drags, Shift+click,
 * Shift+Arrow and `setBaseAndExtent` all worked, which is what kept it invisible for eleven
 * sessions of driving and for a whole test corpus: no test in it ever held the button down.
 *
 * THE CAUSE was the editor's own write-back. Every `mousemove` produces a `selectionchange`, the
 * driver stores the pair — document-ordered, since a DOM `Range` has no direction — and applies it
 * again through `addRange`, which can only make a FORWARD selection. That moved the selection's
 * BASE to the low end, which for an upward drag is the point under the pointer, so the next move
 * extended from there and the extent never grew. `placeRangeAcrossBoundaries` now leaves a pair
 * the DOM already holds alone, in either direction.
 *
 * DRIVEN, never assembled: every case here presses, moves and releases through the browser's own
 * input layer ({@link sweepBetween}). A case that built the same selection with `setBaseAndExtent`
 * would be green against the defect, which is exactly what the corpus was.
 *
 * Framework-free: the driver is core's and both adapters paint the same rows.
 */
describe('a mouse sweep', () => {
	it('selects the rows it crosses going DOWN', async () => {
		const {host} = await mountEcho(Default, {value: FIVE, separator: '\n'})

		await sweepRows(host, 0, 4)

		expect(selected()).toContain('two rows here')
		expect(selected()).toContain('four rows here')
	})

	it('selects the rows it crosses going UP', async () => {
		const {host} = await mountEcho(Default, {value: FIVE, separator: '\n'})

		await sweepRows(host, 4, 0)

		expect(selected()).toContain('two rows here')
		expect(selected()).toContain('four rows here')
	})

	/**
	 * ONE ROW is the case that always worked, and it is here to say what the boundary crossing
	 * costs rather than the direction: the write-back only re-seated the base where the pair
	 * spanned two rows, so an upward sweep inside a single row grew normally.
	 */
	it('selects backwards inside one row', async () => {
		const {host} = await mountEcho(Default, {value: FIVE, separator: '\n'})
		const row = rowsOf(host)[2]

		await sweepBetween(pointIn(row, 0.9), pointIn(row, 0.1))
		await settle()

		expect(selected().length).toBeGreaterThan(0)
		expect('three rows here').toContain(selected())
	})

	/**
	 * AND THE EDIT TAKES WHAT THE SWEEP SHOWED. The report was not "the highlight is missing" but
	 * "Backspace killed one character": a collapsed selection is a caret, and the key that follows
	 * acts on it. This is the pin that would have failed for the user.
	 */
	it('deletes everything an upward sweep covered', async () => {
		const {host, value} = await mountEcho(Default, {value: FIVE, separator: '\n'})

		await sweepRows(host, 4, 0)
		await userEvent.keyboard('{Backspace}')

		// The two halves the sweep left join into ONE row; which characters survive is a metric
		// of the font, so the assertion is on the rows rather than on the string.
		await expect.poll(() => value().split('\n').length).toBe(1)
		expect(value()).not.toContain('two rows here')
		expect(value()).not.toContain('four rows here')
	})
})