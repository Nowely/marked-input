import type {MarkedInputProps} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {ROW_CONTROLS, editingHost, findEditingHost, getElement, rowsOf} from '../../shared/lib/dom'
import {dragRowTo, GRIP} from '../../shared/lib/drag'
import {focusAtEnd, focusAtOffset, focusAtStart, settle} from '../../shared/lib/focus'
import {dispatchInsertText, dispatchPaste} from '../../shared/lib/inputEvents'
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
 * IT ASKS THE EDITOR WHAT A ROW IS. `resolveNodeSlot` puts its own `styles.Row` on every row it
 * resolves, kind or paragraph, and a kind's component spreads the `className` it is handed; that
 * class is the row, whatever tag the consumer chose to paint it as. The lookup used to say `div`,
 * and a page whose kinds are all `<div>` today hid what that costs: rendering `Paragraph` as `<p>`
 * — a semantics-only change that alters nothing about the editor — reddened three unrelated tests
 * with `no element reading "alpha"`, a message whose first reading is "the document broke".
 *
 * `RowControls` shares the prefix and is not a row (ADR-0007), so it and its subtree are out.
 */
const ROW = `[class*="Row"]:not(${ROW_CONTROLS}):not(${ROW_CONTROLS} *)`

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

/**
 * The TEXT NODE reading `text` inside `element` — what a hand-built `Range` endpoint takes, where
 * `rowAt` and its neighbours answer the element around it. A kind that paints furniture beside its
 * body (a toggle's arrow, a to-do's box) has no single child to reach for.
 */
const textReading = (element: HTMLElement, text: string): Text => {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node instanceof Text && node.data === text) return node
	}
	throw new Error(`no text node reading ${JSON.stringify(text)}`)
}

/**
 * A DOUBLE-CLICK IN THE ROW'S BLANK RIGHT MARGIN — past the end of its line, where the browser's
 * own word expansion runs off the row and answers a cross-row range. A row is a full-width block,
 * so six pixels short of its right edge is empty space on every kind the showcase paints.
 */
const marginDoubleClick = async (row: HTMLElement): Promise<void> => {
	const box = row.getBoundingClientRect()
	await userEvent.dblClick(row, {position: {x: Math.round(box.width) - 6, y: Math.round(box.height / 2)}})
}

/** A toggle row, named by the text its own line starts with — its children are inside it. */
const toggleStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>('[class*="toggleRow"]')].find(row =>
		row.textContent.trim().startsWith(text)
	)
	if (!found) throw new Error(`no toggle starting ${JSON.stringify(text)}`)
	return found
}

/**
 * The popup BOX around a rendered item — the positioned ancestor, found by the one property that
 * defines it (`position: fixed`) rather than by a hashed CSS-module class name.
 */
function popupAround(inner: HTMLElement): HTMLElement {
	for (let element: HTMLElement | null = inner; element; element = element.parentElement) {
		if (getComputedStyle(element).position === 'fixed') return element
	}
	throw new Error('Expected a fixed-positioned popup ancestor')
}

