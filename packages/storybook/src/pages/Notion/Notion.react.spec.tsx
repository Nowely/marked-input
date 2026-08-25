import type {MarkedInputProps} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {editingHost, findEditingHost, rowsOf} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset, focusAtStart} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {APOLLO_DOC} from './document'
import * as NotionStories from './Notion.stories.react'

/**
 * THE SHOWCASE, DRIVEN. Every claim below is a gesture a user makes and the value the editor
 * emits afterwards — no internal is read, and the only component-level readings are of the DOM
 * the page paints.
 *
 * The page under test is built from `@markput/notion` alone, so a failure here is a failure of
 * the option API rather than of this file: the story hands the editor an options array and a
 * paragraph component, and everything these tests exercise — the menu, the keymap, the cells, the
 * drag, the undo stack — is the editor's own.
 */

const {Showcase, Empty} = composeStories(NotionStories)

type Story = typeof Showcase

async function mount(Story: Story, args: Partial<MarkedInputProps> = {}) {
	const {container} = await render(<Story {...args} />)
	return {host: findEditingHost(container)}
}

/**
 * The page as a CONTROLLED field, echoing every `onChange` back into `value` — the mode where the
 * tree has not moved when a verb returns, and the one every value assertion below runs in.
 */
async function mountControlled(Story: Story, initial: string) {
	const latest = {current: initial}
	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value
		return <Story onChange={setValue} value={value} />
	}
	const {container} = await render(<Echo />)
	return {host: findEditingHost(container), value: () => latest.current}
}

/** Every row element at every depth, in document order — a nested row is not a child of the host. */
const rowAt = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>('div')].find(row => row.textContent.trim() === text)
	if (!found) throw new Error(`no element reading ${JSON.stringify(text)}`)
	return found
}

/**
 * The BODY cells of the database, in document order. A header cell wears the body cell's class
 * too — it is the same box with a quieter type — so the header is excluded by name.
 */
const cellsOf = (host: HTMLElement): HTMLElement[] => [
	...host.querySelectorAll<HTMLElement>('[class*="tableCell"]:not([class*="tableHeadCell"])'),
]

/** A toggle row, named by the text its own line starts with — its children are inside it. */
const toggleStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>('[class*="toggleRow"]')].find(row =>
		row.textContent.trim().startsWith(text)
	)
	if (!found) throw new Error(`no toggle starting ${JSON.stringify(text)}`)
	return found
}

const GRIP = {name: 'Drag to reorder or click for options'} as const

async function gripOfRow(host: HTMLElement, row: HTMLElement) {
	await userEvent.hover(row)
	return page.elementLocator(host).getByRole('button', GRIP).findElement()
}

/** A whole drag at an exact POINT: the pointer's Y names the gap, its X names the depth in it. */
async function dragTo(host: HTMLElement, from: HTMLElement, clientX: number, clientY: number) {
	const grip = await gripOfRow(host, from)
	const dataTransfer = new DataTransfer()
	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer}))
	const at = {bubbles: true, cancelable: true, dataTransfer, clientX, clientY}
	host.dispatchEvent(new DragEvent('dragover', at))
	host.dispatchEvent(new DragEvent('drop', at))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))
}

/** Picks an entry out of whichever overlay is open. */
async function choose(label: string) {
	const item = page.getByText(label, {exact: true})
	await expect.element(item).toBeVisible()
	await item.click()
}

