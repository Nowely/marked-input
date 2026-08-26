import {afterEach, describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {ROW_CONTROLS, editingHost, getElement, rowsOf} from '../../shared/lib/dom'
import {
	caretOffsetFromPoint,
	centreOf,
	focusAtOffset,
	moveDomCaret,
	settle,
	verifyCaretPosition,
} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {composePage, mount, mountEcho} from '../../shared/lib/page'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

const VALUE = 'Undo me'

const surface = () => getElement(page.getByText(VALUE))

/**
 * A stylesheet of the consumer's over the rows of one editor, hung off an attribute this file
 * writes rather than off a class prop — `className` and `class` are two spellings and this spec
 * runs in both frameworks. `ROW_CONTROLS` is excluded for the reason `rowsOf` excludes it: the
 * controls layer is the container's other child and is not a row (ADR-0007). Spelled through the
 * shared constant so the stylesheet and `rowsOf` cannot drift into two answers.
 */
const PROBE = 'data-caret-display-probe'
let stylesheet: HTMLStyleElement | undefined

function styleRows(host: HTMLElement, display: string) {
	host.setAttribute(PROBE, '')
	stylesheet = document.createElement('style')
	stylesheet.textContent = `[${PROBE}] > *:not(${ROW_CONTROLS}) {display: ${display}}`
	document.head.append(stylesheet)
}

const displayOfRow = (host: HTMLElement) => getComputedStyle(rowsOf(host)[0]).display

afterEach(() => {
	stylesheet?.remove()
	stylesheet = undefined
})

/**
 * WHERE AN EDIT LEAVES THE CARET, driven in a real browser through the event a browser sends.
 *
 * The first two open the same gap on purpose: the DOM caret moves, and the edit arrives before
 * `selectionchange` has told the editor about it. That is not a harness trick — it is the state a
 * `beforeinput` describes, since the event names the span the browser is about to edit while the
 * editor's own reading of the selection can be a task older. What is under test there is that an
 * edit is committed against the caret the DOM has.
 *
 * The display cases below test something else, and say so themselves.
 */
describe('API: the caret an edit leaves', () => {
	/**
	 * THE CONTRAST, not a pin of the sync: this case is green with the mechanism deleted and green
	 * with it in place, measured. The uncontrolled path takes its caret off `replaceBetween`'s own
	 * answer rather than off the stored selection, so the stale reading never reaches it — which is
	 * why the defect showed in one mode and not the other. It is here so the pair reads as "one
	 * mode diverged, and this is the one that did not".
	 */
	it('lands after what was typed, in an uncontrolled editor', async () => {
		const {host} = await mount(Default, {defaultValue: VALUE, separator: null})
		await focusAtOffset(surface(), 0)

		moveDomCaret(surface(), 4)
		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(() => host.textContent).toBe('UndoX me')
		verifyCaretPosition(host, 5)
	})

	it('lands after what was typed, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE, separator: null})
		await focusAtOffset(surface(), 0)

		moveDomCaret(surface(), 4)
		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(value).toBe('UndoX me')
		verifyCaretPosition(host, 5)
	})

	/**
	 * A ROW's box is the consumer's to style, and this is not a list of supported displays: the
	 * caret is resolved from the tree and written into a text node, so no formatting context can
	 * move it.
	 *
	 * Each case CLICKS, and every assertion is stated against where the click landed rather than
	 * against a constant. A constant is a text-domain number that no formatting context can
	 * change, so six cases asserting one would be one case written six times — which is what these
	 * were, and why a measurement once read as if a display moved the caret. What a display moves
	 * is the CLICK: a shrink-to-fit box puts one mid-text where a stretched box puts it at the end.
	 *
	 * WHERE THE CLICK WOULD GO is asked of the browser's own hit test, before clicking and with the
	 * editor not involved. Reading the selection AFTER the click cannot stand in for it: the click
	 * awaits, so the editor has already heard the `selectionchange`, resolved the caret and written
	 * it back — a caret layer that moved it would have moved the reading too, and the case would
	 * agree with itself all the way to green. Verified by injecting the mechanism P11 alleged into
	 * `DomModel.anchorFor` (snap to the row entry under a non-block display): `table-row`,
	 * `table-cell` and `flex` go red, `grid`, `block` and `inline` stay green.
	 */
	describe.each(['table-row', 'table-cell', 'flex', 'grid', 'block', 'inline'])(
		'is the same under display: %s',
		display => {
			it('keeps the caret a click placed, and edits there', async () => {
				const {host, value} = await mountEcho(Default, {value: VALUE, separator: '\n'})
				styleRows(host, display)
				// The stylesheet has to have LANDED, or the six cases are one case written six
				// times — and it is read again at the end, because the edit re-renders the row.
				expect(displayOfRow(host)).toBe(display)

				const {x, y} = centreOf(surface())
				const at = caretOffsetFromPoint(host, x, y)
				expect(at, 'the layout offers no caret at the click point').not.toBeUndefined()
				if (at === undefined) return

				await userEvent.click(surface())
				await settle()
				verifyCaretPosition(host, at)

				dispatchInsertText(editingHost(host), 'X')

				await expect.poll(value).toBe(`${VALUE.slice(0, at)}X${VALUE.slice(at)}`)
				expect(displayOfRow(host)).toBe(display)
				verifyCaretPosition(host, at + 1)
			})
		}
	)
})