/** A theme token as the browser RESOLVES it, so the assertion compares two computed colours. */
function themeToken(host: HTMLElement, name: string): string {
	const probe = document.createElement('div')
	probe.style.backgroundColor = `var(${name})`
	host.append(probe)
	const colour = getComputedStyle(probe).backgroundColor
	probe.remove()
	return colour
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

	/**
	 * WHAT THE SNAPSHOTS CANNOT SEE. `snapshotHtml` strips `class` and `style`, which is right for a
	 * structural snapshot and leaves every mark that carries its meaning IN a class invisible: a
	 * chip and a bare span print identically, and so do a red status and a green one. So the marks
	 * whose whole job is a class swap are read as elements here.
	 *
	 * A mention and a highlight are the two that were only ever text in a snapshot — proof the
	 * markup parsed, and nothing more. The highlight is the one mark with a SLOT, so its interior is
	 * still the document's own text and the element has to WRAP it rather than replace it.
	 */
	it('paints a mention and a highlight as their own elements, not as bare text', async () => {
		const {host} = await mountControlled(Showcase, 'Owner @[Platform](team-platform), and ==gating== holds.')

		const mention = host.querySelector('[class*="mention"]')
		const highlight = host.querySelector('[class*="highlight"]')

		expect(mention?.textContent).toBe('@Platform')
		expect(highlight?.textContent).toBe('gating')
		// The markup itself never reaches the page — a mark that failed to parse prints its source.
		expect(host.textContent).not.toContain('team-platform')
		expect(host.textContent).not.toContain('==')
	})

	/**
	 * THE STATUS TONE MAP, which lives in `marks.tsx` because the tone is a property of the STATUS
	 * and not of the document. Every entry driven, plus the fallback: a value nobody mapped goes
	 * grey rather than disappearing, which is the arm an unmapped status would otherwise reach
	 * silently.
	 */
	it('gives each status its own tone, and an unmapped one the fallback', async () => {
		const line = ['Blocked', 'In progress', 'Done', 'Planned', 'At risk', 'Rescoped']
			.map(status => `<status:${status}>`)
			.join(' ')
		const {host} = await mountControlled(Showcase, line)

		// The tone NAME out of the CSS-module class, whose hash suffix is a build detail: the claim
		// is which palette slot each status reached, not what the bundler called it this run.
		const tones = [...host.querySelectorAll('[class*="chip"]')].map(
			chip => /chip(Grey|Red|Amber|Green|Blue|Purple)/.exec(chip.className)?.[1]
		)

		expect(tones).toEqual(['Red', 'Amber', 'Green', 'Grey', 'Amber', 'Grey'])
	})

	/**
	 * THE DUE DATE'S THREE READINGS, and the reason the document carries the third: "done" is not
	 * knowable from inside a mark, so `<due:… done>` is how the row says it. The reference date is
	 * `marks.tsx`'s own `TODAY`, deliberately not a wall-clock read — a page whose colours change
	 * on a date nobody chose has no assertable state.
	 */
	it('reddens a due date that is past and mutes one that is done or ahead', async () => {
		const {host} = await mountControlled(Showcase, '<due:2026-04-02> <due:2026-03-27 done> <due:2026-05-06>')

		const classes = [...host.querySelectorAll('[class*="value"]')].map(span =>
			span.className.includes('valueOverdue') ? 'overdue' : 'muted'
		)

		expect(classes).toEqual(['overdue', 'muted', 'muted'])
	})

	/** The effort bar is a picture of a NUMBER, and the number is a width the snapshot strips. */
	it('fills the effort bar to its own fraction, and clamps what is out of range', async () => {
		const {host} = await mountControlled(Showcase, '<bar:0.35> <bar:1> <bar:0> <bar:4>')

		// As NUMBERS: the fill is a picture of the fraction, and `'35.0%'` vs `'35%'` is the
		// browser's own normalisation of the same width.
		const widths = [...host.querySelectorAll<HTMLElement>('[class*="effortBarFill"]')].map(fill =>
			Number.parseFloat(fill.style.width)
		)

		expect(widths).toEqual([35, 100, 0, 100])
	})

	/**
	 * THE TITLE IS EDITABLE, which nothing asserted — it was counted as an element and never typed
	 * into. It is the first row of the reference page and the one a user meets first, and its kind
	 * paints no `{children}` fallback of its own, so a component that dropped them would leave the
	 * page's name unwritable with every count still green.
	 */
	it('types into the page title', async () => {
		const {host, value} = await mountControlled(Showcase, '@title Apollo\nbody')

		await focusAtEnd(rowAt(host, 'Apollo'))
		dispatchInsertText(editingHost(host), ' GA')

		await expect.poll(value).toBe('@title Apollo GA\nbody')
	})

	/**
	 * THE QUOTE, as a gesture rather than a count. Its kind CONTINUES and INDENTS, so Enter opens
	 * another quote and Tab nests it — the two declarations that separate it from a heading, and
	 * neither is visible in the element census.
	 */
	it('continues a quote on Enter and nests it on Tab', async () => {
		const {host, value} = await mountControlled(Showcase, '> first')

		await focusAtEnd(rowAt(host, 'first'))
		await userEvent.keyboard('{Enter}')
		dispatchInsertText(editingHost(host), 'second')
		await expect.poll(value).toBe('> first\n> second')

		await userEvent.keyboard('{Tab}')

		await expect.poll(value).toBe('> first\n\t> second')
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
	 * AND AN ENTRY THAT SEEDS TEXT PUTS THE CARET AT ITS START, not past it. A seed is content the
	 * KIND supplies — a table's column names, a board's first card — so it is there to be replaced
	 * rather than typed after: the caret used to land past the whole of it, and the first thing
	 * typed appended to the last column (`'…| EffortTask'`). The row's ENTRY is the answer, which
	 * for this CARVED seed is its FIRST CELL: `anchorAt` on a row's opener resolves to that entry,
	 * so "the start of the seed" and "its first field" are one position.
	 *
	 * IT IS THE CONTROLLED FIELD that makes it a real pin: an uncontrolled verb can name its own
	 * caret, and a controlled one cannot — the window's mapping answers there, and its affinity is
	 * RIGHT. So the seed's caret has to ride with the emission, and this asserts it did.
	 */
	it('puts the caret at the start of a seeded insert, not past it', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Table')
		await expect.poll(value).toBe('|= Task | Status | Owner | Due | Effort')

		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('|= ZTask | Status | Owner | Due | Effort')
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
		// THE UN-TYPING ENTRY IS THE ONE EXCEPTION, and it is excluded by the fact that makes it one
		// rather than by name: an option with no `markup` names the row with NO kind, so there is no
		// block for it to insert. `/text` on an empty row correctly leaves an empty paragraph, which
		// is what the case below drives.
		const labels = notionOptions
			.filter(option => option.markup !== undefined)
			.map(option => option.menu?.label)
			.filter(label => label !== undefined)
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

	/**
	 * THERE IS A WAY BACK TO PLAIN TEXT. Every other entry names a kind to turn INTO, and the
	 * paragraph is the one kind no option can declare — it is `slots.paragraph`, core's own
	 * fallback — so a row converted to a quote or a toggle stayed one: `/text` matched nothing and
	 * Enter split the row. The entry is an option with a `menu` and NO `markup`, which is already
	 * this API's spelling for "inserts nothing itself".
	 *
	 * Driven with the KEYBOARD to its end, because a menu pick that leaves the caret nowhere reads
	 * as a pass: the character after it has to land in the row that was un-typed.
	 */
	it('turns a typed row back into plain text', async () => {
		const {host, value} = await mountControlled(Showcase, '> a quote row')

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/text')
		await expect.element(page.getByText('Text', {exact: true})).toBeVisible()

		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('a quote row')
		await userEvent.keyboard('!')
		await expect.poll(value).toBe('a quote row!')
	})

	/**
	 * AN EXACT MATCH IS WHAT ENTER PICKS. The list was declaration order, so `/table` committed
	 * **Table of contents** on the first try and `/to` did the same — harmless while Enter picked
	 * nothing, a wrong write once it picked the first row. Asserted on the LIST rather than on the
	 * commit, because the order is the claim.
	 */
	it('offers the exact match first, and a hidden keyword last', async () => {
		const {host} = await mountControlled(Showcase, 'plain row')
		const labels = () =>
			page
				.getByRole('listitem')
				.elements()
				.map(item => item.textContent)

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/table')
		await expect.element(page.getByText('Table', {exact: true})).toBeVisible()

		expect(labels()).toEqual(['Table', 'Table of contents', 'Table row', 'Table footer'])
	})

	/**
	 * THE REPORTED GESTURE, and the one every green round missed because every green round used a
	 * MOUSE. `/h2` then Enter left the literal `/h2` in the row and split it: the shipped menu had
	 * no highlight and no Enter, while the `@` picker one option away had both.
	 */
	it('turns a row from the keyboard alone — type, arrow, Enter', async () => {
		const {host, value} = await mountControlled(Showcase, 'plain row')

		await focusAtEnd(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/h2')
		await expect.element(page.getByText('Heading 2', {exact: true})).toBeVisible()

		await userEvent.keyboard('{ArrowDown}')
		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('## plain row')
	})

	/**
	 * AND WITHOUT THE ARROW, which is the gesture everyone tries first. `/page t` narrows to one
	 * entry; Enter used to split the row and leave the literal `/page t` in the document, because
	 * nothing was highlighted and `navigateSuggestions` read that as "the key is free".
	 *
	 * The HIGHLIGHT is asserted beside the value: Enter picking the right row and Enter picking a
	 * row the user cannot see are the same emitted string, and only the first is the contract.
	 */
	it('picks with Enter alone, and shows which row it will pick', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/page t')
		await expect.element(menuItem('Page title')).toBeVisible()
		expect(page.getByRole('listitem').elements()).toHaveLength(1)
		expect(getElement(menuItem('Page title')).closest('li')?.className).toContain('Active')

		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('@title ')
	})

	/**
	 * AND IT LOOKS LIKE THIS PAGE. The menu, the mention picker and the grip menu were all
	 * white-on-light inside a dark page — browser chrome sitting on a document. The showcase
	 * declares the adapter's own theme names in `theme/tokens.css`, so the fix is a token map
	 * rather than an override of a hashed CSS-module class.
	 *
	 * Read as COMPUTED COLOUR, not as a declaration: what a user sees is the pixel, and a
	 * variable declared on an ancestor the popup does not descend from would still read as
	 * declared while painting white.
	 */
	it('paints the menu in the page\u2019s own surface colour, not browser white', async () => {
		const {host} = await mount(Empty)

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await expect.element(page.getByText('Heading 2', {exact: true})).toBeVisible()

		const popup = popupAround(getElement(page.getByText('Heading 2', {exact: true})))
		expect(getComputedStyle(popup).backgroundColor).not.toBe('rgb(255, 255, 255)')
		expect(getComputedStyle(popup).backgroundColor).toBe(themeToken(host, '--notion-surface-overlay'))
	})

	/** The menu is `overlay.list.rows`, so a keyword no label contains still narrows it. */
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
	 * A MULTI-WORD ENTRY IS TYPEABLE IN FULL. Every one this page offers — `To-do list`,
	 * `Table of contents`, `Metric cards` — was reachable only by typing the first word and
	 * arrowing: the query's alphabet was `\w`, so the hyphen closed the menu on `/To-` and the
	 * space closed it on `/Table `. Driven one keystroke at a time and asserted at the character
	 * that used to close it, because the row list alone reads the same whether the menu narrowed to
	 * one row or fell back to none.
	 */
	it('narrows through the hyphen of a multi-word entry, and inserts it', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/To')
		await expect.element(page.getByText('To-do list', {exact: true})).toBeVisible()

		dispatchInsertText(editingHost(host), '-do list')
		await expect.element(page.getByText('To-do list', {exact: true})).toBeVisible()
		expect(page.getByRole('listitem').elements()).toHaveLength(1)

		await choose('To-do list')
		await expect.poll(value).toBe('- [ ] ')
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
	 * PROSE INSIDE A TOGGLE, which is a CONSUMER DECLARATION and was one word wrong. Declaring
	 * `continues: true` on the toggle kinds made Enter at the end of a title open ANOTHER toggle,
	 * and Tab then nested a toggle inside a toggle — so the only way to put a line of text in one
	 * was Enter, Tab, `/text`. A list item continues; a CONTAINER does not.
	 *
	 * WHAT IS STILL A GAP, and it is the Tab: `continues` carries a KIND and the tail is written at
	 * the row's OWN lead, so no option can say "Enter opens a CHILD of this row". Filed in
	 * `docs/scratch/notion-like/map.md` with what a depth-carrying form would take.
	 */
	it('opens a plain line under a toggle rather than another toggle', async () => {
		const {host, value} = await mountControlled(Showcase, '▾ Why\n\tbody line')

		await focusAtOffset(toggleStarting(host, 'Why'), 'Why'.length)
		await userEvent.keyboard('{Enter}')
		await expect.poll(value).toBe('▾ Why\n\tbody line\n')

		await userEvent.keyboard('{Tab}')
		dispatchInsertText(editingHost(host), 'prose')

		await expect.poll(value).toBe('▾ Why\n\tbody line\n\tprose')
	})

	/**
	 * THE DEMOTE LADDER, on the page's own kinds: a row gives up its DEPTH first and then its KIND,
	 * and both keys that climb it are `showcase.md`'s own — Enter to leave a list from its empty
	 * last item, Backspace at a block's start to make it a paragraph. Every other Enter and
	 * Backspace here lands on a row with text in it, where the ladder never runs at all, so a
	 * ladder that gave nothing back left this file green.
	 */
	it('leaves the list on Enter from an empty item, and un-types a heading on Backspace at its start', async () => {
		const list = await mountControlled(Showcase, '- alpha')
		await focusAtEnd(rowAt(list.host, 'alpha'))
		await userEvent.keyboard('{Enter}')
		await expect.poll(list.value).toBe('- alpha\n- ')

		await userEvent.keyboard('{Enter}')
		await expect.poll(list.value).toBe('- alpha\n')

		const heading = await mountControlled(Showcase, '## Launch tasks')
		await focusAtStart(rowAt(heading.host, 'Launch tasks'))
		await userEvent.keyboard('{Backspace}')
		await expect.poll(heading.value).toBe('Launch tasks')
	})

	/**
	 * A PASTED CLIP'S LINES ARE ROWS, and they take Enter's rules: the line the clip opens keeps the
	 * list item's depth and its kind, where the raw `⏎` the paste used to splice carried neither and
	 * left the second line at depth 0, outside the list. Driven through a real `paste` event so the
	 * clipboard entry, the `beforeinput` that follows it and the row arm all run in order.
	 */
	it('opens a pasted clip’s second line as a row at the caret row’s depth', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n\t- beta\n- gamma')

		await focusAtEnd(rowAt(host, 'beta'))
		dispatchPaste(editingHost(host), 'one\ntwo')

		await expect.poll(value).toBe('- alpha\n\t- betaone\n\t- two\n- gamma')
	})

	/**
	 * A ROW SELECTION IS THE ROWS, and every gesture over it says so: Esc escalates the caret onto
	 * the row, Shift+Down grows the hold by one, and Backspace takes both rows away — where deleting
	 * the span between the anchors left the first row's own opener standing as an empty heading.
	 * Driven with real keys, because the escalation, the grow and the delete are three listeners on
	 * the container and only the browser puts them in order.
	 */
	it('deletes the rows an Esc selection holds, openers and all', async () => {
		const {host, value} = await mountControlled(Showcase, '## Launch tasks\n- alpha\n- beta')

		await focusAtStart(rowAt(host, 'Launch tasks'))
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('- beta')
	})

	/**
	 * TYPING OVER A ROW SELECTION THE BROWSER FORMED, which is the plainest one there is: Home,
	 * Shift+ArrowDown, a character. Chromium ends that selection at the NEXT row's first typable
	 * position — `getSelection().toString()` is `'beta\n'` where the highlight paints only `beta`
	 * — so the anchors the `beforeinput` names carry a row BOUNDARY. Written over verbatim they
	 * deleted the separator and the next row's opener with the text: `'- alpha⏎- Xgamma'` out of
	 * three bullets, one row and its whole opener gone from one keystroke.
	 *
	 * DRIVEN WITH REAL KEYS, and Shift+ArrowDown is the load-bearing one: the FIRST press is
	 * native — no row selection stands yet, so the arm declines it (ADR-0002) — and only the
	 * browser produces the span it leaves behind.
	 */
	it('replaces only the selected row when a character is typed over it', async () => {
		// One kind for all three, so every row's text starts at the same x: ArrowDown keeps the
		// caret's COLUMN, and a quote below a bullet lands it four characters into the line.
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta\n- gamma')

		await focusAtStart(rowAt(host, 'beta'))
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await userEvent.keyboard('X')

		await expect.poll(value).toBe('- alpha\n- X\n- gamma')
	})

	/** Tab moves every row the selection holds, which is the set the drag and the menu already act on. */
	it('indents every row of a standing row selection', async () => {
		const {host, value} = await mountControlled(Showcase, '- alpha\n- beta\n- gamma')

		await focusAtStart(rowAt(host, 'beta'))
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await userEvent.keyboard('{Tab}')

		await expect.poll(value).toBe('- alpha\n\t- beta\n\t- gamma')
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
	 * TICK A BOX AND KEEP TYPING, which is what every real user does and what nothing in this file
	 * did. A `<input type=checkbox>` takes DOM focus on mousedown — the browser's own default — and
	 * leaves the SELECTION exactly where it was, so the editor was left holding a live caret it
	 * could not act on: a contenteditable emits no `beforeinput` while a descendant control has
	 * focus, and `isConsumerKeyOrigin` declines the whole keydown tier for a control root. Typing
	 * did nothing, Enter did nothing, the value did not move and nothing said so.
	 *
	 * A COMMIT IS WHERE THE CONTROL'S INTERACTION HAS LANDED, so that is where the host takes its
	 * focus back — {@link SelectionDriver.reclaimFocus}. Asserted by TYPING rather than by reading
	 * `document.activeElement`: focus is the mechanism, the next character is the gesture.
	 */
	it('keeps typing after a consumer control edits the document', async () => {
		const {host, value} = await mountControlled(Showcase, '- [ ] Confirm the EU quota')
		await focusAtEnd(rowsOf(host)[0])

		await page.elementLocator(host).getByRole('checkbox').click()
		await expect.poll(value).toBe('- [x] Confirm the EU quota')

		await userEvent.keyboard('!')

		await expect.poll(value).toBe('- [x] Confirm the EU quota!')
	})

	/**
	 * The same for a `<select>`, the other control shape a row kind paints. A row AFTER the fence,
	 * because a document ending in a raw body grows one on its own (`#keepTailEnterable`) and the
	 * value would then move for a reason that is not this case's.
	 */
	it('keeps typing after a language select edits the document', async () => {
		const {host, value} = await mountControlled(Showcase, '```bash\nls\n```\nafter')
		await focusAtEnd(rowsOf(host)[0])

		await page.elementLocator(host).getByRole('combobox').selectOptions('sql')
		await expect.poll(value).toBe('```sql\nls\n```\nafter')

		await userEvent.keyboard('!')

		await expect.poll(value).toBe('```sql\nls!\n```\nafter')
	})

	/**
	 * A KEYSTROKE OVER A SELECTED ROW REACHES THE DOCUMENT even when the row BELOW opens with a
	 * `meta`. The row selection stood, Backspace over it worked, and typing did nothing at all: the
	 * event's target range ends inside the consumer's own decoration for that `meta` — a
	 * `contenteditable="false"` span the model can name no anchor in — and the whole read failed
	 * closed. A selection that paints and then eats the keystroke is worse than one that writes the
	 * wrong bytes, because nothing on screen says the editor is alive. The LIVE selection answers
	 * when the event's own range resolves to nothing.
	 */
	it('types over a selected row whose neighbour opens with a meta', async () => {
		const {host, value} = await mountControlled(Showcase, 'a\n- [x] todo\nnext')

		await focusAtEnd(rowAt(host, 'next'))
		await page.getByText('a', {exact: true}).first().tripleClick()
		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('Z\n- [x] todo\nnext')
	})

	/**
	 * A SELECTION EDGE ON A FROZEN ROW'S ELEMENT MAY NOT BE WRITTEN THROUGH. The pair is a text
	 * selection — one edge is INSIDE the paragraph's content, `store.rows.selected()` is empty, and
	 * round nine's refusal never sees it — but the other edge names bytes the user can neither see nor
	 * put a caret in. MEASURED on the showcase: triple-click the intro paragraph's LAST wrapped line,
	 * where Chromium ends the range at `(the table of contents' element, 0)`, and type once: the
	 * `@toc` opener and its first entry went with the sentence, 76 lines to 74, two rows merged into
	 * the truncated paragraph.
	 *
	 * THE RANGE IS BUILT BY HAND, and deliberately: the triple-click that produced it now selects the
	 * ROW, so driving the gesture would pin the gesture instead of the write it exposed — and a mouse
	 * sweep still reaches this shape.
	 */
	it('writes no bytes of a frozen row a text selection ends on', async () => {
		const {host, value} = await mountControlled(Showcase, 'lead sentence\n@toc\nSection\n@end\nafter')
		const lead = rowAt(host, 'lead sentence').firstChild?.firstChild
		const frozen = host.querySelector<HTMLElement>('[class*="tableOfContents"]')
		if (!(lead instanceof Text) || !frozen) throw new Error('the page painted no paragraph text or no toc')

		window.getSelection()?.setBaseAndExtent(lead, 5, frozen, 0)
		await settle()
		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('lead Z\n@toc\nSection\n@end\nafter')
	})

	/**
	 * AND A WRITE MAY NOT TAKE CONTENT NOBODY CAN SEE. A collapsed toggle RENDERS its children and
	 * hides them, so their text is in the DOM and the browser's own paragraph walk takes it: MEASURED
	 * on the showcase, a triple-click of `'▸ Single-region GA first'` carries the hidden body in
	 * `range.toString()`, and typing over it emitted `'▸ Z'` — 76 lines to 75, the body gone with
	 * nothing having shown it. The OPEN toggle beside it keeps its children under the same gesture,
	 * which is what makes this the collapse rather than the selection.
	 */
	it('leaves a collapsed toggle its hidden body when the selection is typed over', async () => {
		const {host, value} = await mountControlled(Showcase, '▸ head\n\tbody\nafter')
		const head = textReading(toggleStarting(host, 'head'), 'head')
		const next = rowAt(host, 'after').firstChild?.firstChild
		if (!(next instanceof Text)) throw new Error('the page painted no row text')

		// The range a triple-click of the closed toggle makes: its own line, plus the body it hides.
		window.getSelection()?.setBaseAndExtent(head, 0, next, 0)
		await settle()
		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('▸ Z\n\tbody\nafter')
	})

	/**
	 * THE SECOND DOOR OF THE SAME RULE. The clip above guarded the TEXT write and not the EXACT-ROW
	 * COVER, which Backspace, Delete, cut, paste and a typed character over a row selection all
	 * reach — and a collapsed toggle's subtree is inside its own `position.end`, so a sweep that
	 * covers the toggle's row whole covered a body nothing on the screen had shown. MEASURED on the
	 * showcase: two hidden lines under `'▸ Open questions'` died to one Backspace, silently.
	 *
	 * The rule only ever SHRINKS the write, so the visible half still goes: the toggle's own line is
	 * taken with the paragraph above it and its hidden body is left standing.
	 */
	it('leaves a collapsed toggle its hidden body when a row cover is deleted', async () => {
		const {host, value} = await mountControlled(Showcase, 'before\n▸ head\n\tbody\nafter')
		const first = rowAt(host, 'before').firstChild?.firstChild
		const next = rowAt(host, 'after').firstChild?.firstChild
		if (!(first instanceof Text) || !(next instanceof Text)) throw new Error('the page painted no row text')

		// An exact cover of the two rows the user can see: the paragraph, and the toggle's own line.
		window.getSelection()?.setBaseAndExtent(first, 0, next, 0)
		await settle()
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('\tbody\nafter')
	})

	/**
	 * AND THE OPEN TOGGLE BESIDE IT STILL LOSES ITS CHILDREN to the identical gesture, which is what
	 * tells the collapse apart from the selection: nothing here reads the row set or the span, only
	 * whether the frame paints a box for each row inside it.
	 */
	it('takes an OPEN toggle’s children under the same row cover', async () => {
		const {host, value} = await mountControlled(Showcase, 'before\n▾ head\n\tbody\nafter')
		const first = rowAt(host, 'before').firstChild?.firstChild
		const next = rowAt(host, 'after').firstChild?.firstChild
		if (!(first instanceof Text) || !(next instanceof Text)) throw new Error('the page painted no row text')

		window.getSelection()?.setBaseAndExtent(first, 0, next, 0)
		await settle()
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('after')
	})

	/**
	 * THE SURVIVING BODY IS A ROW, NOT TEXT IN THE ROW ABOVE. A removal whose run ends the document
	 * owns no trailing separator, so `rowSelectionSpan` charges it the LEADING one instead — and a
	 * write that leaves something standing has to put that separator back, or the two rows either
	 * side of it fuse. Measured before this pin: three keystrokes turned `'intro⏎before⏎▸ head⏎⇥body'`
	 * into `'intro⇥body'`, the child's indent surviving as a literal tab in the middle of a paragraph.
	 */
	it('leaves the hidden body a row of its own when the cover ends the document', async () => {
		const {host, value} = await mountControlled(Showcase, 'intro\nbefore\n▸ head\n\tbody')
		await focusAtStart(rowAt(host, 'before'))
		await userEvent.keyboard('{Escape}')
		await settle()
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await settle()
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('intro\n\tbody')
	})

	/**
	 * THE CONTROL FOR THE SEPARATOR THE PIN ABOVE PUTS BACK: the identical document-final gesture
	 * with no toggle in it must still leave nothing behind, so a fix for the fusion cannot start
	 * stranding a separator on every ordinary delete.
	 */
	it('takes both rows and the separator when a document-final cover holds nothing hidden', async () => {
		const {host, value} = await mountControlled(Showcase, 'intro\nbefore\nlast')
		await focusAtStart(rowAt(host, 'before'))
		await userEvent.keyboard('{Escape}')
		await settle()
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await settle()
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('intro')
	})

	/**
	 * EVERY HIDDEN SUBTREE IS EXCLUDED, NOT JUST THE FIRST. The rule is "do not take what the user
	 * cannot see", which is a per-subtree exclusion — a span merely TRUNCATED at the first collapsed
	 * toggle stops at it and leaves every visible row beyond standing. Measured before this pin: a
	 * cover of four visible rows across two collapsed toggles deleted two of them and left `'▸ two'`
	 * — a row the user selected, could see, and watched survive a delete.
	 */
	it('takes every visible row a cover spans across two collapsed toggles', async () => {
		const {host, value} = await mountControlled(Showcase, 'before\n▸ one\n\tb1\n▸ two\n\tb2\nafter')
		const first = rowAt(host, 'before').firstChild?.firstChild
		const next = rowAt(host, 'after').firstChild?.firstChild
		if (!(first instanceof Text) || !(next instanceof Text)) throw new Error('the page painted no row text')

		window.getSelection()?.setBaseAndExtent(first, 0, next, 0)
		await settle()
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('\tb1\n\tb2\nafter')
	})

	/**
	 * AND THE SAME COVER PASTED OVER, which is the other verb this door serves: the arriving lines
	 * take the visible rows' place and every hidden subtree is still put back, in document order.
	 */
	it('keeps both hidden bodies when a cover across two collapsed toggles is pasted over', async () => {
		const {host, value} = await mountControlled(Showcase, 'before\n▸ one\n\tb1\n▸ two\n\tb2\nafter')
		const first = rowAt(host, 'before').firstChild?.firstChild
		const next = rowAt(host, 'after').firstChild?.firstChild
		if (!(first instanceof Text) || !(next instanceof Text)) throw new Error('the page painted no row text')

		window.getSelection()?.setBaseAndExtent(first, 0, next, 0)
		await settle()
		dispatchPaste(host, 'x\ny')

		await expect.poll(value).toBe('x\ny\n\tb1\n\tb2\nafter')
	})

	/**
	 * A SELECTION THAT COVERS NO CONTENT IS A POSITION, NOT A LICENCE TO WRITE THE STRUCTURE IT
	 * SPANS. A double-click in a row's blank RIGHT MARGIN is the plainest way to one: Chromium's
	 * word expansion past end-of-line answers a CROSS-ROW range whose own text is empty — measured
	 * `(the row's text, 18) -> (the next row's text, 0)` — and the write took the bytes between,
	 * which are the separator and the next row's OPENER. Reproduced on a caption, a heading, a
	 * quote and a bullet; inside a table it ate the cell delimiter instead and left a four-column
	 * header over a five-column body. Nothing was said and nothing was highlighted.
	 *
	 * THE GESTURE IS DRIVEN, not assembled: the right margin is where the browser's own expansion
	 * runs off the end of the line, and building the range by hand would pin the write while
	 * leaving the reading that produces it unmeasured.
	 */
	it('inserts at the row content when a double-click lands in its blank right margin', async () => {
		const {host, value} = await mountControlled(Showcase, '@caption cap here\n@views Table|Board\ntail')

		await marginDoubleClick(rowAt(host, 'cap here'))
		await userEvent.keyboard('Z')

		await expect.poll(value).toBe('@caption cap hereZ\n@views Table|Board\ntail')
	})

	/**
	 * AND THE DELETE PATH IS THE SAME OWNER. It resolved no edge at all — a ranged delete wrote the
	 * RAW pair — so Backspace over the same empty selection merged the two rows and ate the marker:
	 * `'lead sentence here'` + `'- bullet row'` became `'lead sentence herebullet row'`. With the
	 * span collapsed the key is Backspace at the row's own end, which takes one character.
	 */
	it('deletes one character when Backspace follows that double-click', async () => {
		const {host, value} = await mountControlled(Showcase, 'lead sentence here\n- bullet row\nafter')

		await marginDoubleClick(rowAt(host, 'lead sentence here'))
		await userEvent.keyboard('{Backspace}')

		await expect.poll(value).toBe('lead sentence her\n- bullet row\nafter')
	})

	/**
	 * A SPAN MAY NOT CUT A BLOCK OPEN. A row whose body is RAW is several LINES of the value held
	 * between an opening and a closing literal, so a selection with one edge inside it and the other
	 * outside the row deletes that block's OPENER rather than merging two rows — and leaves the
	 * closing literal standing as prose. MEASURED on the showcase: click the `Canary procedure`
	 * heading, Shift-click the fence under it and type once — `'## Canary procedureZ'` with
	 * ` ```bash ` gone, its two code lines and its closing ` ``` ` left as four free rows, 76 lines
	 * to 74. Backspace over the same sweep did the same, and `@metrics` and `@views` lost their
	 * openers to the identical gesture.
	 *
	 * BOTH KEYS, because they are two owners: the character goes through the row-selection write and
	 * the delete through `anchorsForDelete`, which is why one fix had to reach both.
	 */
	it.each([
		['Z', '## headZ'],
		['{Backspace}', '## hea'],
	])('leaves a fence its opener when a sweep ends inside its body (%s)', async (key, head) => {
		const {host, value} = await mountControlled(Showcase, '## head\n```bash\nls -la\n```\ntail')
		const fence = host.querySelector<HTMLElement>('[class*="codeBlock"]')
		if (!fence) throw new Error('the page painted no fence')

		await focusAtEnd(rowAt(host, 'head'))
		await userEvent.click(fence, {modifiers: ['Shift']})
		await settle()
		await userEvent.keyboard(key)

		await expect.poll(value).toBe(`${head}\n\`\`\`bash\nls -la\n\`\`\`\ntail`)
	})

	/**
	 * CLOSING A FENCE LEAVES THE CARET AFTER IT, not three characters behind the literal that closed
	 * it. `{after: row}` is where the edit's own post-edit anchor lands, and a row's DOM boundary
	 * descends to its edge CHILD — for a closed body that is the last character of the CODE, so
	 * Chromium read it back, the sync stored it, and the next Enter wrote another line INSIDE the
	 * fence. MEASURED: `'```bash⏎ls -la⏎```'` typed out left the caret at `ls -la|`.
	 */
	it('leaves the caret after a fence the last backtick closed', async () => {
		const {host, value} = await mountControlled(Showcase, 'before\nafter')
		await focusAtEnd(rowAt(host, 'before'))

		await userEvent.keyboard('{Enter}```bash{Enter}ls{Enter}```')
		await expect.poll(value).toBe('before\n```bash\nls\n```\nafter')

		await userEvent.keyboard('X')

		await expect.poll(value).toBe('before\n```bash\nls\n```\nXafter')
	})

	/**
	 * AND A CONTROL THAT WRITES NOTHING GIVES THE FOCUS BACK TOO. The rule above ran on the COMMIT,
	 * so it reached exactly the controls that edit the document and none of the DECORATIONS beside
	 * them — and a decoration is a `<button>`, which takes focus on mousedown like any other. All
	 * three below are registered through `useControlRef` (each inside its kind's one `Atomic`), the
	 * editor still held a live caret, and the next keystroke was lost with nothing on screen to say
	 * why. The CLICK is where such an interaction ends, so that is the trigger now.
	 *
	 * ONE `it` PER SHAPE, because they are three different components and a loop that mis-selects
	 * one of them reads as two passes and a skip.
	 */
	const decorations: [string, string, string][] = [
		['+ Add a property', '[class*="addProperty"]', '@properties\nStatus: chip:amber:Open\n@end\ntail'],
		['a view tab', 'button[class*="viewTab"]', '@views Table|Board\ntail'],
		['Reply…', '[class*="commentReply"]', '@comments\nKara|2h|Ping?\n@end\ntail'],
	]
	for (const [name, selector, document_] of decorations) {
		it(`keeps typing after clicking ${name}, which writes nothing`, async () => {
			const {host, value} = await mountControlled(Showcase, document_)
			await focusAtEnd(rowAt(host, 'tail'))
			const control = host.querySelector<HTMLElement>(selector)
			if (!control) throw new Error(`no ${selector} on the page`)

			await userEvent.click(control)
			await userEvent.keyboard('!')

			await expect.poll(value).toBe(`${document_}!`)
		})
	}

	/**
	 * And the toggle's arrow, which is a decoration that DOES write — the commit path and the click
	 * path over the same control.
	 *
	 * PRE-EXISTING AND FLAGGED, not fixed here: the character lands at the row's ENTRY rather than
	 * where the caret was. A flip of the arrow is a flip of the row's KIND, so the consumer mints a
	 * fresh element for it and the caret is re-placed at the row's entry — measured identical with
	 * the click reclaim disabled, so it is not this rule's. The to-do's box keeps its offset because
	 * a `meta` change leaves the component, and the element, in place.
	 */
	it('keeps typing after the toggle arrow', async () => {
		const {host, value} = await mountControlled(Showcase, '\u25be Why we cut it\n\tbecause')
		await focusAtEnd(toggleStarting(host, 'Why we cut it'))

		await userEvent.click(host.querySelector<HTMLElement>('[class*="toggleArrow"]')!)
		await expect.poll(value).toBe('\u25b8 Why we cut it\n\tbecause')

		await userEvent.keyboard('!')

		await expect.poll(value).toBe('\u25b8 !Why we cut it\n\tbecause')
	})

	/**
	 * THE ONE CONTROL THAT KEEPS THE FOCUS ITS OWN CLICK GAVE IT, declared rather than repaired: a
	 * `<select>` answers arrow keys and type-ahead of its own, and taking the focus off one on
	 * `click` would close the very popup the click opened. It gives the focus back on its CHANGE,
	 * which is the commit path two cases above.
	 */
	it('leaves a language select the focus its own click gave it', async () => {
		const {host} = await mountControlled(Showcase, '```bash\nls\n```\nafter')
		await focusAtEnd(rowAt(host, 'after'))
		const select = host.querySelector<HTMLElement>('select')
		if (!select) throw new Error('no language select')

		await userEvent.click(select)

		expect(document.activeElement).toBe(select)
	})

	/**
	 * AND ON A PAGE NOBODY HAS TYPED IN, WHICH IS WHERE IT ANSWERED DIFFERENTLY. The rule above was
	 * stated for a document that already held a caret; with none, the pointer's fresh-page arm
	 * claimed the row the control is painted in, and claiming a row PLACES a caret — which focuses
	 * the editing host and closes the popup the click had just opened. MEASURED: fresh load, click
	 * the language `<select>`, press `Q`, and the `Q` landed at the start of the code body with
	 * `document.activeElement` back on the container. One gesture with two answers, decided by a
	 * fact about the document rather than about the gesture.
	 */
	it('leaves it the focus on a page with no caret in it at all', async () => {
		const {host, value} = await mountControlled(Showcase, '```bash\nls\n```\nafter')
		const select = host.querySelector<HTMLElement>('select')
		if (!select) throw new Error('no language select')

		await userEvent.click(select)
		await settle()
		expect(document.activeElement).toBe(select)

		await userEvent.keyboard('Q')
		await settle()
		expect(value()).toBe('```bash\nls\n```\nafter')
	})

	/**
	 * AND THE EDIT IS TAKE-BACK-ABLE from where the user is standing. The `Mod+Z` after a tick was
	 * swallowed whole: the entry was on the stack and replayed fine once you clicked back into a
	 * text row, but from the control the key was dead. Kept beside the reclaim above, because the
	 * arm that makes it work — the undo running AHEAD of the consumer-origin gate — is still the
	 * only thing standing between a control that commits nothing (the grip) and a dead key.
	 */
	it('undoes an edit a consumer control made, from where the control left the user', async () => {
		const {host, value} = await mountControlled(Showcase, '- [ ] Confirm the EU quota')

		await page.elementLocator(host).getByRole('checkbox').click()
		await expect.poll(value).toBe('- [x] Confirm the EU quota')

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
	const undo = () => userEvent.keyboard('{Meta>}z{/Meta}')
	const redo = () => userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}')

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

		await undo()
		await expect.poll(value).toBe('- alpha\n- beta')
		expect(window.getSelection()?.focusNode?.textContent).toBe('beta')
		expect(window.getSelection()?.focusOffset).toBe(2)

		await redo()
		await expect.poll(value).toBe('- alpha\n- beXYta')
	})

	/**
	 * A RAW-BODIED KIND, which is what every case above avoided and the whole reason the stack could
	 * be reported dead while the suite was green. The caret invariant opens a row after a fence that
	 * ends the document — so picking **Code** grows the value TWICE, once for the pick and once for
	 * that door, and the door used to be an entry of its own. It stranded both directions at the
	 * same press: undoing it put the caret back in the fence, the invariant re-opened the door, and
	 * that fresh record cleared the redo stack — while the entry underneath named `'```bash⏎⏎```'`,
	 * a projection the door had already moved past, so `canUndo` refused it and the `/code`
	 * conversion could never be taken back.
	 *
	 * DRIVEN TO BOTH ENDS on purpose: one undo reads the same whether the stack survived it or died
	 * on it, and the reported gesture is exactly what the first three lines do.
	 */
	it('undoes and redoes the whole gesture that made a code block and typed in it', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/code')
		await expect.element(page.getByText('Code', {exact: true})).toBeVisible()
		await userEvent.keyboard('{ArrowDown}{Enter}')
		// The pick leaves the caret in the fence, so the next keys are typed into its body.
		await userEvent.keyboard('ls')
		await expect.poll(value).toBe('```bash\nls\n```\n')

		await undo()
		await expect.poll(value).toBe('```bash\n\n```\n')
		await undo()
		await expect.poll(value).toBe('/code')
		await undo()
		await expect.poll(value).toBe('')

		await redo()
		await expect.poll(value).toBe('/code')
		await redo()
		// THE DOOR RIDES WITH THE PICK rather than being a press of its own — the redo restores the
		// settled document, and the invariant finds the row it wants already there.
		await expect.poll(value).toBe('```bash\n\n```\n')
		await redo()
		await expect.poll(value).toBe('```bash\nls\n```\n')
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

	/**
	 * TAB AT THE LAST CELL KEEPS THE FOCUS. It used to fall through — the caret had nowhere to go,
	 * the key was not consumed, and the browser moved focus out of the editor onto the next control
	 * — which POISONED the next Enter: the editor had no focus left to split a row with, and the
	 * user's typed cell then travelled into whatever the next `/` picked. Both halves are asserted,
	 * because the focus alone reads the same as a Tab that did nothing at all.
	 *
	 * The ONE-CELL line the row menu inserts is the shape this is met in: its first cell is also its
	 * last, so Tab there never had a neighbour to walk to.
	 */
	it('keeps the focus when Tab runs out of cells, so the next Enter still splits the line', async () => {
		const {host, value} = await mountControlled(Showcase, '|= A | B\n| one')

		await focusAtEnd(cellsOf(host)[0])
		await userEvent.keyboard('{Tab}')

		expect(editingHost(host).contains(document.activeElement)).toBe(true)
		expect(value()).toBe('|= A | B\n| one')

		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('|= A | B\n| one\n| ')
	})

	/**
	 * A SECOND DATA ROW, written the obvious way: Enter at the end of the header opens a LINE, and
	 * the pipes typed there are carved into cells. The header declared no continuation once, so
	 * Enter opened a paragraph and the row a user typed sat in the document as literal
	 * `'Auth | Done | Kara'` — the table's own vocabulary as prose.
	 *
	 * The entry seeds an empty line of its own now, so this is the row ABOVE it; the seeded line's
	 * five empty cells are what the assertion's trailing `'|  |  |  |  | '` is.
	 *
	 * The CELLS are the oracle beside the value: a paragraph holding pipes and a carved line emit
	 * different strings, but only the carve puts boxes on the page.
	 *
	 * MOVING TO THE LAST COLUMN IS PART OF THE GESTURE, and it is the declared cost of where a
	 * seeded insert leaves the caret: at the seed's HEAD rather than past it, so the first character
	 * typed lands in the first column instead of appending to the last one. `End` cannot do it: each
	 * cell is its own block box, so a line boundary stops at the cell the caret is in. What Enter
	 * does from where the menu actually LEFT the caret is the case below, which is the gesture a
	 * user makes and is asserted rather than avoided.
	 */
	it('opens a data LINE when Enter ends the header the menu seeded', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Table')
		await expect.poll(value).toBe('|= Task | Status | Owner | Due | Effort')

		await focusAtEnd([...host.querySelectorAll<HTMLElement>('[class*="tableHeadCell"]')].at(-1)!)
		await userEvent.keyboard('{Enter}')
		dispatchInsertText(editingHost(host), 'Auth | Done | Kara')

		await expect.poll(value).toBe('|= Task | Status | Owner | Due | Effort\n| Auth | Done | Kara')
		expect(cellsOf(host).map(cell => cell.textContent)).toEqual(['Auth', 'Done', 'Kara'])
	})

	/**
	 * AND ENTER FROM WHERE THE MENU LEAVES THE CARET OPENS A ROW ABOVE, which is Enter's own rule at
	 * a row's start and is DECLARED rather than repaired — `packages/website/src/content/docs/guides/rows.md`
	 * is where a user reads it. A seeded insert leaves the caret at the seed's head, so the very
	 * next Enter is Enter at a row's start: an empty row of what this kind CONTINUES INTO opens
	 * above, and the header goes on being the header.
	 *
	 * IT USED TO DESTROY THE TABLE, and this case exists because the pass that found it rewrote the
	 * gesture instead of asserting it. `continues` was applied to the half that kept the CONTENT, so
	 * the split left an empty `'|= '` above and demoted the seeded column names to a data LINE — the
	 * table's head gone in one keystroke, from the first key a user presses after inserting one.
	 * Now the half that keeps the content keeps the kind, and only the empty half is opened.
	 */
	it('opens an empty row ABOVE when Enter runs where the menu left the caret', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Table')
		await expect.poll(value).toBe('|= Task | Status | Owner | Due | Effort')

		await userEvent.keyboard('{Enter}')

		await expect.poll(value).toBe('| \n|= Task | Status | Owner | Due | Effort')
		expect(host.querySelectorAll('[class*="tableHeadCell"]').length).toBe(5)
	})

	/**
	 * TYPING OVER A CELL KEEPS THE COLUMN AFTER IT. A triple-click on a cell ends at the NEXT cell's
	 * entry, and the bytes between them are the `' | '` the kind carved at — structure the highlight
	 * never paints. Written over, the row came out one column SHORT, and the same gesture on the
	 * last cell ate the row below. It is a text selection by every reading this editor has —
	 * `store.rows.selected()` is empty, because no gesture may name a carved piece — so the row
	 * selection could not have covered it; the rule is the CONTENT each edge names.
	 */
	it('keeps the column after a cell typed over on the showcase', async () => {
		const {value} = await mountControlled(Showcase, APOLLO_DOC)

		await page.getByText('Realtime sync engine', {exact: true}).first().tripleClick()
		await userEvent.keyboard('X')

		await expect.poll(value).toContain('\n| X | <status:In progress> | <who:Milo Freeman> |')
	})

	it('writes a mention into a cell through the built-in picker', async () => {
		const {host, value} = await mountControlled(Showcase, '| Auth migration | Kara\nnext')

		await focusAtEnd(cellsOf(host)[1])
		dispatchInsertText(editingHost(host), '@')
		await choose('Milo Freeman')

		await expect.poll(value).toBe('| Auth migration | Kara@[Milo Freeman](milo.freeman)\nnext')
	})

	/**
	 * THE PICKER'S OWN KEYBOARD, finished with the key that finishes it. `OverlayListModel`
	 * registers its keydown when the popup MOUNTS and the row keymap registered its own at editor
	 * setup, both on the container — so the keymap ran first, `handleRowEnter` had no overlay check
	 * at all, and Enter split the row out from under the highlighted name: `'ping @Mi⏎'`, no
	 * mention. Its neighbour `handleRowSelection` already defers to an open overlay on Esc; this is
	 * the same deference on the key the protocol actually claims.
	 *
	 * The `/` menu is the SAME case now, and the slash-menu describe above drives it: both lists
	 * are one model with one keyboard.
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
	 * A TOGGLE THE MENU MAKES IS OPEN, and the whole of the case is the line typed INTO it. The
	 * entry used to insert the closed kind — "a new toggle has nothing inside it to show" — so the
	 * Enter-then-Tab that puts the first line there aimed the caret at a subtree with no boxes, and
	 * forty-seven characters were typed into the document with nothing on screen.
	 *
	 * `checkVisibility()` is the oracle rather than the emitted value, for the reason the collapse
	 * case below states: the value was RIGHT the whole time.
	 *
	 * AND WHAT LANDS INSIDE IT IS PROSE. The toggle kinds declare no `continues`, so Enter after a
	 * title opens a plain row and Tab puts it in the toggle — where `continues: true` used to open
	 * a second TOGGLE and Tab nested a toggle inside a toggle.
	 */
	it('opens the toggle the menu inserts, so the line typed into it is on screen', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtStart(rowsOf(host)[0])
		dispatchInsertText(editingHost(host), '/')
		await choose('Toggle list')
		await expect.poll(value).toBe('\u25be ')

		await userEvent.keyboard('title')
		await userEvent.keyboard('{Enter}')
		await userEvent.keyboard('{Tab}')
		await userEvent.keyboard('nested line')

		await expect.poll(value).toBe('\u25be title\n\tnested line')
		expect(rowAt(host, 'nested line').checkVisibility()).toBe(true)
	})

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
		// TWICE: the first press takes the caret's own row, the second the whole value. `intro`
		// is a root, so there is no rung between them.
		await userEvent.keyboard('{Meta>}a{/Meta}')
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

		// A REAL drag — see `shared/lib/drag.ts`. Its Y names the gap after `target`'s line and its
		// X, at the row's far right, names the deepest depth that gap offers.
		const target = rowAt(host, 'target')
		const box = target.getBoundingClientRect()
		await dragRowTo(host, alpha, target, {clientX: box.right - 1, clientY: box.bottom - 1})

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

	/**
	 * AND THE CARET LINE REACHES ONLY A ROW THAT PAINTS NOTHING ELSE. The rule that makes an empty
	 * row arrow-reachable (`.Row > span:first-child:empty…` in core's stylesheet) gives the row's
	 * own bare text surface an `inline-block` with a `min-height`; the same span shape occurs as a
	 * kind's LEADING FURNITURE, and giving that a line box grows a row whose consumer never asked.
	 *
	 * ITS OWN RECORD SAYS "measured over the showcase's 75 rows, exactly one height moves" AND
	 * NOTHING PINNED IT. Measured while auditing: `> span:first-child:empty:not([contenteditable])`
	 * matches 21 elements on this page and the shipped selector matches ONE — the other twenty are
	 * CARVED TABLE CELLS, whose empty lead sits ahead of a frozen decoration, and dropping the shape
	 * clause left the whole suite green.
	 *
	 * READ AS `display`, not as a height, and deliberately: on this page the cell absorbs the extra
	 * line (114x37 either way), so the damage is latent rather than visible and a geometry assertion
	 * would be the decorative kind — green for a reason that has nothing to do with the rule.
	 */
	it('gives no caret line to a carved cell’s lead, which sits ahead of what the kind paints', async () => {
		const {host} = await mount(Showcase)
		const leads = [...host.querySelectorAll<HTMLElement>('[class*="Row"] > span:first-child:empty')]
		const ahead = leads.filter(lead => lead.nextElementSibling?.matches('[contenteditable="false"]'))
		expect(ahead.length).toBeGreaterThan(0)

		expect(ahead.map(lead => window.getComputedStyle(lead).display)).toEqual(ahead.map(() => 'inline'))
	})
})

/**
 * THE BOARD, and the one component on this page that was writing nowhere. Its columns ARE the
 * document — a raw row body the option parses — but the component kept the arrangement in its own
 * `useState`, so a card dragged between columns moved on screen and nothing else happened: the
 * emitted value never changed, undo had nothing to undo, and the counts in the column headers
 * went stale against what a user could see.
 *
 * It is the SHOWCASE's defect, not the editor's, and the fix is the ordinary published route
 * every other control on this page already takes — `node.turnInto(board, {text})`, one splice.
 */
describe('the board', () => {
	const BOARD_DOC = [
		'@board',
		'To do',
		'- Sign the vendor SLA|red:Legal',
		'- EU region quota|blue:Infra',
		'- Launch copy review',
		'In progress',
		'- Auth migration|purple:Platform',
		'Shipped',
		'- Beta invites|green:Growth',
		'@end',
	].join('\n')

	const MOVED = [
		'@board',
		'To do',
		'- Sign the vendor SLA|red:Legal',
		'- EU region quota|blue:Infra',
		'In progress',
		'- Auth migration|purple:Platform',
		'Shipped',
		'- Beta invites|green:Growth',
		'- Launch copy review',
		'@end',
	].join('\n')

	/** The card reading exactly `title`, and the column whose header reads exactly `title`. */
	const cardTitled = (host: HTMLElement, title: string): HTMLElement => {
		const found = [...host.querySelectorAll<HTMLElement>('[class*="boardCard"]')].find(
			card => card.textContent.trim() === title
		)
		if (!found) throw new Error(`no board card reading ${JSON.stringify(title)}`)
		return found
	}

	const columnTitled = (host: HTMLElement, title: string): HTMLElement => {
		const found = [...host.querySelectorAll<HTMLElement>('[class*="boardColumn"]')].find(column =>
			column.querySelector('[class*="boardColumnHeader"]')?.textContent.startsWith(title)
		)
		if (!found) throw new Error(`no board column titled ${JSON.stringify(title)}`)
		return found
	}

	const countIn = (column: HTMLElement) => column.querySelector('[class*="boardColumnCount"]')!.textContent

	/**
	 * The HTML5 card drag, end to end: the card is the source, the column is the target.
	 *
	 * AWAITED BETWEEN THE EVENTS, and it is not padding: the drag source announces itself through
	 * React state, and a `drop` dispatched in the same task reads the handler closure from BEFORE
	 * that state landed — so the whole gesture is a no-op with nothing said. A real pointer takes
	 * frames between these; this is the deterministic spelling of that.
	 */
	async function dragCard(card: HTMLElement, column: HTMLElement) {
		const dataTransfer = new DataTransfer()
		const at = {bubbles: true, cancelable: true, dataTransfer}
		card.dispatchEvent(new DragEvent('dragstart', at))
		await settle()
		column.dispatchEvent(new DragEvent('dragover', at))
		await settle()
		column.dispatchEvent(new DragEvent('drop', at))
		await settle()
		card.dispatchEvent(new DragEvent('dragend', at))
	}

	it('writes a card dragged between columns into the document', async () => {
		const {host, value} = await mountControlled(Showcase, BOARD_DOC)

		await dragCard(cardTitled(host, 'Launch copy review'), columnTitled(host, 'Shipped'))

		await expect.poll(value).toBe(MOVED)
	})

	/**
	 * AND THE SAME GESTURE DRIVEN BY THE BROWSER, because the three fabricated ones above cannot see
	 * half of what they claim. A hand-dispatched `drop` fires whether or not anything accepted the
	 * `dragover`; a real one does not — the HTML5 protocol is a NEGOTIATION, and
	 * `BoardColumn.handleDragOver`'s `preventDefault()` is the whole of this board's half of it.
	 * MEASURED: delete that one line and the suite stays green at 2232, with three pins standing over
	 * a board no pointer could drop on. This drives `userEvent.dragAndDrop`, which is Playwright's
	 * own `Input.dispatchDragEvent` sequence, so the browser decides whether the drop happens at all
	 * — the same reason `shared/lib/drag.ts` exists for the editor's own row drag.
	 *
	 * THE FABRICATED ONES STAY. They assert what the drop WRITES over a deterministic clock, which is
	 * a different claim from whether the drop is reachable, and losing them would trade a flake-free
	 * value assertion for nothing.
	 */
	it('accepts a real pointer drag between columns, dragover negotiation and all', async () => {
		const {host, value} = await mountControlled(Showcase, BOARD_DOC)

		await userEvent.dragAndDrop(
			page.elementLocator(cardTitled(host, 'Launch copy review')),
			page.elementLocator(columnTitled(host, 'Shipped'))
		)

		await expect.poll(value).toBe(MOVED)
	})

	/** The counts are the visible half of the same fact: they were derived from the stale copy. */
	it('re-counts both columns from the document the drag wrote', async () => {
		const {host, value} = await mountControlled(Showcase, BOARD_DOC)
		expect([countIn(columnTitled(host, 'To do')), countIn(columnTitled(host, 'Shipped'))]).toEqual(['3', '1'])

		await dragCard(cardTitled(host, 'Launch copy review'), columnTitled(host, 'Shipped'))
		await expect.poll(value).toBe(MOVED)

		expect([countIn(columnTitled(host, 'To do')), countIn(columnTitled(host, 'Shipped'))]).toEqual(['2', '2'])
	})

	/**
	 * AND IT IS AN EDIT LIKE ANY OTHER, which is the point of writing through the published verb:
	 * the undo stack is the editor's and the board did not have to know it exists.
	 */
	it('undoes the move, because the move was a document edit', async () => {
		const {host, value} = await mountControlled(Showcase, BOARD_DOC)

		await dragCard(cardTitled(host, 'Launch copy review'), columnTitled(host, 'Shipped'))
		await expect.poll(value).toBe(MOVED)

		editingHost(host).focus()
		await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')

		await expect.poll(value).toBe(BOARD_DOC)
	})

	/**
	 * A BLOCK SELECTION IS LEGIBLE BEFORE A DESTRUCTIVE KEY ACTS ON IT, and the board is the shape
	 * that proved it was not. Clicking one card selects the whole ten-line block by design, and the
	 * only thing on screen that said so was a faint tint on three column headers: the platform's own
	 * highlight paints UNDER a kind's backgrounds, and every card has one. Backspace was one key
	 * away from taking all ten lines.
	 *
	 * THE ASSERTION IS THE PAINT, not the class: a class name is exactly the decorative pin this
	 * effort keeps finding, so what is read is the computed overlay — its background must be opaque
	 * enough to see and its box must be the ROW's, which is what "over the cards" means.
	 */
	it('paints the selected block itself, over what the kind painted', async () => {
		const {host} = await mountControlled(Showcase, BOARD_DOC)

		await userEvent.click(cardTitled(host, 'Sign the vendor SLA'))
		await settle()

		const row = rowsOf(host).find(candidate => candidate.contains(cardTitled(host, 'Sign the vendor SLA')))!
		const overlay = window.getComputedStyle(row, '::after')
		expect(overlay.content).toBe('""')
		expect(overlay.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
		expect(overlay.width).toBe(`${row.getBoundingClientRect().width}px`)
	})

	/** And nothing is painted where nothing is selected — a caret is not a block selection. */
	it('paints nothing while the selection is an ordinary caret', async () => {
		const {host} = await mountControlled(Showcase, `head\n${BOARD_DOC}`)

		await focusAtEnd(rowAt(host, 'head'))
		await settle()

		const row = rowsOf(host).find(candidate => candidate.contains(cardTitled(host, 'Beta invites')))!
		expect(window.getComputedStyle(row, '::after').content).toBe('none')
	})
})