describe('the showcase page', () => {
	it('paints every block kind of the reference page', async () => {
		const {host} = await mount(Showcase)

		// Page furniture and prose.
		expect(host.textContent).toContain('Apollo — Q2 launch plan')
		expect(host.textContent).toContain('Inline database · 24 items')
		// The properties panel reads its own raw interior: the labels are the document's keys.
		expect(host.textContent).toContain('Confidence')
		expect(host.textContent).toContain('82%')
		// The database: a header line, five body lines and a footer.
		expect(host.querySelectorAll('[class*="tableHeadLine"]')).toHaveLength(1)
		expect(host.querySelectorAll('[class*="tableLine"]:not([class*="tableHeadLine"])')).toHaveLength(5)
		expect(host.textContent).toContain('Count 24 · 9 done')
		// The board's three columns, and the metric cards beside the callout.
		expect(host.textContent).toContain('To do')
		expect(host.textContent).toContain('Shipped')
		expect(host.textContent).toContain('Crash-free')
		expect(host.textContent).toContain('GA holds only if cutover lands by 2026-04-09')
		// The lists, the toggles, the fence, the quote, the bookmark and the comment thread.
		expect(host.textContent).toContain('Awaiting quota approval')
		expect(host.textContent).toContain('Why we cut the Android target')
		expect(host.textContent).toContain('apollo deploy --env=staging --canary=5%')
		expect(host.textContent).toContain("If the cutover isn't boring")
		expect(host.textContent).toContain('Auth migration — rollout plan')
		expect(host.textContent).toContain('Can we confirm the EU quota before Friday?')
	})

	/**
	 * The structural bytes never reach the document: a heading's `'## '`, the frontmatter fences,
	 * the table's `'|= '` and the toggle's `'▸ '` are the editor's, not the text's.
	 */
	it('keeps every row opener out of the painted text', async () => {
		const {host} = await mount(Showcase)

		expect(host.textContent).toContain('Launch tasks')
		expect(host.textContent).not.toContain('## Launch tasks')
		expect(host.textContent).not.toContain('▸ Why')
		expect(host.textContent).not.toContain('@bookmark')
	})

	it('round-trips the whole document through a controlled parent', async () => {
		const {host, value} = await mountControlled(Showcase, APOLLO_DOC)

		await focusAtEnd(rowAt(host, 'Vendor SLA unsigned'))
		dispatchInsertText(editingHost(host), '!')

		await expect.poll(value).toBe(APOLLO_DOC.replace('Vendor SLA unsigned', 'Vendor SLA unsigned!'))
	})
})

describe('the slash menu', () => {
	it('inserts a kind on an empty row', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mount(Empty, {onChange})

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Heading 2')

		expect(onChange.mock.lastCall?.[0]).toBe('## ')
	})

	/**
	 * The other half of the same gesture: on a row that already has text the menu CONVERTS it, and
	 * the text the user typed is what the new kind holds. The trigger leaves in the same splice.
	 */
	it('converts a row that already has text, keeping the text', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mount(Showcase, {defaultValue: 'plain row', onChange})

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Quote')

		expect(onChange.mock.lastCall?.[0]).toBe('> plain row')
	})

	/** The menu is `overlay.entries`, so a keyword no label contains still narrows it. */
	it('narrows by a keyword that appears in no label', async () => {
		const {host} = await mount(Empty)

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/kanban')

		await expect.element(page.getByText('Board', {exact: true})).toBeVisible()
		expect(page.getByText('Quote', {exact: true}).elements()).toHaveLength(0)
	})
})

describe('the keymap on the showcase kinds', () => {
	it('nests a list item on Tab and outdents it on Shift+Tab', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta')

		await focusAtEnd(rowAt(host, 'beta'))
		await userEvent.keyboard('{Tab}')
		await expect.poll(value).toBe('- alpha\n\t- beta')

		await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
		await expect.poll(value).toBe('- alpha\n- beta')
	})

	/**
	 * Shift+Enter continues the row rather than splitting it: the line it opens is a CHILD of the
	 * row that owns it, which is what makes it travel with its parent on a drag and reach the
	 * kind's component as its `rows` prop.
	 */
	it('continues a list item on Shift+Enter', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha')

		await focusAtEnd(rowAt(host, 'alpha'))
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(value).toBe('- alpha\n\t')

		dispatchInsertText(editingHost(host), 'second line')
		await expect.poll(value).toBe('- alpha\n\tsecond line')
	})

	/**
	 * A CONSUMER'S CONTROL IS NOT DOCUMENT CONTENT. Everything a row's component paints sits inside
	 * the one contenteditable container, so a checkbox or a toggle arrow the editor knows nothing
	 * about is text the caret can enter and the browser can edit. `useControlRef()` is what says
	 * otherwise, and `contenteditable="false"` is what it writes — the browser's own word for
	 * "atomic". Nothing else in this file would notice its absence.
	 */
	it('keeps a checkbox and a toggle arrow out of the editable document', async () => {
		const {host} = await mountControlled(Showcase, '- [ ] tick me\n▸ open me')

		const checkbox = page.elementLocator(host).getByRole('checkbox').element()
		const arrow = page.elementLocator(host).getByRole('button', {name: 'Expand'}).element()

		expect(checkbox.getAttribute('contenteditable')).toBe('false')
		expect(arrow.getAttribute('contenteditable')).toBe('false')
	})

	it('ticks a to-do through its own checkbox', async () => {
		const {host, value} = await mountControlled(Showcase, '- [ ] Confirm the EU quota')

		await page.elementLocator(host).getByRole('checkbox').click()

		await expect.poll(value).toBe('- [x] Confirm the EU quota')
	})
})

