import {afterEach, describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {ROW_CONTROLS, editingHost, getElement, rowsOf} from '../../shared/lib/dom'
import {
	caretOffsetFromPoint,
	centreOf,
	focusAtEnd,
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
/**
 * THE EDITOR FOLLOWS ITS OWN CARET. Every caret in this editor is written programmatically, and a
 * programmatic `Selection.collapse` scrolls nothing — so typing at the end of a long page put the
 * caret at y=882 of a 900px viewport and the scroll position never moved. What is asserted is the
 * user-visible fact: after the keystroke, the caret is on screen.
 *
 * The page is scrolled AWAY from the caret rather than the document made long enough to hide it,
 * because "the scroll position never moved" is exactly the claim, and starting from a scroll the
 * test performed is the only way to read it off the DOM without trusting a layout guess.
 */
describe('a caret the page has scrolled past', () => {
	const TALL = Array.from({length: 40}, (_, i) => `row number ${i}`).join('\n')

	afterEach(async () => {
		await page.viewport(1280, 720)
	})

	it('is scrolled back into view by the keystroke that moved it', async () => {
		await page.viewport(640, 200)
		const {host, value} = await mountEcho(Default, {value: TALL, separator: '\n'})

		await focusAtEnd(rowsOf(host).at(-1)!)
		window.scrollTo(0, 0)
		expect(caretTop(), 'the caret must start off the bottom of the page').toBeGreaterThan(window.innerHeight)

		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(value).toBe(`${TALL}X`)
		await expect.poll(caretTop).toBeLessThanOrEqual(window.innerHeight)
		expect(window.scrollY).toBeGreaterThan(0)
	})
})

/**
 * AN EMPTY ROW MUST HOLD A CARET LINE. The rule this pins is the PLATFORM's rather than this
 * editor's: measured with no editor in the page at all, Chromium's own vertical caret movement
 * steps over a block that generates no LINE BOX, and an empty row's text surface generates none —
 * so a blank line a user had just made with two Enters could be clicked into and never arrowed
 * into. With rows `one`, ``, `three`, ``, `# head`, ``, `six`, `end`, ArrowUp visited 7, 6, 4, 2, 0.
 *
 * DRIVEN WITH REAL ARROW KEYS, and there is no other way to read it: the caret motion under test is
 * the browser's own, so a placement this spec performs would pin nothing. `.Row`'s own `min-height`
 * was already 1.2em and did not help, which is why the assertion is on where the CARET lands rather
 * than on a box.
 *
 * Framework-free: the rule lives in core's stylesheet and both adapters paint the same row shape.
 */
describe('an empty row', () => {
	const LADDER = 'one\n\nthree\n\n# head\n\nsix\nend'

	it('is reached by the arrow key that walks past it', async () => {
		const {host} = await mountEcho(Default, {value: LADDER, separator: '\n'})
		const rows = rowsOf(host)

		await focusAtEnd(rows.at(-1)!)
		const visited: number[] = []
		for (let step = 0; step < 7; step++) {
			await userEvent.keyboard('{ArrowUp}')
			await settle()
			visited.push(rows.indexOf(rowOfCaret(host)))
		}

		expect(visited).toEqual([6, 5, 4, 3, 2, 1, 0])
	})

	it('takes the character typed into it once the arrow stops there', async () => {
		const {host, value} = await mountEcho(Default, {value: LADDER, separator: '\n'})

		await focusAtEnd(rowsOf(host)[0])
		await userEvent.keyboard('{ArrowDown}')
		await settle()
		await userEvent.keyboard('X')

		await expect.poll(value).toBe('one\nX\nthree\n\n# head\n\nsix\nend')
	})
})

/** The row element the live caret sits in. */
function rowOfCaret(host: HTMLElement): HTMLElement {
	const node = window.getSelection()?.focusNode
	const row = node && rowsOf(host).find(candidate => candidate.contains(node))
	if (!row) throw new Error('the caret is in no row')
	return row
}

/** Top of the live caret rect, in viewport coordinates. */
function caretTop(): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) throw new Error('Expected a caret')
	return selection.getRangeAt(0).getBoundingClientRect().top
}