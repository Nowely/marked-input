import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'

import {caretIsInside, editingHost, findEditingHost} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {APOLLO_DOC} from './document'
import * as NotionStories from './Notion.stories.react'

/**
 * The probe's chrome, driven rather than described: the claim under test is that a slash menu
 * and a mention picker can be built on machinery that already ships, so the test types the
 * character a user types and reads back the value the editor emits.
 *
 * It renders the composed stories itself rather than going through `shared/lib/page`: those
 * helpers are typed for the shared-harness pages, and this page is react-only.
 */

const {Document, Editor} = composeStories(NotionStories)

/** Renders a composed story and answers its editing host. */
async function mount(Story: typeof Document, args: Partial<Parameters<typeof Story>[0]> = {}) {
	const {container} = await render(<Story {...args} />)
	return {host: findEditingHost(container)}
}

/**
 * The same story as a CONTROLLED field, echoing every `onChange` back into `value` — the mode P8
 * measured three defects in, and the one where the tree has not moved when a verb returns.
 */
async function mountControlled(Story: typeof Document, initial: string) {
	const latest = {current: initial}
	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value
		return <Story value={value} onChange={setValue} />
	}
	const {container} = await render(<Echo />)
	// The parent's own state IS what the editor emitted, so no spy is needed beside it.
	return {host: findEditingHost(container), value: () => latest.current}
}

/** The document as text, as the editor last emitted it. */
const onChangeSpy = () => vi.fn<(value: string) => void>()

/** The table lines of a document, in document order. */
const tableLines = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[data-table]')]

/** The cells of the table line at `line`, as elements — the identity oracle reads these. */
function cellsOf(host: HTMLElement, line = 0): HTMLElement[] {
	return [...tableLines(host)[line].querySelectorAll<HTMLElement>('[data-cell]')]
}

function pressTab(host: HTMLElement, shiftKey = false): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {key: 'Tab', shiftKey, bubbles: true, cancelable: true})
	editingHost(host).dispatchEvent(event)
	return event
}

/**
 * Puts the caret in the document's LAST row, empty or not.
 *
 * `focusAtEnd` cannot: it walks to the last text node of non-zero length, and the row after a
 * trailing separator has none — an empty row is exactly what a Notion user types `/` into.
 *
 * The last row is not `host.lastElementChild`: the block controls layer is a SIBLING of the
 * rows inside the container (ADR-0007), and it is the one carrying `contenteditable="false"`.
 */
function focusLastRow(host: HTMLElement) {
	const rows = [...host.children].filter(child => !child.hasAttribute('contenteditable'))
	const row = rows.at(-1)!
	const target = row.querySelector('span') ?? row

	editingHost(host).focus()
	const range = window.document.createRange()
	range.setStart(target.firstChild ?? target, 0)
	range.collapse(true)

	const selection = window.getSelection()!
	selection.removeAllRanges()
	selection.addRange(range)
}

describe('Notion probe: the document', () => {
	it('renders the frontmatter, both tables and the quote as ROW KINDS', async () => {
		const {host} = await mount(Document)

		// The properties panel IS the document's first row — the kind's own component, not a
		// mark hidden inside a generic block wrapper.
		expect(host.firstElementChild?.textContent).toContain('Product Launch')

		// Both tables became table rows: cells the parser never saw as cells, one row per line.
		expect(host.textContent).toContain('Auth service migration')
		expect(host.textContent).toContain('Crash-free sessions')

		// The quote keeps its text editable — a `__slot__` body, inline-parsed in place.
		const quote = [...host.querySelectorAll('span')].find(
			element => element.textContent === "If the cutover isn't boring, we're not ready to call it GA."
		)
		expect(quote).toBeDefined()
		expect(quote?.closest('[contenteditable="false"]')).toBeNull()
	})

	/**
	 * Issue 05 on the reference document. Under `'\n\n'` the four risks were ONE row — one grip,
	 * one menu, no way to move an item — and a `'- __slot__'` kind would have swallowed all four
	 * into a single bullet. A line is a row now, so each item is its own row with its own kind.
	 */
	it('gives every risk-list item a row of its own', async () => {
		const {host} = await mount(Document)

		const items = [...host.children].filter(
			(row): row is HTMLElement => row instanceof HTMLElement && row.textContent.startsWith('Vendor SLA')
		)
		expect(items).toHaveLength(1)

		const [row] = items
		expect(row.previousElementSibling?.textContent).toBe(
			'Auth migration slipped two weeks. GA holds only if cutover lands by 2026-04-09.'
		)
		expect(row.nextElementSibling?.textContent).toBe('EU region capacity unconfirmed — awaiting quota approval.')

		// The ROW is the bullet, not a mark inside a paragraph: the preset's indent sits on the
		// row's own element. Left as an inline mark the text reads the same from `textContent`
		// and the indent lands on an inner span instead — which is what this line separates.
		expect(row.style.paddingLeft).toBe('1em')
	})

	/**
	 * The structural bytes never reach the document. A heading's `'# '`, the frontmatter fences
	 * and the table's leading `'|'` are the editor's, not the text's — which is what makes
	 * `textContent` a usable reading of what the user sees.
	 */
	it('keeps every row opener out of the painted text', async () => {
		const {host} = await mount(Document)

		expect(host.textContent).toContain('Apollo — Q2 launch plan')
		expect(host.textContent).not.toContain('# Apollo')
		expect(host.textContent).not.toContain('## Launch tasks')
	})
})

