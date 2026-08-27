import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {ROW_CONTROLS, findEditingHost, getElement} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import {APOLLO_DOC} from './document'
import * as NotionStories from './Notion.stories.react'

/**
 * WHERE THE CARET IS ALLOWED TO BE, driven on the showcase.
 *
 * Five gestures a person makes in twenty minutes, every one of which used to leave the caret
 * somewhere they could neither see nor escape. They share one reading: a caret may sit only where
 * the document is PAINTED and EDITABLE, and a document must always end in a row it can enter.
 * Nothing below reads an internal — each is a click or a keystroke and the value that came out.
 */

const {Showcase, Empty} = composeStories(NotionStories)

type Story = typeof Showcase

/** The page as a CONTROLLED field, echoing `onChange` back — the mode every value assertion runs in. */
async function mountControlled(Story: Story, initial?: string) {
	const latest = {current: initial ?? ''}
	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value ?? ''
		return <Story onChange={setValue} value={value} />
	}
	const {container} = await render(<Echo />)
	return {host: findEditingHost(container), value: () => latest.current}
}

const ROW = `[class*="Row"]:not(${ROW_CONTROLS}):not(${ROW_CONTROLS} *)`

const rowsOfHost = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>(ROW)]

const rowStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = rowsOfHost(host).find(row => row.textContent.trim().startsWith(text))
	if (!found) throw new Error(`no row starting ${JSON.stringify(text)}`)
	return found
}

/** A control a KIND paints inside its own row — the dot, the rule, the arrow. */
const controlIn = (row: HTMLElement, selector: string): HTMLElement => {
	const found = row.querySelector<HTMLElement>(selector)
	if (!found) throw new Error(`no ${selector} in row`)
	return found
}

const toggleStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>('[class*="toggleRow"]')].find(row =>
		row.textContent.trim().startsWith(text)
	)
	if (!found) throw new Error(`no toggle starting ${JSON.stringify(text)}`)
	return found
}

/** The element the caret sits in — a `Text` boundary answers its parent. */
function caretElement(): HTMLElement | null {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return null
	const node = selection.getRangeAt(0).startContainer
	const element = node instanceof HTMLElement ? node : node.parentElement
	return element
}

/**
 * IS THE CARET SOMEWHERE A PERSON CAN SEE AND USE — the two readings that separate a caret from
 * a stranded one: the browser paints a box for the element it is in, and that element is not
 * inside DOM the consumer froze with `contenteditable="false"`.
 */
function caretIsUsable(): boolean {
	const element = caretElement()
	if (!element) return false
	return element.checkVisibility() && element.closest('[contenteditable="false"]') === null
}

/** The BROWSER's own caret write — what a click leaves behind, without the click. */
function putCaret(node: Node, offset: number): void {
	const selection = window.getSelection()
	if (!selection) throw new Error('no selection')
	selection.removeAllRanges()
	const range = document.createRange()
	range.setStart(node, offset)
	range.collapse(true)
	selection.addRange(range)
}

/** Puts the caret at a text offset inside `node`, and lets the editor hear about it. */
async function caretAt(host: HTMLElement, node: Node, offset: number) {
	await userEvent.click(host)
	putCaret(node, offset)
	await settle()
}

/** The row's OWN line, skipping the child rows a kind paints inside its own element. */
function lineTextOf(row: HTMLElement): Text {
	const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode()
	while (node && (node.textContent === '' || node.parentElement?.closest(ROW) !== row)) node = walker.nextNode()
	if (!node) throw new Error('no line text')
	// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
	return node as Text
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** Dispatches a copy carrying a mock DataTransfer, and hands it back. */
function copyFrom(host: HTMLElement): DataTransfer {
	const clipboardData = new DataTransfer()
	const event = new ClipboardEvent('copy', {clipboardData, bubbles: true})
	Object.defineProperty(event, 'target', {value: host, writable: false})
	host.dispatchEvent(event)
	return clipboardData
}

/** The paste sequence a browser produces: `paste` carries the data, `beforeinput` the target range. */
function pasteAtCaret(host: HTMLElement, clipboardData: DataTransfer): void {
	const live = window.getSelection()?.getRangeAt(0)
	if (!live) throw new Error('no caret to paste at')
	host.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true}))
	const targetRange = document.createRange()
	targetRange.setStart(live.startContainer, live.startOffset)
	targetRange.setEnd(live.endContainer, live.endOffset)
	const event = new InputEvent('beforeinput', {inputType: 'insertFromPaste', bubbles: true, cancelable: true})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [targetRange]})
	Object.defineProperty(event, 'dataTransfer', {value: clipboardData})
	host.dispatchEvent(event)
}

