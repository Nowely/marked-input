import type {MarkedInputProps} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {BLOCK_CONTROLS, editingHost, findEditingHost, rowsOf} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset, focusAtStart} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {APOLLO_DOC} from './document'
import {notionOptions} from './notion'
import * as NotionStories from './Notion.stories.react'

/**
 * THE SHOWCASE, DRIVEN. Every claim below is a gesture a user makes and the value the editor
 * emits afterwards — no internal is read, and the only component-level readings are of the DOM
 * the page paints.
 *
 * The page under test is built from `notion/` alone, so a failure here is a failure of
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

/**
 * The row element reading exactly `text`, at any depth in document order — a nested row is not a
 * child of the host.
 *
 * IT ASKS THE EDITOR WHAT A ROW IS. `resolveNodeSlot` puts its own `styles.Block` on every row it
 * resolves, kind or paragraph, and a kind's component spreads the `className` it is handed; that
 * class is the row, whatever tag the consumer chose to paint it as. The lookup used to say `div`,
 * and a page whose kinds are all `<div>` today hid what that costs: rendering `Paragraph` as `<p>`
 * — a semantics-only change that alters nothing about the editor — reddened three unrelated tests
 * with `no element reading "alpha"`, a message whose first reading is "the document broke".
 *
 * `BlockControls` shares the prefix and is not a row (ADR-0007), so it and its subtree are out.
 */
const ROW = `[class*="Block"]:not(${BLOCK_CONTROLS}):not(${BLOCK_CONTROLS} *)`

const rowAt = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>(ROW)].find(row => row.textContent.trim() === text)
	if (!found) throw new Error(`no row reading ${JSON.stringify(text)}`)
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

/** The same pick, named by the popup it is in — for a test that mounts more than one editor. */
const menuItem = (label: string) => page.getByRole('listitem').getByText(label, {exact: true})