/**
 * P9 on the reference document. A table line's kind CARVES its body at `' | '`, so every cell is a
 * Row: it has its own element, its own inline content and its own caret. Before this the whole
 * line was one raw body — nothing inside a cell was a token, and no mention could live in one.
 */
describe('Notion probe: editable cells', () => {
	const TWO_CELLS = '| a | b\nnext'

	it('carves a line into one Row per cell and round-trips the document', async () => {
		const {host, value} = await mountControlled(Document, TWO_CELLS)

		expect(cellsOf(host).map(cell => cell.textContent)).toEqual(['a', 'b'])
		// The delimiter and the opener are structural: neither reaches the painted text.
		expect(tableLines(host)[0].textContent).toBe('ab')
		expect(value()).toBe(TWO_CELLS)
	})

	it('emits what was typed into the second cell and nothing else', async () => {
		const {host, value} = await mountControlled(Document, '| a | b | c | d | e\nnext')

		await focusAtOffset(cellsOf(host)[1], 1)
		dispatchInsertText(editingHost(host), 'X')

		// POLLED, not read: the controlled parent's `setState` lands on React's own clock, so a
		// synchronous read here is the value from before the keystroke.
		await expect.poll(value).toBe('| a | bX | c | d | e\nnext')
		expect(cellsOf(host).map(cell => cell.textContent)).toEqual(['a', 'bX', 'c', 'd', 'e'])
	})

	/**
	 * THE IDENTITY ORACLE, at the DOM, and it types the DELIMITER on purpose: a keystroke that
	 * leaves the cell count alone pairs every cell to itself by index and passes without the walk
	 * that makes it true. Writing `' | '` into column 2 INSERTS a column, and each cell is keyed by
	 * its node id, so a re-minted node remounts the element — which is the only reading that sees
	 * columns 3–5 being handed the nodes of the columns before them. The value is byte-identical
	 * either way.
	 */
	it('keeps every later cell its own element when a delimiter is typed into the second', async () => {
		const {host, value} = await mountControlled(Document, '| a | b | c | d | e\nnext')
		const [, , ...tail] = cellsOf(host)

		await focusAtEnd(cellsOf(host)[1])
		dispatchInsertText(editingHost(host), ' | ')

		await expect.poll(value).toBe('| a | b |  | c | d | e\nnext')
		const after = cellsOf(host)
		expect(after.map(cell => cell.textContent)).toEqual(['a', 'b', '', 'c', 'd', 'e'])
		expect(after.slice(3)).toEqual(tail)
	})

	it('parses a mention typed in a cell as a mark INSIDE that cell', async () => {
		const {host, value} = await mountControlled(Editor, TWO_CELLS)
		const cell = cellsOf(host)[1]

		await focusAtEnd(cell)
		dispatchInsertText(editingHost(host), '@')
		const person = page.getByText('Jia Lin')
		await expect.element(person).toBeVisible()
		await person.click()

		expect(value()).toBe('| a | b@[Jia Lin](jia.lin)\nnext')
		// INSIDE the cell, not beside it: the mark is a child of the cell's own content.
		const mention = [...host.querySelectorAll('span')].find(span => span.textContent === 'Jia Lin')
		expect(cellsOf(host)[1].contains(mention ?? null)).toBe(true)
	})

	it('moves the caret to the next cell on Tab and back on Shift+Tab', async () => {
		const {host} = await mountControlled(Document, TWO_CELLS)
		const [first, second] = cellsOf(host)

		await focusAtEnd(first)
		expect(pressTab(host).defaultPrevented).toBe(true)
		expect(caretIsInside(second)).toBe(true)

		expect(pressTab(host, true).defaultPrevented).toBe(true)
		expect(caretIsInside(first)).toBe(true)
	})

	it('leaves the field at the last cell, where there is no next one', async () => {
		const {host} = await mountControlled(Document, TWO_CELLS)

		await focusAtEnd(cellsOf(host)[1])

		expect(pressTab(host).defaultPrevented).toBe(false)
	})

	/**
	 * The reference document's own tables, which are what P2 measured the cost on: every cell is
	 * editable in place now. The trailing `' |'` a markdown line ends with is NOT a delimiter, so
	 * it belongs to the last cell's text — the delimiter model's declared cost, left visible here
	 * rather than edited out of the fixture.
	 */
	it('makes the reference table editable cell by cell', async () => {
		const {host, value} = await mountControlled(Document, APOLLO_DOC)
		const header = cellsOf(host, 0)

		expect(header.map(cell => cell.textContent)).toEqual(['Task', 'Status', 'Owner', 'Due |'])

		await focusAtEnd(header[2])
		dispatchInsertText(editingHost(host), 's')

		await expect.poll(value).toContain('| Task | Status | Owners | Due |')
	})

	/**
	 * THE HEADER, and the answer to what P2 declared missing: it is the first line of a consecutive
	 * RUN, which no row can decide for itself — a row is recognised by its own first bytes, and
	 * which line is the header is a fact about the line after it. It stays a consumer-side reading,
	 * and what the split changed is that the reading is now expressible without one: the cells are
	 * elements, so `.table + .table` is "not the first of a run" and nothing asks about a sibling.
	 */
	it('paints the first line of a table run as a header and the lines after it as body', async () => {
		const {host} = await mountControlled(Document, APOLLO_DOC)
		const weightOf = (line: number) => window.getComputedStyle(cellsOf(host, line)[0]).fontWeight

		expect(weightOf(0)).toBe('500')
		// The alignment line, which is an ordinary line of cells here — see `TableRow`.
		expect(weightOf(1)).toBe('400')
		// The second table is its own run, so its first line is a header again.
		expect(cellsOf(host, 6).map(cell => cell.textContent)).toEqual(['Metric', 'Value', 'As of |'])
		expect(weightOf(6)).toBe('500')
	})
})