describe('the caret goes where a person can follow it', () => {
	/**
	 * A CLICK CLAIMS THE ROW IT LANDED IN. A kind paints controls of its own — a bullet's dot, a
	 * divider's rule — and each is `contenteditable="false"`, so the browser can name no position
	 * there. The row around it holds plenty, and that row is the one the pointer was in: the caret
	 * used to be handed to whatever row the recovery's forward search reached first.
	 */
	it('claims the row a click landed in, not a neighbour', async () => {
		const {host, value} = await mountControlled(Showcase)

		await userEvent.click(controlIn(rowStarting(host, 'Vendor SLA unsigned'), '[class*="listBullet"]'))
		await settle()
		await userEvent.keyboard('ZZZ')

		expect(caretIsUsable()).toBe(true)
		expect(value()).toContain('- ZZZVendor SLA unsigned')
	})

	/**
	 * AND A ROW WITH NO POSITION AT ALL IS SELECTED. An atomic kind paints none of its own text, so
	 * there is nothing in it to put a caret on — and the two answers that were tried before are both
	 * invisible to the user. Handing the caret to a DIFFERENT row is what typing into the table of
	 * contents used to edit: the heading below it, four rows from the pointer. Doing NOTHING reads as
	 * the same defect with a different destination — the click appears inert and the next keystrokes
	 * go to wherever the caret was last, which is off screen.
	 *
	 * The row selection is the answer this editor already owns (`store.rows.selected`), and the
	 * browser paints it: the selection is written across the row's own ELEMENT, so the block is
	 * highlighted and the keys land on it.
	 *
	 * DECLARED BEHAVIOUR CHANGE: a typed character over such a row is now CONSUMED AND REFUSED,
	 * where it used to replace the row whole. The selection is reachable by the plainest gesture the
	 * page has — a click on a chip inside the properties panel, a target with no behaviour of its
	 * own — so "replace the block with this letter" put a page's metadata one keystroke away from
	 * gone: measured on the showcase, one click and one `'a'` took `@properties … @end`, 76 lines to
	 * 67. The keys that MEAN it still take the row (the Backspace case below), and a paste still
	 * replaces it; only the character is refused.
	 */
	it('selects the row when the block clicked holds no position, and refuses a typed character', async () => {
		const {host, value} = await mountControlled(Showcase, '- keep me\n@toc\nLaunch tasks\n@end\n- and me')

		await focusAtEnd(rowStarting(host, 'keep me'))
		await page.getByText('Launch tasks', {exact: true}).first().click()
		await settle()

		// The browser's own highlight is over the block, which is the whole point of selecting it.
		expect(window.getSelection()?.toString()).toContain('Launch tasks')

		await userEvent.keyboard('Z')
		await settle()

		expect(value()).toBe('- keep me\n@toc\nLaunch tasks\n@end\n- and me')
	})

	/**
	 * AND THE KEYSTROKE GOES WHERE THE SELECTION SAYS, which is the sharpest failure the contract
	 * above can have: the bookmark's row painted as selected and the typed character appended to the
	 * QUOTE above it. The selection runs across the row's own element, which is not an editable
	 * extent, so Chromium canonicalizes the `beforeinput` target range to the nearest position it
	 * can name — in the row before — and the read preferred that range over the live selection
	 * whenever it came back collapsed. Reproduced 2 of 2 before, 1 of 1 after.
	 *
	 * STATED AS "NOTHING MOVES" since the character became a refusal, and it still discriminates the
	 * rule it was written for: the defect it rejects APPENDED to the quote, so the read regressing
	 * changes the value and this case reddens either way. Backspace is the positive witness, and it
	 * is the case below.
	 */
	it('writes nothing at all when a click on a bookmark is typed over', async () => {
		// THE WHOLE PAGE, because the shape is the page's: a three-row stand-in gives Chromium a
		// target range this rule never sees, and the pin passes with the mechanism reverted.
		const {host, value} = await mountControlled(Showcase, APOLLO_DOC)

		await focusAtEnd(rowStarting(host, 'Apollo moves the collaboration'))
		await page.getByText('Auth migration — rollout plan', {exact: true}).first().click()
		await settle()

		await userEvent.keyboard('Z')
		await settle()

		expect(value()).toBe(APOLLO_DOC)

		// AND THE POSITIVE HALF, without which "nothing moved" would also pass for an editor that
		// heard nothing at all: Backspace takes the row the SELECTION names. Under the defect this
		// case was written for it acted in the quote above instead.
		await userEvent.keyboard('{Backspace}')
		await settle()

		expect(value()).not.toContain('@bookmark')
		expect(value()).toContain("we're not ready to call it GA.\n@comments")
	})

	/**
	 * AND SHIFT+ARROWDOWN OVER SUCH A ROW MOVES THE PAINT, not just the stored anchors. It used to
	 * move only the anchors: `rowScope` names its ends in ROW coordinates, a frozen row's text has
	 * no surface, so `selectRange` declined and the DOM selection stayed on the one row — after
	 * which the next keystroke, which reads DOM truth, acted on that one row. Half a gesture. The
	 * write falls back on the row's own element edge now, which is the pair the click already used.
	 */
	it('grows a frozen row selection by a row, visibly', async () => {
		const {host, value} = await mountControlled(Showcase, '- keep me\n@toc\nLaunch tasks\n@end\n- and me')

		await focusAtEnd(rowStarting(host, 'keep me'))
		await page.getByText('Launch tasks', {exact: true}).first().click()
		await settle()
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		await settle()

		expect(window.getSelection()?.toString()).toContain('and me')

		// BACKSPACE is the witness, not a typed character: a selection holding a row no caret may
		// enter refuses the character and takes the delete, so this is the key that says what the
		// grown selection covers.
		await userEvent.keyboard('{Backspace}')
		await settle()

		expect(value()).toBe('- keep me')
	})

	/** Backspace over the same selection takes the block away, opener and closing literal and all. */
	it('deletes the row a click on frozen presentation selected', async () => {
		const {host, value} = await mountControlled(Showcase, '- keep me\n@toc\nLaunch tasks\n@end\n- and me')

		await focusAtEnd(rowStarting(host, 'keep me'))
		await page.getByText('Launch tasks', {exact: true}).first().click()
		await settle()
		await userEvent.keyboard('{Backspace}')
		await settle()

		expect(value()).toBe('- keep me\n- and me')
	})

	/**
	 * THE SAME RULE WHERE THE BROWSER ANSWERS RATHER THAN DECLINES. Chromium resolves a mousedown on
	 * a `draggable` element inside a frozen island by collapsing the caret to the START OF THE
	 * EDITING HOST — a perfectly valid anchor in a row at the top of the document. A board card is
	 * such an element, and typing after clicking one rewrote the page title.
	 *
	 * THE PLATFORM'S HALF IS WRITTEN OUT rather than driven, and that is a limit of the harness
	 * rather than a shortcut: a real click on the card teleports the caret in a browser (measured
	 * with no editor present at all, and on the running showcase), and produces no teleport at all
	 * under this runner's synthetic pointer. What the two lines below stage is exactly what was
	 * measured — the press inside the frozen island, then the browser's own answer to it — and the
	 * rule under test is the editor's: the pointer's row outranks the anchor the browser named.
	 */
	it('hands no keystroke to the first row when a draggable card is pressed', async () => {
		const {host} = await mountControlled(Showcase)

		host.focus()
		controlIn(rowStarting(host, 'To do'), '[class*="boardCardDraggable"]').dispatchEvent(
			new PointerEvent('pointerdown', {bubbles: true})
		)
		putCaret(lineTextOf(rowsOfHost(host)[0]), 0)
		await settle()

		// The BOARD is what the pointer claimed — the row it was pressed in, selected across its own
		// element — and the page title the browser had named is not where anything landed.
		expect(window.getSelection()?.toString()).toContain('To do')

		await userEvent.keyboard('ZZZ')
		await settle()

		// The board holds no position a caret may take, so the characters are refused outright. Read
		// off the HOST rather than off `value()`: a refused key writes nothing, so `onChange` never
		// fires and the controlled mirror would answer `''` whatever happened on screen.
		expect(host.textContent).not.toContain('ZZZ')
		expect(host.textContent).toContain('To do')
	})

	/**
	 * A DOCUMENT MUST END IN A ROW THE CARET CAN ENTER. `/` turns THIS row into the chosen kind, so
	 * a board picked on the only row of an empty page leaves a document made of one row no caret
	 * can enter — and the grip menu's "Add below" was the only way back out.
	 */
	it('opens a row after an atomic block that ends the document', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtEnd(rowsOfHost(host)[0])
		await userEvent.keyboard('/')
		await page.getByText('Board', {exact: true}).click()
		await settle()

		expect(value()).toBe('@board\nTo do\n- First card\n@end\n')
		await userEvent.keyboard('below')
		expect(value()).toBe('@board\nTo do\n- First card\n@end\nbelow')
	})

	/**
	 * THE SAME RULE FOR A ROW THE CARET CANNOT LEAVE. A fence's body is raw, so Enter inside it is a
	 * newline for ever; at the document's end that made the block a dead end with no row after it
	 * and no gesture that opened one.
	 */
	it('opens a row after a raw-bodied block that ends the document', async () => {
		const {host, value} = await mountControlled(Empty, 'alpha\n')

		await userEvent.click(rowsOfHost(host).at(-1)!)
		await settle()
		await userEvent.keyboard('/')
		await page.getByText('Code', {exact: true}).click()
		await settle()

		expect(value()).toBe('alpha\n```bash\n\n```\n')
	})

	/**
	 * A CARET MAY NOT ENTER A SUBTREE WITH NO BOXES. A closed toggle paints its children rather than
	 * unmounting them — an unpainted row leaves the DOM layer and takes its anchors with it — so a
	 * row indented under one is in the document and on no screen: eleven characters typed there
	 * landed in the value with no visible caret.
	 */
	it('refuses to indent a row into a closed toggle', async () => {
		const {host, value} = await mountControlled(Showcase)

		const toggle = toggleStarting(host, 'Single-region GA first')
		const title = lineTextOf(toggle)
		await caretAt(host, title, title.length)
		await userEvent.keyboard('{Enter}')
		await settle()
		await userEvent.keyboard('{Tab}')
		await settle()
		await userEvent.keyboard('eleven char')

		expect(caretIsUsable()).toBe(true)
		// A plain row rather than a second toggle: the toggle kinds declare no `continues`.
		expect(value()).toContain('\neleven char\n')
		expect(value()).not.toContain('\televen char')
	})

	/**
	 * AND THE ROW HALF OF THE SAME RULE: a verb may not leave a row where nothing paints it. Tab and
	 * the drop are refused before they write, because the destination is already on screen to be
	 * asked; a RETYPE is not — a heading paints no child rows and the row only becomes a heading
	 * after the frame — so `turnInto` wrote the kind under two nested bullets and both left the
	 * screen. They stayed in the value, exported, and came back only on undo.
	 *
	 * The rows are LIFTED to the depth that paints them, in the same undo step as the retype: what
	 * the user asked for stands, and nothing they were looking at disappears.
	 */
	it('lifts the children of a row retyped into a kind that paints none', async () => {
		const {host, value} = await mountControlled(Empty, '- Milestones\n\t- Auth cutover\n\t- EU quota')

		const line = lineTextOf(rowStarting(host, 'Milestones'))
		await caretAt(host, line, line.length)
		await userEvent.keyboard('/h3')
		await settle()
		await page.getByText('Heading 3', {exact: true}).click()
		await settle()

		expect(value()).toBe('### Milestones\n- Auth cutover\n- EU quota')
		expect(host.textContent).toContain('Auth cutover')
		expect(host.textContent).toContain('EU quota')

		// ONE undo takes back BOTH HALVES, because the lift is a repair rather than a step of its
		// own: the kind and the nesting come back together. What is left standing is the typed
		// `/h3` — the run the menu was opened with, which is the step below this one.
		await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
		await settle()
		expect(value()).toBe('- Milestones/h3\n\t- Auth cutover\n\t- EU quota')
	})

	/**
	 * AND IT LEAVES AN AUTHORED VALUE ALONE. The lift repairs a document being EDITED — the same
	 * rule the tail-row invariant lives by — because a value that arrives already holding a child
	 * under such a kind is the consumer's own bytes: rewriting it on mount would emit an edit
	 * nobody made, out of an editor nobody has touched.
	 */
	it('does not lift the children of a value it was merely given', async () => {
		const {host, value} = await mountControlled(Empty, '### Risks\n\t- EU quota')
		await settle()

		expect(value()).toBe('### Risks\n\t- EU quota')
		expect(host.textContent).not.toContain('EU quota')
	})

	/**
	 * AND THE CARET GOES WITH IT WHEN A ROW CLOSES UNDER IT. A toggle's arrow is a retype onto the
	 * closed kind, which hides the children rather than unmounting them — so the caret's row was
	 * still in the document, still `reachable`, and generated no box. The focus reclaim then handed
	 * focus back and restored the caret into the row it had just hidden: the next keystroke edited
	 * text nobody could see.
	 */
	it('takes the caret out of a toggle that closes under it', async () => {
		const {host, value} = await mountControlled(Showcase)

		const toggle = toggleStarting(host, 'Why we cut the Android target')
		const child = [...toggle.querySelectorAll<HTMLElement>(ROW)][0]
		const text = lineTextOf(child)
		await caretAt(host, text, text.length)
		await userEvent.click(getElement(page.getByRole('button', {name: 'Collapse'}).first()))
		await settle()
		await userEvent.keyboard('ZZZ')
		await settle()

		expect(caretIsUsable()).toBe(true)
		expect(value()).not.toContain('twice.ZZZ')
		// AND THE HIDDEN ROWS STAY WHERE THEY ARE. A closed toggle renders its host and hides it,
		// which is a kind doing its job — the row half of the invariant above must not read that as
		// "nothing paints them" and lift them out from under the toggle on every collapse.
		expect(value()).toContain('▸ Why we cut the Android target\n\tShipping three platforms')
	})

	/**
	 * A CLIP OF WHOLE ROWS IS PASTED AS ROWS. This editor's own clipboard entry is the value's own
	 * projection — a lead and an opener per line — and splicing it into a row's body wrote those
	 * bytes as PROSE: a literal `'- '` in the middle of a paragraph, and a literal tab in front of
	 * it. Pasting the same clip on an empty row was clean, which is the two readings this closes.
	 */
	it('opens a two-row clip as rows when it is pasted at a caret', async () => {
		const {host, value} = await mountControlled(Showcase)

		await focusAtEnd(rowStarting(host, 'Awaiting quota approval'))
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		const clip = copyFrom(host)
		expect(clip.getData('application/x-markput')).toBe('\t- Awaiting quota approval\n- Support headcount at 60%')

		await focusAtEnd(rowStarting(host, 'Apollo moves the collaboration'))
		pasteAtCaret(host, clip)
		await settle()

		expect(value()).toContain(
			'downstream assumes.\n\t- Awaiting quota approval\n- Support headcount at 60%\n@toc\n'
		)
	})

	/**
	 * A DEPTH IN THE VALUE IS A DEPTH ON THE SCREEN. A row nested under a PARAGRAPH — which Tab and
	 * a drop both write, and the drop indicator promises — painted at its parent's own left edge,
	 * so the indent the document holds was invisible. A nested bullet is the measure: one indent
	 * step, whoever the parent is.
	 */
	it('paints a row nested under a paragraph at the nesting step', async () => {
		const {host} = await mountControlled(
			Empty,
			'alpha\n\tnested line\n\t> nested quote\n> quote\n- bullet\n\t- nested bullet'
		)

		// The step a NESTING adds, measured per kind against the same kind at depth 0 — a quote and
		// a bullet draw their own left edges differently, so their absolute boxes never agree.
		const left = (text: string) => Math.round(rowStarting(host, text).getBoundingClientRect().left)
		const step = left('nested bullet') - left('bullet')

		expect(step).toBeGreaterThan(0)
		expect(left('nested quote') - left('quote')).toBe(step)
		// AND A SOFT BREAK IS NOT A NESTING. A continuation line is a kindless child row — the same
		// bytes Tab writes — and takes no step at all; what separates it from its parent's box is
		// that parent's own padding, which every child inside the box starts at.
		expect(left('nested line') - left('alpha')).toBeLessThan(step)
	})

	/**
	 * AN EMPTY RAW BODY PAINTS A LINE FOR ITS CARET. A fence's body surface is an INLINE child of a
	 * block whose height comes entirely from the language `<select>` beside it, so an empty one
	 * measured `height: 0` inside a 38px box — a caret position that is reachable, that a typed
	 * character lands in, and that nothing on screen locates. It is the state `/code` + Enter
	 * leaves behind and the state one Backspace away from any one-line fence.
	 *
	 * THE OWNER IS THE THEME, decided by the measurement: an option-level `text:` seed makes the
	 * fence non-empty at the moment the menu creates it and does nothing the first time the user
	 * clears it. Ticket 41.
	 */
	it('gives an empty raw body a line box to draw a caret in', async () => {
		const {host} = await mountControlled(Empty, 'before\n```bash\n\n```\nafter')
		const fence = host.querySelector<HTMLElement>('[class*="codeBlock"]')
		const surface = fence?.querySelector<HTMLElement>('span:empty')
		if (!surface) throw new Error('the page painted no empty fence body')

		expect(surface.getClientRects()[0]?.height).toBeGreaterThan(0)
	})
})