describe('undo', () => {
	/**
	 * The editor owns the stack (ADR-0012), so `Mod+Z` undoes a keystroke and `Mod+Shift+Z` puts it
	 * back. Driven in the CONTROLLED mode, which is the one the round trip has to survive: the tree
	 * has not moved when the keystroke returns, and the entry lands on the echo.
	 *
	 * The CARET is asserted as the row it comes back to and not as an offset inside it, and that is
	 * a MEASURED limit rather than a loose assertion: in a real browser, through either adapter and
	 * with or without a row kind, the DOM caret after an undo sits at the end of the restored text
	 * rather than at the position the edit was made from. Core's own `HistoryModel` spec pins the
	 * offset against core's selection state, so the gap is below this page and not in it.
	 */
	it('restores the value a keystroke changed, and puts it back on redo', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta')

		await focusAtOffset(rowAt(host, 'beta'), 2)
		dispatchInsertText(editingHost(host), 'XY')
		await expect.poll(value).toBe('- alpha\n- beXYta')

		await userEvent.keyboard('{Meta>}z{/Meta}')
		await expect.poll(value).toBe('- alpha\n- beta')
		expect(window.getSelection()?.focusNode?.textContent).toBe('beta')

		await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}')
		await expect.poll(value).toBe('- alpha\n- beXYta')
	})
})

describe('the inline database', () => {
	it('emits what was typed into a cell and nothing else', async () => {
		const {host, value} = await mountControlled(Showcase, '|= Task | Owner\n| Auth migration | Kara')

		await focusAtEnd(cellsOf(host)[1])
		dispatchInsertText(editingHost(host), ' Vance')

		await expect.poll(value).toBe('|= Task | Owner\n| Auth migration | Kara Vance')
	})

	/**
	 * THE IDENTITY ORACLE, and it types the DELIMITER on purpose: a keystroke that leaves the cell
	 * count alone pairs every cell to itself by index and passes without the walk that makes it
	 * true. Writing `' | '` INSERTS a column, and each cell is keyed by its node id, so a re-minted
	 * node remounts the element — the only reading that sees a later cell handed the node of the
	 * cell before it. The value is byte-identical either way.
	 */
	it('keeps every later cell its own element when a delimiter is typed into the second', async () => {
		const {host, value} = await mountControlled(Showcase, '| a | b | c | d | e\nnext')
		const [, , ...tail] = cellsOf(host)

		await focusAtEnd(cellsOf(host)[1])
		dispatchInsertText(editingHost(host), ' | ')

		await expect.poll(value).toBe('| a | b |  | c | d | e\nnext')
		expect(cellsOf(host).slice(3)).toEqual(tail)
	})

	it('writes a mention into a cell through the built-in picker', async () => {
		const {host, value} = await mountControlled(Showcase, '| Auth migration | Kara\nnext')

		await focusAtEnd(cellsOf(host)[1])
		dispatchInsertText(editingHost(host), '@')
		await choose('Milo Freeman')

		await expect.poll(value).toBe('| Auth migration | Kara@[Milo Freeman](milo.freeman)\nnext')
	})
})