describe('the showcase page', () => {
	/**
	 * NAMED FOR COMPLETENESS, SO IT COUNTS ELEMENTS. Asserting the page's TEXT proves nothing about
	 * its kinds: a raw-bodied kind's own text is the document's text, so deleting `properties`,
	 * `toc`, `metrics`, `comments`, `views`, `title`, `caption`, `divider` and `tableFooter` from
	 * the options array left every substring in place and this test green. What only the kind can
	 * produce is the ELEMENT it paints, so that is what is read.
	 */
	it('paints every block kind of the reference page', async () => {
		const {host} = await mount(Showcase)
		const count = (selector: string) => host.querySelectorAll(selector).length

		expect({
			title: count('[class*="title"]'),
			properties: count('[class*="propertyLabel"]'),
			divider: count('[class*="divider"]'),
			tocEntries: count('[class*="tableOfContentsItem"]'),
			headings: count('[class*="heading"]'),
			caption: count('[class*="caption"]'),
			views: count('[role="tablist"]'),
			tableHead: count('[class*="tableHeadLine"]'),
			tableLines: count('[class*="tableLine"]:not([class*="tableHeadLine"])'),
			tableFooter: count('[class*="tableFooterSummary"]'),
			boardColumns: count('[class*="boardColumnHeader"]'),
			metrics: count('[class*="metricCard"]'),
			callout: count('button[class*="calloutIcon"]'),
			bullets: count('[class*="listBullet"]'),
			todos: count('input[type="checkbox"]'),
			toggles: count('[class*="toggleChildren"]'),
			code: count('[class*="codeBlock"]'),
			quote: count('[class*="quote"]'),
			bookmark: count('[class*="bookmarkThumbnail"]'),
			comments: count('[class*="commentBody"]'),
		}).toEqual({
			title: 1,
			properties: 7,
			divider: 1,
			tocEntries: 4,
			headings: 6,
			caption: 1,
			views: 1,
			tableHead: 1,
			tableLines: 5,
			tableFooter: 1,
			boardColumns: 3,
			metrics: 4,
			callout: 1,
			bullets: 4,
			todos: 2,
			toggles: 3,
			code: 1,
			quote: 1,
			bookmark: 1,
			comments: 2,
		})

		// And the marks, which are the same claim one level down.
		expect(host.textContent).toContain('GA holds only if cutover lands by 2026-04-09')
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
	/**
	 * THE GESTURE CONTINUES, and that half is the point: a value assertion alone passes while the
	 * pick blurs the editor, and a user who cannot type the heading's text has not inserted a
	 * heading. So the claim is the insert AND the next character — asserted through the emitted
	 * value, which only a live caret in the new row can produce.
	 */
	it('inserts a kind on an empty row, and the next keystroke lands in it', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Heading 2')
		await expect.poll(value).toBe('## ')

		await userEvent.keyboard('a')

		await expect.poll(value).toBe('## a')
	})

	/**
	 * The other half of the same gesture: on a row that already has text the menu CONVERTS it, and
	 * the text the user typed is what the new kind holds. The trigger leaves in the same splice,
	 * and the caret stays where the trigger was — so the next character lands AFTER the text and
	 * not in front of it, which is the reading that separates a live caret from a restored one.
	 */
	it('converts a row that already has text, keeping the text and the caret', async () => {
		const {host, value} = await mountControlled(Showcase, 'plain row')

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Quote')
		await expect.poll(value).toBe('> plain row')

		await userEvent.keyboard('!')

		await expect.poll(value).toBe('> plain row!')
	})

	/**
	 * NO ENTRY OF THIS MENU MAY EAT THE PAGE. A closed kind's raw body is allowed to cross
	 * separators — that is what makes it closed — so a kind whose opener is a PREFIX of another
	 * kind's reaches forward to the next line that spells it and swallows everything between.
	 * `properties` and `divider` were that pair: one click on **Divider** at the end of the
	 * showcase took it from 36 rows to 3, and the assertion that catches it is the row count.
	 */
	it('leaves every row of the page standing when a divider is added to it', async () => {
		const {host, value} = await mountControlled(Showcase, APOLLO_DOC)
		const before = rowsOf(host).length

		await focusAtEnd(rowsOf(host).at(-1)!)
		dispatchInsertText(editingHost(host), '/')
		await choose('Divider')

		await expect.poll(value).toBe(`${APOLLO_DOC}---`)
		expect(rowsOf(host)).toHaveLength(before)
	})

	/**
	 * EVERY ENTRY, driven — the census as a pin rather than as a spot check, and derived from
	 * `notionOptions` so a kind added without a seed fails here rather than shipping.
	 *
	 * The rule it holds: an ATOMIC kind's menu entry must carry `menu.text`. Its row has no
	 * editable surface, so an empty body can never be filled through the editor — seven entries
	 * used to insert a blank panel, a blank grid or a blank card and leave the user nothing to do
	 * with it. `tableHeader` was the only one of the seven that had the seed.
	 *
	 * WHAT IS STILL TRUE AND IS NOT A DEFECT: the keystroke after an atomic insert goes nowhere.
	 * The `/` menu's contract is turn THIS ROW into that kind, and an atomic row generates no
	 * caret position, so there is no seam through which a consumer could ask for a row below. That
	 * is the one block-kind gesture the option API cannot express, and it is named here rather
	 * than worked around.
	 */
	it('inserts a block that paints something, for every entry it offers', async () => {
		const labels = notionOptions.map(option => option.menu?.label).filter(label => label !== undefined)
		const blank: string[] = []

		for (const label of labels) {
			const {host, value} = await mountControlled(Empty, '')
			await focusAtStart(rowsOf(host)[0])
			dispatchInsertText(editingHost(host), '/')
			// Named inside the OPEN POPUP rather than by page text: this loop leaves its earlier
			// editors mounted, and one of the seeds paints a view tab that reads like a menu label.
			await menuItem(label).click()
			await expect.poll(value).not.toBe('')

			const inserted = value()
			await userEvent.keyboard('Z')
			const fillable = value() !== inserted
			if (!fillable && host.textContent.trim() === '') blank.push(label)
		}

		expect(labels.length).toBeGreaterThan(20)
		expect(blank).toEqual([])
	})

	/** The menu is `overlay.entries`, so a keyword no label contains still narrows it. */
	it('narrows by a keyword that appears in no label', async () => {
		const {host} = await mount(Empty)

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/kanban')

		await expect.element(page.getByText('Board', {exact: true})).toBeVisible()
		expect(page.getByText('Quote', {exact: true}).elements()).toHaveLength(0)
	})

	/**
	 * A RAW CLOSED BODY TAKES NO TRIGGER. Its content is bytes the parse never re-enters — that is
	 * why Enter inside a fence is a literal newline — so a `/` there is a character, exactly as it
	 * is in Notion. It used to open the menu, and the pick then retyped the ROW: `'```bash⏎ls
	 * -la⏎```⏎tail'` with the caret at the end of `ls -la`, then **Divider**, emitted
	 * `'---ls -la⏎tail'`. Both fence markers and the language gone, and the command text now the
	 * divider's body.
	 */
	it('leaves a slash literal inside a code fence', async () => {
		const doc = '```bash\nls -la\n```\ntail'
		const {host, value} = await mountControlled(Showcase, doc)

		await focusAtEnd(host.querySelector<HTMLElement>('[class*="codeBlock"] > span')!)
		dispatchInsertText(editingHost(host), '/')

		await expect.poll(value).toBe('```bash\nls -la/\n```\ntail')
		expect(page.getByText('Divider', {exact: true}).elements()).toHaveLength(0)
		expect(host.querySelectorAll('[class*="codeBlock"]')).toHaveLength(1)
	})

	/**
	 * AN OPEN MENU BELONGS TO THE CARET THAT OPENED IT. Clicking another row left it standing —
	 * `showOverlayOn` defaults to `'change'`, so nothing re-probed on a caret move, and the
	 * outside-click listener returns early for any click INSIDE the container. The pick that
	 * followed then retyped the row the user had LEFT: caret measured in `gamma`, pointer on
	 * **Heading 2**, and the value came back `'## alpha⏎beta⏎gamma'`.
	 */
	it('closes a menu the caret has walked out of', async () => {
		const {host, value} = await mountControlled(Showcase, 'alpha\nbeta\ngamma')

		await focusAtEnd(rowAt(host, 'alpha'))
		dispatchInsertText(editingHost(host), '/')
		await expect.element(page.getByText('Heading 2', {exact: true})).toBeVisible()

		await focusAtEnd(rowAt(host, 'gamma'))

		await expect.poll(() => page.getByText('Heading 2', {exact: true}).elements()).toHaveLength(0)
		expect(value()).toBe('alpha/\nbeta\ngamma')
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
	 * THE COMMONEST STRUCTURAL GESTURE, asserted where it can actually fail: MID-row, and through
	 * the next keystroke. Every other Enter case in the suite drives from `focusAtEnd`, the one
	 * position where a caret left at the tail's END is indistinguishable from a caret at its start
	 * — and that is exactly what a controlled field did, silently, at every other offset:
	 * `'one two three'` split at 4 then typed `X` gave `'one ⏎two threeX'`.
	 */
	it('puts the caret at the start of the row a mid-row Enter opens', async () => {
		const {host, value} = await mountControlled(Showcase, 'head\none two three\ntail')

		await focusAtOffset(rowAt(host, 'one two three'), 4)
		await userEvent.keyboard('{Enter}')
		await expect.poll(value).toBe('head\none \ntwo three\ntail')

		dispatchInsertText(editingHost(host), 'X')
		await expect.poll(value).toBe('head\none \nXtwo three\ntail')
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

	/**
	 * A CHECKBOX KEEPS DOM FOCUS — that is the browser's own default for `<input type=checkbox>`,
	 * and it is the state a user is left in by the ordinary gesture of ticking a to-do. The
	 * keydown tier declines wholesale for a consumer control root, so the `Mod+Z` after the tick
	 * was swallowed: the entry was on the stack and replayed fine once you clicked back into a
	 * text row, but from where the user actually stood the edit could not be taken back. The
	 * editor's own undo is not the control's key.
	 */
	it('undoes an edit a consumer control made while that control still holds focus', async () => {
		const {host, value} = await mountControlled(Showcase, '- [ ] Confirm the EU quota')

		await page.elementLocator(host).getByRole('checkbox').click()
		await expect.poll(value).toBe('- [x] Confirm the EU quota')
		expect(document.activeElement?.tagName).toBe('INPUT')

		await userEvent.keyboard('{Meta>}z{/Meta}')

		await expect.poll(value).toBe('- [ ] Confirm the EU quota')
	})

	/**
	 * THE PAYOFF OF `useControlRef`, driven: a control a row's component painted calls a verb on
	 * its OWN node and the document is what changes. Three of them, each asserted through the
	 * emitted value — the callout's tone, the fence's language, and the footer's `+ New`.
	 *
	 * `+ New` is the interesting one. A row's component sees only its own row and the published
	 * verbs insert AFTER a row, so a footer cannot add a line above itself with `insertAfter`.
	 * What it can do is retype ITSELF as the new line and let the reparse put the footer back:
	 * `turnInto` takes a body, a body carrying the separator becomes two rows, and that is one
	 * splice — which is what controlled mode needs, since the tree has not moved when a verb
	 * returns.
	 */
	it('drives the document from a consumer’s own controls', async () => {
		const callout = await mountControlled(Showcase, '> [!warning] Careful\n\tchild')
		await page.elementLocator(callout.host).getByRole('button').first().click()
		await expect.poll(callout.value).toBe('> [!danger] Careful\n\tchild')

		const fence = await mountControlled(Showcase, '```bash\nls\n```')
		await page.elementLocator(fence.host).getByRole('combobox').selectOptions('sql')
		await expect.poll(fence.value).toBe('```sql\nls\n```')

		const table = await mountControlled(Showcase, '|= Task | Owner\n| a | b\n|+ Count 1\nafter')
		await page.elementLocator(table.host).getByRole('button', {name: '+ New'}).click()
		await expect.poll(table.value).toBe('|= Task | Owner\n| a | b\n| \n|+ Count 1\nafter')
	})

	/**
	 * THE WHOLE ATOMIC SET, read as a set rather than as two elements. A kind whose component
	 * paints no `{children}` has no document surface inside it, so everything it paints must sit
	 * under a `contenteditable="false"` root — otherwise a click or an arrow parks a blinking
	 * caret in a properties grid and every keystroke after it is swallowed. Written as a loop so
	 * it reddens for any kind that drifts, not only for the two it was written against.
	 */
	it('keeps every atomic kind out of the editable document', async () => {
		const {host} = await mount(Showcase)
		const frozen = (selector: string) => {
			const painted = host.querySelector(selector)
			if (!painted) throw new Error(`nothing painted for ${selector}`)
			return painted.closest('[contenteditable="false"]') !== null
		}

		expect({
			properties: frozen('[class*="propertyLabel"]'),
			toc: frozen('[class*="tableOfContentsItem"]'),
			views: frozen('[class*="viewTabList"]'),
			board: frozen('[class*="boardColumn"]'),
			metrics: frozen('[class*="metricCard"]'),
			bookmark: frozen('[class*="bookmarkTitle"]'),
			comments: frozen('[class*="commentBody"]'),
		}).toEqual({
			properties: true,
			toc: true,
			views: true,
			board: true,
			metrics: true,
			bookmark: true,
			comments: true,
		})
	})

	/**
	 * The same claim as a GESTURE: an atomic row generates no caret position, so ArrowDown walks
	 * past a whole run of them to the next row that has one, and the keystroke after it lands
	 * there. That is Notion's own behaviour, and it is what the freeze above buys.
	 */
	it('arrows past a run of atomic rows rather than parking a dead caret in one', async () => {
		const doc = '@title Head\n@toc\nOne\n@end\n@metrics\nA|1\n@end\n@bookmark(u|d) Book\ntail'
		const {host, value} = await mountControlled(Showcase, doc)

		await focusAtStart(rowAt(host, 'Head'))
		await userEvent.keyboard('{ArrowDown}')
		dispatchInsertText(editingHost(host), 'X')

		await expect.poll(value).toBe(doc.replace('tail', 'Xtail'))
	})

	/**
	 * The DIVIDER's rule is the row's only large target, and it is not document content either:
	 * without the freeze a click on it resolves to no anchor at all and the keystroke after it is
	 * dropped. The row's own text — normally empty — is what a keystroke there writes.
	 */
	it('writes into the divider row rather than swallowing the keystroke', async () => {
		const {host, value} = await mountControlled(Showcase, 'top\n---\ntail')

		await userEvent.click(host.querySelector<HTMLElement>('[class*="divider"]')!)
		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('top\n---Z\ntail')
	})

	/**
	 * A RAW CLOSED BODY IS BOUNDED BY BYTES NO ANCHOR NAMES — the fence's closing ``` ``` ``` line —
	 * and the delete machinery had no rule for them, so one `Delete` at the end of the body reached
	 * straight THROUGH the closing literal and glued the next row onto the code:
	 * `` '```bash\nls\n```\nplain' `` emitted `` '```bash\nlsplain' ``, with the kind gone and
	 * ` ```bash ` left painted as a paragraph. One keystroke, from a caret a click puts you at.
	 *
	 * The body's own end is where the body ends. Delete there is consumed and does nothing, which
	 * is the same answer Backspace already gives at a carved piece's start.
	 */
	it('refuses a Delete that would reach through a code fence’s closing line', async () => {
		const doc = '```bash\nls\n```\nplain'
		const {host, value} = await mountControlled(Showcase, doc)

		// The fence's own body surface — its row element also holds the language `<select>`.
		await focusAtEnd(host.querySelector<HTMLElement>('[class*="codeBlock"] > span')!)
		await userEvent.keyboard('{Delete}')

		await expect.poll(value).toBe(doc)
		expect(host.querySelectorAll('[class*="codeBlock"]')).toHaveLength(1)
	})
})

describe('undo', () => {
	/**
	 * The editor owns the stack (ADR-0012), so `Mod+Z` undoes a keystroke and `Mod+Shift+Z` puts it
	 * back. Driven in the CONTROLLED mode, which is the one the round trip has to survive: the tree
	 * has not moved when the keystroke returns, and the entry lands on the echo.
	 *
	 * The CARET is asserted as an OFFSET, because the row alone reads the same whether the undo
	 * restored the position the edit was made from or the end of the text it restored — which is
	 * the shape this line was measuring while the two disagreed.
	 */
	it('restores the value a keystroke changed, and puts it back on redo', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta')

		await focusAtOffset(rowAt(host, 'beta'), 2)
		dispatchInsertText(editingHost(host), 'XY')
		await expect.poll(value).toBe('- alpha\n- beXYta')

		await userEvent.keyboard('{Meta>}z{/Meta}')
		await expect.poll(value).toBe('- alpha\n- beta')
		expect(window.getSelection()?.focusNode?.textContent).toBe('beta')
		expect(window.getSelection()?.focusOffset).toBe(2)

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

	/**
	 * THE PICKER'S OWN KEYBOARD, finished with the key that finishes it. `SuggestionsModel`
	 * registers its keydown when the popup MOUNTS and the row keymap registered its own at editor
	 * setup, both on the container — so the keymap ran first, `handleRowEnter` had no overlay check
	 * at all, and Enter split the row out from under the highlighted name: `'ping @Mi⏎'`, no
	 * mention. Its neighbour `handleRowSelection` already defers to an open overlay on Esc; this is
	 * the same deference on the key the protocol actually claims.
	 *
	 * (The `/` menu is NOT this case and stays as declared — `BlockMenu` has no keyboard, so
	 * nothing highlights, and `navigateSuggestions` answers `'none'` for a key no one will take.)
	 */
	it('finishes a mention on Enter after the arrow keys chose it', async () => {
		const {host, value} = await mountControlled(Showcase, 'ping ')

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '@Mi')
		await expect.element(page.getByText('Milo Freeman', {exact: true})).toBeVisible()

		await userEvent.keyboard('{ArrowDown}')
		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('ping @[Milo Freeman](milo.freeman)')
	})
})

describe('the toggle', () => {
	/**
	 * THE COLLAPSED ROW, and the hazard the design carried since P3: a row that is not painted has
	 * left `bind` and taken its anchors with it. A closed toggle therefore RENDERS its children and
	 * hides them, and the value it holds is proof they are still in the document.
	 *
	 * THE COLLAPSE IS ASSERTED AS GEOMETRY, not as the attribute that causes it. `until-found` hides
	 * through the UA's `content-visibility`, which one author declaration defeats while the
	 * attribute stays exactly where it was — and `checkVisibility()` answers `true` for a subtree
	 * hidden that way, so it is not usable either. `offsetHeight` is what a user sees.
	 */
	it('collapses a closed toggle’s children while keeping them findable', async () => {
		const {host} = await mount(Showcase)
		const bodyOf = () =>
			toggleStarting(host, 'Single-region').querySelector<HTMLElement>('[class*="toggleChildren"]')

		expect(bodyOf()?.textContent).toContain('EU capacity is unconfirmed')
		expect(bodyOf()?.getAttribute('hidden')).toBe('until-found')
		expect(bodyOf()?.offsetHeight).toBe(0)

		await page.elementLocator(toggleStarting(host, 'Single-region')).getByRole('button', {name: 'Expand'}).click()

		await expect.poll(() => bodyOf()?.hasAttribute('hidden')).toBe(false)
		expect(bodyOf()?.offsetHeight).toBeGreaterThan(0)
	})

	/**
	 * OPEN IS THE DOCUMENT'S FACT, not the component's: `▾` is an open toggle and `▸` a closed one,
	 * so the reference page can ASK for its first toggle to be open, and clicking the arrow is a
	 * retype that the value carries and undo takes back. The child row is untouched by the flip —
	 * a toggle keeps its id, its text and its children across it.
	 */
	it('writes the toggle’s own state into the value, both ways', async () => {
		const {host, value} = await mountControlled(Showcase, 'intro\n▸ closed\n\tchild')

		await page.elementLocator(host).getByRole('button', {name: 'Expand'}).click()
		await expect.poll(value).toBe('intro\n▾ closed\n\tchild')

		await page.elementLocator(host).getByRole('button', {name: 'Collapse'}).click()
		await expect.poll(value).toBe('intro\n▸ closed\n\tchild')
	})

	/** The reference page's first toggle is OPEN, and it is the document that says so. */
	it('paints the showcase’s first toggle open and the two below it closed', async () => {
		const {host} = await mount(Showcase)
		const heightOf = (title: string) =>
			toggleStarting(host, title).querySelector<HTMLElement>('[class*="toggleChildren"]')?.offsetHeight

		expect(heightOf('Why we cut')).toBeGreaterThan(0)
		expect(heightOf('Single-region')).toBe(0)
		expect(heightOf('Adopt CRDT')).toBe(0)
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

describe('the row grip', () => {
	/**
	 * A PARENT'S GRIP BELONGS ON THE PARENT'S OWN LINE. The band takes its height from
	 * `block.boxOf`, which for a parent is its whole SUBTREE box, so a centred grip was painted
	 * over the CHILD's line: aiming at it — which is what `userEvent.click` and a person both do
	 * — moved the pointer onto the child, the container re-resolved hover, the grip re-painted on
	 * the child, and **Delete** removed the child while the parent stayed. A row disappeared that
	 * no gesture named.
	 *
	 * The geometry is asserted first because it is the cause: the grip must not reach past the
	 * parent's own line, whatever the subtree below it does.
	 */
	it('paints a parent’s grip on the parent’s own line, so Delete takes the row aimed at', async () => {
		const {host, value} = await mountControlled(Showcase, '- parent line\n\t- child line\n- tail')

		const parent = rowsOf(host)[0]
		const child = rowAt(host, 'child line')
		const ownLine = {top: parent.getBoundingClientRect().top, bottom: child.getBoundingClientRect().top}
		host.dispatchEvent(
			new MouseEvent('mousemove', {bubbles: true, clientY: (ownLine.top + ownLine.bottom) / 2, clientX: 0})
		)

		const grip = await page.elementLocator(host).getByRole('button', GRIP).findElement()
		const gripBox = grip.getBoundingClientRect()
		expect(gripBox.top).toBeGreaterThanOrEqual(ownLine.top)
		expect(gripBox.bottom).toBeLessThanOrEqual(ownLine.bottom)

		await userEvent.click(grip)
		await choose('Delete')

		await expect.poll(value).toBe('- tail')
	})
})

describe('the empty row', () => {
	/**
	 * A KIND'S COMPONENT PASSES ON WHAT CORE RESOLVED FOR IT. `className` carries the editor's own
	 * `min-height`, so a component that drops it leaves a row the user just created with `/` as a
	 * four-pixel sliver: no line box, nothing to click at, and no containing block for the gutter.
	 * Asserted as geometry rather than as a class name, because the geometry is what a user meets.
	 */
	it('gives an empty heading a line box the size of its own type', async () => {
		const {host} = await mount(Showcase, {defaultValue: '## \n\nplain'})

		expect(rowsOf(host)[0].offsetHeight).toBeGreaterThan(rowsOf(host)[1].offsetHeight)
	})

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