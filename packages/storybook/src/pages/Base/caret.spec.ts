import {afterEach, describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'

import {editingHost, getElement, rowsOf} from '../../shared/lib/dom'
import {focusAtOffset, moveDomCaret, verifyCaretPosition} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {composePage, mount, mountEcho} from '../../shared/lib/page'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

const VALUE = 'Undo me'

/** One task, which is what `selectionchange` costs: after it the editor holds what the DOM holds. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

const surface = () => getElement(page.getByText(VALUE))

/**
 * A stylesheet of the consumer's over the rows of one editor, hung off an attribute this file
 * writes rather than off a class prop — `className` and `class` are two spellings and this spec
 * runs in both frameworks. The row-controls layer is the container's other child and is excluded
 * by the `contenteditable` it carries (ADR-0007).
 */
const PROBE = 'data-caret-display-probe'
let stylesheet: HTMLStyleElement | undefined

function styleRows(host: HTMLElement, display: string) {
	host.setAttribute(PROBE, '')
	stylesheet = document.createElement('style')
	stylesheet.textContent = `[${PROBE}] > *:not([contenteditable]) {display: ${display}}`
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
 * Every spec here opens the same gap on purpose: the DOM caret moves, and the edit arrives before
 * `selectionchange` has told the editor about it. That is not a harness trick — it is the state a
 * `beforeinput` describes, since the event names the span the browser is about to edit while the
 * editor's own reading of the selection can be a task older. What is under test is that an edit is
 * committed against the caret the DOM has.
 */
describe('API: the caret an edit leaves', () => {
	it('lands after what was typed, in an uncontrolled editor', async () => {
		const {host} = await mount(Default, {defaultValue: VALUE, separator: null})
		await focusAtOffset(surface(), 0)
		await settle()

		moveDomCaret(surface(), 4)
		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(() => host.textContent).toBe('UndoX me')
		verifyCaretPosition(host, 5)
	})

	it('lands after what was typed, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE, separator: null})
		await focusAtOffset(surface(), 0)
		await settle()

		moveDomCaret(surface(), 4)
		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(value).toBe('UndoX me')
		verifyCaretPosition(host, 5)
	})

	/**
	 * A ROW's box is the consumer's to style, and this is not a list of supported displays: the
	 * caret is resolved from the tree and written into a text node, so no formatting context can
	 * move it. The six are here because a measurement once read as if one could — a shrunk
	 * `table-cell` box simply puts a CLICK where a full-width `block` box does not, and it was the
	 * stale reading of that click that moved the caret, in every display alike.
	 */
	describe.each(['table-row', 'table-cell', 'flex', 'grid', 'block', 'inline'])(
		'is the same under display: %s',
		display => {
			it('lands after what was typed', async () => {
				const {host, value} = await mountEcho(Default, {value: VALUE, separator: '\n'})
				styleRows(host, display)
				// The stylesheet has to have LANDED, or the six cases are one case written six
				// times — and it is read again at the end, because the edit re-renders the row.
				expect(displayOfRow(host)).toBe(display)

				await focusAtOffset(surface(), 0)
				await settle()

				moveDomCaret(surface(), 4)
				dispatchInsertText(editingHost(host), 'X')

				await expect.poll(value).toBe('UndoX me')
				expect(displayOfRow(host)).toBe(display)
				verifyCaretPosition(host, 5)
			})
		}
	)
})