describe('the toggle', () => {
	/**
	 * THE COLLAPSED ROW, and the hazard the design carried since P3: a row that is not painted has
	 * left `bind` and taken its anchors with it. A closed toggle therefore RENDERS its children and
	 * hides them, and the value it holds is proof they are still in the document.
	 */
	it('keeps a closed toggle’s children in the DOM, hidden until found', async () => {
		const {host} = await mount(Showcase)
		const bodyOf = () => toggleStarting(host, 'Why we cut').querySelector('[class*="toggleChildren"]')

		expect(bodyOf()?.textContent).toContain('puts the auth migration on the critical path twice')
		expect(bodyOf()?.getAttribute('hidden')).toBe('until-found')

		await page.elementLocator(toggleStarting(host, 'Why we cut')).getByRole('button', {name: 'Expand'}).click()

		await expect.poll(() => bodyOf()?.hasAttribute('hidden')).toBe(false)
	})

	/**
	 * SPEC RISK 10, driven: a row hidden inside a collapsed toggle is still BOUND, so a gesture
	 * that resolves through the last row of the document still finds an element. Select-all is that
	 * gesture — it seeds from the document's end — and typing over the selection replaces the whole
	 * document, hidden child included.
	 */
	it('selects the whole document with a collapsed toggle last in it', async () => {
		const {host, value} = await mountControlled(Showcase, 'intro\n▸ closed\n\tchild')

		await focusAtStart(rowAt(host, 'intro'))
		await userEvent.keyboard('{Meta>}a{/Meta}')
		dispatchInsertText(editingHost(host), 'replaced')

		await expect.poll(value).toBe('replaced')
	})
})

describe('drag', () => {
	/**
	 * The board's cards drag between COLUMNS, and that drag is the `Board` component's own: the
	 * editor resolves a drop by the pointer's Y through a vertical tiling of the document, and a
	 * board's columns share one Y span. `showcase.md` assigns the board's columns and cards to the
	 * consumer, and this is that assignment working.
	 */
	it('moves a card between board columns', async () => {
		const {host} = await mount(Showcase)

		const columnWith = (text: string) =>
			[...host.querySelectorAll<HTMLElement>('[class*="boardColumn"]')].find(column =>
				column.textContent.includes(text)
			)!
		const card = [...host.querySelectorAll<HTMLElement>('[draggable="true"]')].find(element =>
			element.textContent.includes('EU region quota')
		)!

		const dataTransfer = new DataTransfer()
		card.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer}))
		// The board learns WHICH card is in flight from React state, which the dragstart above only
		// schedules — a drop dispatched in the same tick reads the state from before it.
		await new Promise(resolve => setTimeout(resolve, 0))
		const target = columnWith('Shipped')
		target.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer}))
		target.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer}))

		await expect.poll(() => columnWith('Shipped').textContent).toContain('EU region quota')
		expect(columnWith('To do').textContent).not.toContain('EU region quota')
	})

	/**
	 * A MULTI-ROW SELECTION, dropped at a depth. Esc turns the caret into a row selection, Shift+Down
	 * grows it, and the pointer's horizontal position chooses which of the gap's legal depths the
	 * pair lands at — the whole claim about depth, made without asserting on any internal.
	 */
	it('drops a Shift-selected pair at the depth the pointer chooses', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta\n- target')

		const alpha = rowAt(host, 'alpha')
		await focusAtStart(alpha)
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')

		const target = rowAt(host, 'target')
		const box = target.getBoundingClientRect()
		await dragTo(host, alpha, box.right, box.bottom - 1)

		await expect.poll(value).toBe('- target\n\t- alpha\n\t- beta')
	})
})

describe('the empty row', () => {
	it('carries the placeholder while it is empty and drops it once it is not', async () => {
		const {host} = await mount(Empty)
		const row = rowsOf(host)[0]

		expect(row.dataset.placeholder).toBe('Type / for commands…')
		expect(window.getComputedStyle(row, '::before').content).toContain('Type / for commands')

		await focusAtStart(row)
		dispatchInsertText(editingHost(host), 'x')

		await expect.poll(() => window.getComputedStyle(rowsOf(host)[0], '::before').content).toBe('none')
	})
})