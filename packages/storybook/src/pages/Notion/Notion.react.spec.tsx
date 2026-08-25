import {composeStories} from '@storybook/react-vite'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'

import {editingHost, findEditingHost} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
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

/** The document as text, as the editor last emitted it. */
const onChangeSpy = () => vi.fn<(value: string) => void>()

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
	 * The gesture Notion has and this does not. The menu writes over the TRIGGER's span
	 * (`OverlayController.ts:169-176`), which is wherever the caret is — so on a row that
	 * already has text the markup lands mid-row instead of converting the row. See
	 * `docs/scratch/notion-like/issues/11-overlay-inserts-one-markup.md`.
	 */
	it('cannot convert a row that already has text: the markup lands at the caret', async () => {
		const onChange = onChangeSpy()
		const {host} = await mount(Editor, {defaultValue: 'Intro paragraph\n\nplain row', onChange})

		await focusAtEnd(host)
		dispatchInsertText(editingHost(host), '/')

		const item = page.getByText('Heading 1')
		await expect.element(item).toBeVisible()
		await item.click()

		expect(onChange.mock.lastCall?.[0]).toBe('Intro paragraph\n\nplain row# ')
	})

	it('writes a mention with its id through the people list', async () => {
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