describe('Notion probe: the chrome', () => {
	it('starts a heading from the slash menu on an empty row', async () => {
		const onChange = onChangeSpy()
		const {host} = await mount(Editor, {defaultValue: 'Intro paragraph\n\n', onChange})

		focusLastRow(host)
		dispatchInsertText(editingHost(host), '/')

		const item = page.getByText('Heading 1')
		await expect.element(item).toBeVisible()
		await item.click()

		expect(onChange.mock.lastCall?.[0]).toBe('Intro paragraph\n\n# ')
	})

	/**
	 * TICKET 11, driven end to end. The menu used to write over the TRIGGER's span — wherever the
	 * caret is — so a row that already had text got `'plain row# '`, a heading opener dropped
	 * mid-row. `choose({option})` converts the ROW instead: the trigger leaves and the kind
	 * arrives in one splice, and the text the user typed is what the heading holds.
	 */
	it('converts a row that already has text into the chosen kind, keeping the text', async () => {
		const onChange = onChangeSpy()
		const {host} = await mount(Editor, {defaultValue: 'Intro paragraph\n\nplain row', onChange})

		await focusAtEnd(host)
		dispatchInsertText(editingHost(host), '/')

		const item = page.getByText('Heading 1')
		await expect.element(item).toBeVisible()
		await item.click()

		expect(onChange.mock.lastCall?.[0]).toBe('Intro paragraph\n\n# plain row')
	})

	/**
	 * The menu is `overlay.entries`, so what a query narrows to is core's answer and not a
	 * component's: `codeBlock` declares `keywords: ['fence', …]` and no label contains it.
	 */
	it('narrows the menu by a keyword that appears in no label', async () => {
		const {host} = await mount(Editor, {defaultValue: 'Intro paragraph\n\n'})

		focusLastRow(host)
		dispatchInsertText(editingHost(host), '/fence')

		await expect.element(page.getByText('Code')).toBeVisible()
		expect(page.getByText('Heading 1').elements()).toHaveLength(0)
	})

	it('writes a mention with its id through the built-in suggestion list', async () => {
		const onChange = onChangeSpy()
		const {host} = await mount(Editor, {defaultValue: 'Owned by ', onChange})

		await focusAtEnd(host)
		dispatchInsertText(editingHost(host), '@')

		const person = page.getByText('Marcus Kane')
		await expect.element(person).toBeVisible()
		await person.click()

		expect(onChange.mock.lastCall?.[0]).toBe('Owned by @[Marcus Kane](marcus.kane)')
	})
})