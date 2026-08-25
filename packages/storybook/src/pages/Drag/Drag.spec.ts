import type {Markup} from '@markput/core'
import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {caretIsInside, firstChild, getElement, rowsOf} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart, verifyCaretPosition} from '../../shared/lib/focus'
import {dispatchInsertText, dispatchPaste} from '../../shared/lib/inputEvents'
import {defineMark, Mark} from '../../shared/lib/marks'
import {composePage, mount, mountComponent, mountEcho} from '../../shared/lib/page'
import * as DragStories from './Drag.stories'

const {Markdown, PlainTextDrag, MarkdownDrag, ReadOnlyDrag, TodoList} = composePage(DragStories)

/** The two helper stories' values again, for the runs that drive them as a CONTROLLED field. */
const PLAIN_TEXT_VALUE =
	'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text\n\n'

const MARKDOWN_DRAG_VALUE =
	'# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover\n\n'

/**
 * A controlled document whose `onChange` is never echoed, so the DOM must not move. Mounted
 * as the component, not a story: the pre-migration harness was a local component too, and
 * the story args would only get in the way.
 */
const CONTROLLED_ARGS = {
	Mark,
	value: 'hello @[world](1)\n\nfoo',
	separator: '\n\n',
	draggable: true,
} as const

const GRIP = {name: 'Drag to reorder or click for options'} as const

/**
 * The ONE grip. It lives in the editor's controls layer rather than inside a row, so it is found
 * on the host and follows the pointer: hovering a row is what puts it on that row.
 */
async function gripOfRow(host: HTMLElement, rowIndex: number) {
	await userEvent.hover(rowsOf(host)[rowIndex])
	return page.elementLocator(host).getByRole('button', GRIP).findElement()
}

/** Hovers a row, then clicks its grip — the only way the block menu opens. */
async function openMenuForRow(host: HTMLElement, rowIndex: number) {
	await userEvent.click(await gripOfRow(host, rowIndex))
}

/**
 * The TARGET half of a drag: dragover then drop, both on the CONTAINER, which is where the layer
 * listens, carrying the clientY that names the edge. Its own helper because the host it aims at
 * need not be the one the drag started in — that is how a foreign drag arrives.
 */
function dropOnRow(host: HTMLElement, rowIndex: number, dt: DataTransfer, position: 'before' | 'after' = 'after') {
	const rect = rowsOf(host)[rowIndex].getBoundingClientRect()
	const clientY = position === 'before' ? rect.top + 1 : rect.bottom - 1
	const over = new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: dt, clientY})
	host.dispatchEvent(over)
	const drop = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientY})
	host.dispatchEvent(drop)
	return {over, drop}
}

/** The grip's own `dragstart` — the only thing that makes a later drop this editor's own row. */
async function beginRowDrag(host: HTMLElement, rowIndex: number) {
	const grip = await gripOfRow(host, rowIndex)
	const dt = new DataTransfer()
	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}))
	return {grip, dt, end: () => grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))}
}

/** The whole sequence a browser produces, start to finish, inside ONE editor. */
async function dragRow(
	host: HTMLElement,
	sourceIndex: number,
	targetIndex: number,
	position: 'before' | 'after' = 'after'
) {
	const {dt, end} = await beginRowDrag(host, sourceIndex)
	dropOnRow(host, targetIndex, dt, position)
	end()
}

/**
 * One turn of the event loop, for the assertions that say NOTHING happened. React commits an
 * echoed `onChange` in a microtask, so reading the harness value straight after a synthetic drop
 * reports the stale one — an unreordered document and a reordered one look identical there.
 */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** The helper stories driven as a controlled field that echoes `onChange` back into `value`. */
const echoPlainText = () => mountEcho(PlainTextDrag, {value: PLAIN_TEXT_VALUE})
const echoMarkdown = () => mountEcho(MarkdownDrag, {value: MARKDOWN_DRAG_VALUE})

describe('Feature: drag rows', () => {
	it('render 6 rows for PlainTextDrag — the trailing empty row included', async () => {
		// Issue 08: the piece after the final separator is a row even when empty.
		const {host} = await mount(PlainTextDrag)
		expect(rowsOf(host)).toHaveLength(6)
	})

	it('render 6 rows for MarkdownDrag — every paragraph its own row', async () => {
		// Two plain paragraphs used to fuse into one text root; a row is a span between
		// separators now, so each is its own draggable row, plus the trailing empty one.
		const {host} = await mount(MarkdownDrag)
		expect(rowsOf(host)).toHaveLength(6)
	})

	it('render the markdown showcase as one row per block-level token', async () => {
		const {host} = await mount(Markdown)
		expect(rowsOf(host)).toHaveLength(10)
	})

	it('render no grip buttons in read-only mode', async () => {
		const {host} = await mount(ReadOnlyDrag)
		await userEvent.hover(rowsOf(host)[0])
		await expect.element(page.getByRole('button', GRIP)).not.toBeInTheDocument()
	})

	it('render content in read-only mode', async () => {
		await mount(ReadOnlyDrag)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	it('render content for TodoList with checkbox controls', async () => {
		const {host} = await mount(TodoList)

		await expect.element(page.getByText('Design Phase').first()).toBeInTheDocument()
		await expect.element(page.getByText('Create wireframes').first()).toBeInTheDocument()
		await expect.element(page.getByText('Deploy to production').first()).toBeInTheDocument()

		// The control the mark owns, and the state it reads off `- [x]` vs `- [ ]`.
		const checkboxOf = (text: string) =>
			rowsOf(host)
				.find(row => row.textContent.includes(text))!
				.querySelector<HTMLInputElement>('input[type="checkbox"]')!
		expect(checkboxOf('Define color palette').checked).toBe(true)
		expect(checkboxOf('Design Phase').checked).toBe(false)
	})

	describe('menu', () => {
		it('open with Add below, Duplicate, Delete options', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('close on Escape', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('close when clicking outside', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(firstChild(host)!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add row', () => {
		it('increase row count by 1 when adding below first row', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(rowsOf(host)).toHaveLength(7)
		})

		it('keeps controlled row unchanged after adding below until value is echoed', async () => {
			const onChange = vi.fn()
			const {host} = await mountComponent({...CONTROLLED_ARGS, onChange})
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const rows = rowsOf(host)
			expect(onChange).toHaveBeenCalled()
			expect(host.textContent).toContain('world')
			// One row per separator span now: the mark lives inside the first row
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[0].textContent).toContain('world')
			expect(rows[1].textContent).toContain('foo')
		})

		it('insert the empty row below the middle row and leave the rest in place', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 2)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(rowsOf(host)).toHaveLength(7)
			await expect
				.poll(value)
				.toBe(
					'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\n\n\nFourth block of plain text\n\nFifth block of plain text\n\n'
				)
		})

		it('append the empty row when adding below the last row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(rowsOf(host)).toHaveLength(7)
			await expect.poll(value).toBe(PLAIN_TEXT_VALUE + '\n\n')
		})

		it('insert an empty row between the target and next row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			await expect.poll(value).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('not create a trailing separator when adding below last row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(value().endsWith('\n\n\n\n\n\n')).toBe(false)
		})
	})

	describe('delete row', () => {
		it('drop the middle row with its separator and leave the rest in place', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 2)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(5)
			await expect
				.poll(value)
				.toBe(
					'First block of plain text\n\nSecond block of plain text\n\nFourth block of plain text\n\nFifth block of plain text\n\n'
				)
		})

		it('drop the row straight out of the DOM when uncontrolled', async () => {
			// The other delete cases all drive a CONTROLLED field, where the row leaves only
			// once the echo lands. Uncontrolled the editor owns the value, so nothing echoes
			// and the DOM has to be right on its own.
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 2)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(5)
			expect(host.textContent).not.toContain('Third block of plain text')
		})

		it('keeps controlled row unchanged after deleting until value is echoed', async () => {
			const onChange = vi.fn()
			const {host} = await mountComponent({...CONTROLLED_ARGS, onChange})
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			const rows = rowsOf(host)
			expect(onChange).toHaveBeenCalled()
			expect(host.textContent).toContain('world')
			// One row per separator span now: the mark lives inside the first row
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[0].textContent).toContain('world')
			expect(rows[1].textContent).toContain('foo')
		})

		it('preserve remaining content when deleting first row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(5)
			await expect.poll(value).toContain('Second block of plain text')
		})

		it('decrease count by 1 when deleting last row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 4)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(5)
			await expect.poll(value).toContain('Fourth block of plain text')
			expect(value()).not.toContain('Fifth block of plain text')
		})

		it('result in empty value when deleting the last remaining row', async () => {
			const {host, value} = await echoPlainText()

			for (let i = 4; i > 0; i--) {
				await openMenuForRow(host, i)
				await userEvent.click(getElement(page.getByText('Delete')))
			}

			// The last content row plus the trailing empty row
			expect(rowsOf(host)).toHaveLength(2)

			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			// An empty document IS one empty row (issue 08)
			await expect.poll(value).toBe('')
			expect(rowsOf(host)).toHaveLength(1)
		})
	})

	describe('duplicate row', () => {
		it('increase count by 1 when duplicating first row', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(rowsOf(host)).toHaveLength(7)
		})

		it('keeps controlled row unchanged after duplicating until value is echoed', async () => {
			const onChange = vi.fn()
			const {host} = await mountComponent({...CONTROLLED_ARGS, onChange})
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const rows = rowsOf(host)
			expect(onChange).toHaveBeenCalled()
			expect(host.textContent).toContain('world')
			// One row per separator span now: the mark lives inside the first row
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[0].textContent).toContain('world')
			expect(rows[1].textContent).toContain('foo')
		})

		it('create a copy with the same text content', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			await expect.poll(() => value().match(/First block of plain text/g)).toHaveLength(2)
		})

		it('place the copy of the last row directly after it', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 4)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(rowsOf(host)).toHaveLength(7)
			await expect.poll(value).toBe(PLAIN_TEXT_VALUE + 'Fifth block of plain text\n\n')
		})
	})

	describe('enter key', () => {
		it('create a new row when pressing Enter at end of text row', async () => {
			const {host} = await mount(PlainTextDrag)
			expect(rowsOf(host)).toHaveLength(6)

			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Enter}')

			expect(rowsOf(host)).toHaveLength(7)
		})

		it('preserve all row content after pressing Enter', async () => {
			const {host, value} = await echoPlainText()
			const originalValue = value()

			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Enter}')

			await expect.poll(() => value() !== originalValue).toBe(true)
			expect(value()).toContain('First block of plain text')
			expect(value()).toContain('Fifth block of plain text')
		})

		it('not create a new row when pressing Shift+Enter', async () => {
			const {host} = await mount(PlainTextDrag)

			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(rowsOf(host)).toHaveLength(6)
		})

		it('create a new empty row after a mark row when pressing Enter', async () => {
			const {host} = await mount(MarkdownDrag)
			const before = rowsOf(host).length
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Enter}')

			expect(rowsOf(host)).toHaveLength(before + 1)
		})
	})

	describe('drag & drop', () => {
		it('keep grip visible when pointer moves from block content to grip button', async () => {
			// The layer lives INSIDE the container, so a mousemove over the grip still bubbles to
			// the container's hit-test — and the grip sits in its own row's vertical band, so the
			// hover it recomputes is the row it is already on.
			const {host} = await mount(PlainTextDrag)
			const grip = await gripOfRow(host, 0)

			await userEvent.hover(grip)
			expect(grip.parentElement!.matches('[class*="SidePanelVisible"]')).toBe(true)
		})

		it('hide the grip while its own row is being dragged', async () => {
			// As the per-row panel did, and for the same reason: the pointer has left with the
			// drag image, so a grip still painted at full opacity on the source row reads as one
			// left behind. It stays MOUNTED — its own `dragend` is the pin's release, and
			// Chromium sends no mouseup for a drag at all.
			const {host} = await mount(PlainTextDrag)
			const grip = await gripOfRow(host, 0)
			const visible = () => grip.parentElement!.matches('[class*="SidePanelVisible"]')
			expect(visible()).toBe(true)

			grip.dispatchEvent(
				new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: new DataTransfer()})
			)
			await expect.poll(visible).toBe(false)
			expect(grip.isConnected).toBe(true)

			grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))
			await expect.poll(visible).toBe(true)
		})

		it('keep the grip hit-testable while its own row is being dragged', async () => {
			// The regression this pins killed the feature outright while the whole suite stayed
			// green: the layer is `pointer-events: none` and the panel turns them back on, so
			// when `pointer-events: auto` sat on `SidePanelVisible` — which the line above drops
			// the moment `dragging` is set — the grip stopped being hit-testable INSIDE the
			// `dragstart` handler. Chromium re-hit-tests the drag origin when that handler
			// returns and cancels a drag whose origin is no longer in the source, so no drag ever
			// started. Nothing synthetic can see that; the hit test can, and needs no native drag.
			const {host} = await mount(PlainTextDrag)
			const {grip, end} = await beginRowDrag(host, 0)

			const box = grip.getBoundingClientRect()
			const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
			expect(grip.contains(hit)).toBe(true)

			end()
		})

		it('reorder rows when dragging row 0 after row 2', async () => {
			const {host, value} = await echoPlainText()

			await dragRow(host, 0, 2)

			await expect
				.poll(() => value().indexOf('First block of plain text') > value().indexOf('Third block of plain text'))
				.toBe(true)
		})

		it('move the row ELEMENT rather than rebuilding it, so component state survives', async () => {
			// The browser half of the row-identity gate; the core half asserts ids and the
			// per-row store. If identity survives the reorder, both adapters reconcile by
			// `key={node.id}` and MOVE the existing element — a rebuilt row would be a new
			// element object here, and would take the consumer's component state with it.
			const {host} = await mount(PlainTextDrag)
			const before = [...rowsOf(host)]

			await dragRow(host, 0, 2)

			// The drop is on row 2's TRAILING edge, so the target slot is 3 and the row lands at
			// index 2 once it has left index 0.
			await expect.poll(() => rowsOf(host)[2] === before[0]).toBe(true)
			const after = rowsOf(host)
			expect(after[0]).toBe(before[1])
			expect(after[1]).toBe(before[2])
			expect(after[3]).toBe(before[3])
		})

		it('not change order when dragging row onto itself', async () => {
			const {host, value} = await echoPlainText()
			const original = value()

			await dragRow(host, 1, 1)

			expect(value()).toBe(original)
		})

		it("carry the dragged row's own text as the drag payload", async () => {
			// DECLARED BEHAVIOUR CHANGE: it used to be the row INDEX, which the drop handler read
			// back off `text/plain`. Provenance comes from the editor's own drag state now, so the
			// payload is free to be what a drag OUT of the editor should deliver.
			const {host} = await mount(PlainTextDrag)
			const {dt, end} = await beginRowDrag(host, 1)

			expect(dt.getData('text/plain')).toBe('Second block of plain text')
			end()
		})

		it('refuse a drop from a drag no grip of ours started', async () => {
			// PRE-EXISTING DEFECT, closed here: the handler parsed `text/plain` as a row index and
			// refused only NaN, so the bare text `0` dragged in from ANY other application — a
			// second browser tab, a text editor, a text selection inside this very field —
			// reordered the document. Nothing below dispatches a `dragstart` on a grip, which is
			// the whole of the test.
			const {host, value} = await echoPlainText()
			const original = value()

			const dt = new DataTransfer()
			dt.setData('text/plain', '0')
			const {over, drop} = dropOnRow(host, 2, dt)

			await settle()
			expect(value()).toBe(original)
			// Neither event is claimed, so the browser's own editable drop still runs and core's
			// `insertFromDrop` path inserts the dragged text instead.
			expect(over.defaultPrevented).toBe(false)
			expect(drop.defaultPrevented).toBe(false)
		})

		it('refuse a row dragged out of a SECOND editor on the same page', async () => {
			// Nothing on the drag names the editor it came from — it did not when the payload was
			// a bare row index, where A's "0" and B's "0" are the same three bytes, and it still
			// does not now that it is the row's text. Each editor answers from its OWN drag
			// state, which is null in B for the whole of A's gesture.
			const a = await echoPlainText()
			const b = await echoPlainText()

			const {dt, end} = await beginRowDrag(a.host, 0)
			const {drop} = dropOnRow(b.host, 2, dt)
			end()

			await settle()
			expect(b.value()).toBe(PLAIN_TEXT_VALUE)
			expect(a.value()).toBe(PLAIN_TEXT_VALUE)
			expect(drop.defaultPrevented).toBe(false)
		})
	})

	/**
	 * The controls layer paints at coordinates it MEASURES, where the per-row panel inherited them
	 * from `.Block { position: relative }`. These are the properties that geometry has to hold
	 * and that no unit test in `BlockController.spec.ts` can see, because it paints nothing.
	 */
	describe('controls layer geometry', () => {
		const centerY = (element: Element) => {
			const rect = element.getBoundingClientRect()
			return rect.top + rect.height / 2
		}

		it('give the layer a positioned container to measure against', async () => {
			// `.Container { position: relative }` is the layer's containing block, and the whole
			// coordinate system is silently wrong without it — the layer would size and position
			// itself against whatever ancestor happens to be positioned.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\n',
				separator: '\n\n',
				draggable: true,
			})
			expect(getComputedStyle(host).position).toBe('relative')
		})

		it('hang the grip band LEFT of its row, where core reserves no gutter', async () => {
			// Core supplies the 24px gutter only for draggable, editable block layout. A band
			// anchored to the layer's own origin therefore covers the first 24px of the hovered
			// row and swallows the click that should place a caret there.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\n',
				separator: '\n\n',
				draggable: false,
				style: {marginLeft: '64px'},
			})
			const row = rowsOf(host)[0]
			await userEvent.hover(row)
			const grip = await page.elementLocator(host).getByRole('button', {name: 'Block options'}).findElement()

			const band = grip.parentElement!.getBoundingClientRect()
			const rect = row.getBoundingClientRect()
			expect(band.right).toBeLessThanOrEqual(rect.left + 0.5)

			const hit = document.elementFromPoint(rect.left + 2, centerY(row))
			expect(row.contains(hit)).toBe(true)
		})

		it('put the grip INSIDE the container gutter core reserves, in BOTH frameworks', async () => {
			// The other half of the same anchor: WITH a gutter the band has to land in it. A
			// band placed 24px left of the layer's origin overshoots by exactly the gutter, and
			// an `overflow: auto` consumer container clips it out of existence.
			//
			// The gutter is core's own here — no `slotProps` stand-in. It used to need one: core
			// emitted a NUMERIC `paddingLeft`, React's JSX made that `24px` and Vue assigned it
			// to `element.style` verbatim, where the CSSOM rejects an unitless length. Vue's
			// computed padding was 0, so the band sat on the row's first 24px of text and every
			// `draggable: true` editor was laid out as if it were `false`.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\n',
				separator: '\n\n',
				draggable: true,
			})
			expect(getComputedStyle(host).paddingLeft).toBe('24px')

			const row = rowsOf(host)[0]
			await userEvent.hover(row)
			const grip = await page.elementLocator(host).getByRole('button', GRIP).findElement()

			const band = grip.parentElement!.getBoundingClientRect()
			const rect = row.getBoundingClientRect()
			const container = host.getBoundingClientRect()
			expect(rect.left - container.left).toBeCloseTo(24, 0)
			expect(band.right).toBeCloseTo(rect.left, 0)
			expect(band.left).toBeGreaterThanOrEqual(container.left - 0.5)
		})

		it('keep the grip on its row when a commit ABOVE it reflows a fixed-height container', async () => {
			// The container's own `ResizeObserver` is blind here: a container of fixed height
			// does not change size when the rows inside it move, so the commit clock is the only
			// thing that can tell the layer to re-measure. Unfixed the grip stays at the box it
			// measured before the edit — a whole row's height off its row.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'r0\n\nr1\n\nr2\n\nr3\n\nr4\n\n',
				separator: '\n\n',
				draggable: true,
				style: {marginLeft: '64px'},
				slotProps: {container: {style: {overflow: 'auto', height: '200px'}}},
			})
			await focusAtEnd(rowsOf(host)[0])
			const row = rowsOf(host)[3]
			const grip = await gripOfRow(host, 3)
			expect(Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)

			// Enter splits row 0 in two, so every row below it moves down by a row.
			await userEvent.keyboard('{Enter}')
			expect(rowsOf(host)).toHaveLength(7)

			await expect.poll(() => Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)
		})

		it('keep the grip on its row when a row ABOVE it reflows with no commit at all', async () => {
			// The hole the two older clocks leave: a reflow that is neither a commit nor a
			// container resize. An image or a webfont landing inside a row above the painted one
			// moves that row without changing its SIZE, so the container's observer and the
			// adapters' observer on the painted row both stay silent — and hovering does not save
			// it either, because hover re-measures only when the hovered ROW changes.
			//
			// A CSS animation stands in for the image here: same reflow, and it needs no network.
			const keyframes = document.createElement('style')
			keyframes.textContent = '@keyframes markput-row-grows { to { height: 120px } }'
			document.head.append(keyframes)
			const Growing = defineMark({
				tag: 'span',
				style: {
					display: 'inline-block',
					width: '8px',
					height: '0px',
					// Delayed, so the growth lands AFTER the grip has been painted at the old box.
					animation: 'markput-row-grows 100ms linear 500ms forwards',
				},
			})

			try {
				const {host} = await mountComponent({
					Mark: Growing,
					options: [{markup: '@[__value__]' as Markup}],
					defaultValue: '@[img] r0\n\nr1\n\nr2\n\nr3\n\nr4\n\n',
					separator: '\n\n',
					draggable: true,
					slotProps: {container: {style: {overflow: 'auto', height: '200px'}}},
				})
				const row = rowsOf(host)[3]
				const grip = await gripOfRow(host, 3)
				const containerHeight = host.getBoundingClientRect().height
				expect(Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)
				const topBefore = row.getBoundingClientRect().top

				await expect.poll(() => row.getBoundingClientRect().top - topBefore).toBeGreaterThan(60)
				// The two facts that make the older clocks blind: no commit ran, and the container
				// never changed size.
				expect(rowsOf(host)).toHaveLength(6)
				expect(host.getBoundingClientRect().height).toBe(containerHeight)

				await expect.poll(() => Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)
			} finally {
				keyframes.remove()
			}
		})

		it('paint the row menu above consumer content that outranks the layer', async () => {
			// `.Popup` is `z-index: 9999` and the layer must not clamp it: a `z-index` on the
			// layer would make it a stacking context, where the deleted per-row controls hung off
			// `.Block` (positioned, `z-index: auto`) and the popup competed at the page level.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\n',
				separator: '\n\n',
				draggable: true,
				style: {marginLeft: '64px'},
			})
			await openMenuForRow(host, 0)
			const item = getElement(page.getByText('Add below'))
			const rival = document.createElement('div')
			rival.style.cssText = 'position: fixed; inset: 0; z-index: 100'
			document.body.append(rival)

			try {
				const rect = item.getBoundingClientRect()
				const hit = document.elementFromPoint(rect.left + rect.width / 2, centerY(item))
				expect(rival.contains(hit)).toBe(false)
				expect(item.contains(hit) || hit === item).toBe(true)
			} finally {
				rival.remove()
			}
		})

		it('rest ONE grip on the first row when alwaysShowHandle is set', async () => {
			// DECLARED BEHAVIOUR CHANGE on a published option: it used to mean a grip on every
			// row, which one layer cannot paint, so it now means one grip on the row nearest the
			// pointer — resting on the first row while the pointer is away.
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\ngamma\n\n',
				separator: '\n\n',
				draggable: {alwaysShowHandle: true},
				style: {marginLeft: '64px'},
			})

			// Polled, not read: the box is measured after the paint that created the rows, so
			// Vue's `flush: 'post'` watcher paints the resting grip one tick after mount.
			await expect.poll(() => host.querySelectorAll('[class*="GripButton"]').length).toBe(1)
			const grips = host.querySelectorAll('[class*="GripButton"]')
			expect(grips[0].parentElement!.matches('[class*="SidePanelAlways"]')).toBe(true)
			expect(Math.abs(centerY(grips[0]) - centerY(rowsOf(host)[0]))).toBeLessThan(2)
		})

		/**
		 * The layer's own container observations deliver once on MOUNT, and under load that
		 * delivery can still be pending when the run reaches the reflow — it then re-measures for
		 * free and hides the drift. Measured: without this, deleting the border-box observation
		 * left `padding grows` GREEN on react and red only on vue.
		 *
		 * A fresh observer on the same element is the deterministic wait: `document`'s observer
		 * list is broadcast in insertion order, so this one — registered last — cannot be called
		 * before the layer's, and its own first delivery is one cycle rather than a sleep.
		 */
		const settleResizeObservers = (target: Element) =>
			new Promise<void>(resolve => {
				const settle = new ResizeObserver(() => {
					settle.disconnect()
					resolve()
				})
				settle.observe(target)
			})

		/**
		 * The RESTING grip — `alwaysShowHandle` with the pointer away — is watched by no rAF
		 * loop, because the loop follows the HOVERED and DRAGGED rows only. Container padding is
		 * what strands it: it moves every row inside a box the layer measures against and
		 * repaints nothing, and the pointer cannot repair it either, since hover re-measures only
		 * when the hovered ROW changes and the resting row is already that row.
		 *
		 * The two runs are the two sides of one decision — the container is observed on BOTH its
		 * boxes, and neither alone is enough. Each case is the other's blind spot, so a future
		 * simplification down to one observation fails exactly one of them.
		 */
		const restingGrip = async (containerStyle: Record<string, string>) => {
			const {host} = await mountComponent({
				options: [],
				defaultValue: 'alpha\n\nbeta\n\ngamma\n\n',
				separator: '\n\n',
				draggable: {alwaysShowHandle: true},
				style: {marginLeft: '64px'},
				slotProps: {container: {style: containerStyle}},
			})
			await expect.poll(() => host.querySelectorAll('[class*="GripButton"]').length).toBe(1)
			const grip = host.querySelector('[class*="GripButton"]')!
			const row = rowsOf(host)[0]
			expect(Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)

			await settleResizeObservers(host)
			const topBefore = row.getBoundingClientRect().top
			host.style.paddingTop = '60px'

			// The reflow really moved the row; without this the drift assertion passes vacuously.
			await expect.poll(() => row.getBoundingClientRect().top - topBefore).toBeGreaterThan(55)
			await expect.poll(() => Math.abs(centerY(grip) - centerY(row))).toBeLessThan(2)
		}

		it('keep the RESTING grip on its row when padding grows the container', async () => {
			// Auto height: the content box never changes, so only the BORDER-box observation sees
			// this one. Measured unfixed: 60px of drift, in both adapters.
			await restingGrip({})
		})

		it('keep the RESTING grip on its row when padding shrinks a border-box container', async () => {
			// The mirror: a fixed `border-box` height pins the border box, so the padding comes
			// out of the CONTENT box and only the content-box observation sees it.
			await restingGrip({overflow: 'auto', height: '200px', boxSizing: 'border-box'})
		})
	})

	describe('backspace on empty row', () => {
		it('delete the row and reduce count by 1', async () => {
			const {host} = await mount(PlainTextDrag)

			// Insert an empty row after row 0
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))
			expect(rowsOf(host)).toHaveLength(7)

			// Put the caret in the new empty row (index 1) and press Backspace
			await focusAtStart(rowsOf(host)[1])
			await userEvent.keyboard('{Backspace}')

			expect(rowsOf(host)).toHaveLength(6)
		})

		it('not delete a non-empty row on Backspace', async () => {
			const {host} = await mount(PlainTextDrag)
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Backspace}')

			expect(rowsOf(host)).toHaveLength(6)
		})
	})

	it('put the caret in the new empty row after Add below', async () => {
		const {host} = await mount(PlainTextDrag)
		await openMenuForRow(host, 0)
		await userEvent.click(getElement(page.getByText('Add below')))

		// `activeElement` is the container for every row now, so row identity is a question
		// only the selection can answer. The offset needs that row check above it: a caret
		// left behind in row 0 measures 0 against row 1 too, because a range whose end
		// precedes its start collapses to empty.
		expect(caretIsInside(rowsOf(host)[1])).toBe(true)
		verifyCaretPosition(rowsOf(host)[1], 0)
	})

	it('split row at caret when pressing Enter at the beginning', async () => {
		const {host, value} = await echoPlainText()
		await focusAtStart(rowsOf(host)[0])
		await userEvent.keyboard('{Enter}')

		expect(rowsOf(host)).toHaveLength(7)
		expect(value()).toContain('First block of plain text')
	})

	it('restore original value after add then delete', async () => {
		const {host, value} = await echoPlainText()
		const original = value()

		await openMenuForRow(host, 0)
		await userEvent.click(getElement(page.getByText('Add below')))
		expect(rowsOf(host)).toHaveLength(7)

		await openMenuForRow(host, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(rowsOf(host)).toHaveLength(6)

		await expect.poll(value).toBe(original)
	})

	it('restore original value after duplicate then delete', async () => {
		const {host, value} = await echoPlainText()
		const original = value()

		await openMenuForRow(host, 0)
		await userEvent.click(getElement(page.getByText('Duplicate')))
		expect(rowsOf(host)).toHaveLength(7)

		await openMenuForRow(host, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(rowsOf(host)).toHaveLength(6)

		await expect.poll(value).toBe(original)
	})
})

describe('Feature: drag row keyboard navigation', () => {
	describe('ArrowLeft cross-row', () => {
		it('move focus to previous row when at start of row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtStart(rows[1])
			await userEvent.keyboard('{ArrowLeft}')

			verifyCaretPosition(rows[0], 'First block of plain text'.length)
		})

		it('not cross to previous row when caret is mid-row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtEnd(rows[1])
			await userEvent.keyboard('{ArrowLeft}')

			verifyCaretPosition(rows[1], 'Second block of plain text'.length - 1)
		})

		it('not cross row boundary from the first row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtStart(rows[0])
			await userEvent.keyboard('{ArrowLeft}')

			verifyCaretPosition(rows[0], 0)
		})
	})

	describe('ArrowRight cross-row', () => {
		it('move focus to next row when at end of row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtEnd(rows[0])
			await userEvent.keyboard('{ArrowRight}')

			// Offset 0 alone cannot fail here: a caret still in row 0 collapses row 1's
			// range to empty, so the row check carries the crossing claim.
			expect(caretIsInside(rows[1])).toBe(true)
			verifyCaretPosition(rows[1], 0)
		})

		it('not cross to next row when caret is mid-row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtStart(rows[0])
			await userEvent.keyboard('{ArrowRight}')

			verifyCaretPosition(rows[0], 1)
		})

		it('not cross row boundary from the last row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)
			// The document-final row is the trailing EMPTY row (issue 08)
			const last = rows[rows.length - 1]

			await focusAtEnd(last)
			await userEvent.keyboard('{ArrowRight}')

			// The row check carries the claim: offset 0 alone is satisfied by a caret
			// anywhere BEFORE the empty row too (the range collapses to nothing).
			expect(caretIsInside(last)).toBe(true)
			verifyCaretPosition(last, 0)
		})
	})

	describe('ArrowDown cross-row', () => {
		it('move focus to next row when on last line of row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtEnd(rows[0])
			await userEvent.keyboard('{ArrowDown}')

			// Row identity is the whole claim: a vertical move lands on the x of the caret
			// it started from, so the column depends on font metrics, not on a fixed offset.
			expect(caretIsInside(rows[1])).toBe(true)
		})

		it('never travels above the last content row', async () => {
			// The trailing EMPTY row renders a zero-height line box, and Chromium's vertical
			// move from it resolves upward — a native quirk this layer does not cancel. The
			// stable claim lives one row up: ArrowDown from the last CONTENT row must not
			// land in any row above it.
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)
			const lastContent = rows[rows.length - 2]

			await focusAtEnd(lastContent)
			await userEvent.keyboard('{ArrowDown}')

			const above = rows.slice(0, -2)
			expect(above.some(row => caretIsInside(row))).toBe(false)
		})
	})

	describe('ArrowUp cross-row', () => {
		it('move focus to previous row when on first line of row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtStart(rows[1])
			await userEvent.keyboard('{ArrowUp}')

			verifyCaretPosition(rows[0], 0)
		})

		it('not cross row boundary from the first row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)

			await focusAtStart(rows[0])
			await userEvent.keyboard('{ArrowUp}')

			verifyCaretPosition(rows[0], 0)
		})
	})

	describe('Backspace merge rows (text+text)', () => {
		it('merge with previous text row when Backspace pressed at start of non-empty row', async () => {
			const {host} = await mount(PlainTextDrag)
			const before = rowsOf(host).length

			await focusAtStart(rowsOf(host)[1])
			await userEvent.keyboard('{Backspace}')

			expect(rowsOf(host)).toHaveLength(before - 1)
		})

		it('preserve content of both merged rows', async () => {
			const {host, value} = await echoPlainText()

			await focusAtStart(rowsOf(host)[1])
			await userEvent.keyboard('{Backspace}')

			await expect.poll(value).toContain('First block of plain text')
			expect(value()).toContain('Second block of plain text')
		})

		it('keep focus in the previous row after merge', async () => {
			const {host} = await mount(PlainTextDrag)

			await focusAtStart(rowsOf(host)[1])
			await userEvent.keyboard('{Backspace}')

			verifyCaretPosition(rowsOf(host)[0], 'First block of plain text'.length)
		})

		describe('Backspace at start of a paragraph after a heading row (issue 08 merge policy)', () => {
			it('merges the paragraph INTO the heading row', async () => {
				// The ratified markdown-like rule: Backspace at a row boundary deletes the
				// separator and reparse decides — the heading's trailing slot absorbs the text.
				const {host} = await mount(MarkdownDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Backspace}')

				expect(rowsOf(host)).toHaveLength(before - 1)
			})

			it('lands the caret at the join inside the heading row', async () => {
				const {host} = await mount(MarkdownDrag)
				const markBlock = rowsOf(host)[0]

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Backspace}')

				expect(caretIsInside(markBlock)).toBe(true)
			})
		})
	})

	describe('Delete merge rows', () => {
		describe('Delete at end of row', () => {
			it('merge with next text row when Delete pressed at end of non-last row', async () => {
				const {host} = await mount(PlainTextDrag)
				const before = rowsOf(host).length

				await focusAtEnd(rowsOf(host)[0])
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(before - 1)
			})

			it('preserve content of both merged rows', async () => {
				const {host, value} = await echoPlainText()

				await focusAtEnd(rowsOf(host)[0])
				await userEvent.keyboard('{Delete}')

				await expect.poll(value).toContain('First block of plain text')
				expect(value()).toContain('Second block of plain text')
			})

			it('keep focus in the current row after Delete merge', async () => {
				const {host} = await mount(PlainTextDrag)

				await focusAtEnd(rowsOf(host)[0])
				await userEvent.keyboard('{Delete}')

				verifyCaretPosition(rowsOf(host)[0], 'First block of plain text'.length)
			})

			it('not merge when Delete pressed at end of last row', async () => {
				const {host} = await mount(PlainTextDrag)
				const rows = rowsOf(host)
				const last = rows[rows.length - 1]

				await focusAtEnd(last)
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(5)
			})
		})

		describe('Delete at start of row', () => {
			it('merge current row into previous when Delete pressed at start of non-first row', async () => {
				const {host} = await mount(PlainTextDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(before - 1)
			})

			it('preserve content of both merged rows', async () => {
				const {host, value} = await echoPlainText()

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				await expect.poll(value).toContain('First block of plain text')
				expect(value()).toContain('Second block of plain text')
			})

			it('keep focus in the previous row after Delete merge', async () => {
				const {host} = await mount(PlainTextDrag)

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				verifyCaretPosition(rowsOf(host)[0], 'First block of plain text'.length)
			})

			it('not merge when Delete pressed at start of first row', async () => {
				const {host} = await mount(PlainTextDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[0])
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(before)
			})

			it('place caret at the join point after merge', async () => {
				const {host, value} = await echoPlainText()

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				await expect.poll(value).toContain('First block of plain textSecond block of plain text')
			})
		})

		describe('Delete at a heading→paragraph boundary (issue 08 merge policy)', () => {
			it('merges the paragraph into the heading on Delete at the boundary', async () => {
				const {host} = await mount(MarkdownDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(before - 1)
			})

			it('move focus to mark row on Delete at mark boundary', async () => {
				const {host} = await mount(MarkdownDrag)
				const markBlock = rowsOf(host)[0]

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				expect(caretIsInside(markBlock)).toBe(true)
			})
		})
	})

	describe('typing in rows', () => {
		it('update raw value when typing a character at end of row', async () => {
			const {host, value} = await echoPlainText()
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('!')

			await expect.poll(value).toContain('First block of plain text!')
		})

		it('update raw value when deleting a character with Backspace mid-row', async () => {
			const {host, value} = await echoPlainText()
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Backspace}')

			await expect.poll(value).toContain('First block of plain tex')
			expect(value()).not.toContain('First block of plain text\n\n')
		})

		it('replaces the whole document when Ctrl+A in a row then typing', async () => {
			// BREAKING (one-host migration): select-all is no longer clamped to the row it
			// started in — rows are not editing hosts any more — so it selects the document
			// and typing replaces all of it, exactly as in inline layout.
			const {host, value} = await echoPlainText()

			await focusAtEnd(rowsOf(host)[1])
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			await expect.poll(value).toBe('X')
		})

		it('ignores beforeinput inside a drag control', async () => {
			const {host, value} = await echoPlainText()
			const before = value()
			const handle = await gripOfRow(host, 0)

			await userEvent.click(handle)
			await userEvent.keyboard('x')

			expect(value()).toBe(before)
		})

		/**
		 * The two halves of "typing at the end of a mark row": a real key press and the
		 * synthesized `beforeinput` an IME or a mobile keyboard produces. Different code
		 * paths, one per framework in the pre-migration specs — both run in both now.
		 */
		it('append character after last mark when typing at end of mark row', async () => {
			const {host, value} = await echoMarkdown()
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('!')

			await expect.element(page.getByText('Welcome to Draggable Blocks!').first()).toBeInTheDocument()
			await expect.poll(() => value().split('\n\n')[0]).toBe('# Welcome to Draggable Blocks!')
		})

		it('append character after last mark on a synthesized insertText at end of mark row', async () => {
			const {host, value} = await echoMarkdown()
			const row = rowsOf(host)[0]
			await focusAtEnd(row)
			dispatchInsertText(row, '!')

			await expect.element(page.getByText('Welcome to Draggable Blocks!').first()).toBeInTheDocument()
			await expect.poll(() => value().split('\n\n')[0]).toBe('# Welcome to Draggable Blocks!')
		})

		it.todo('insert character at correct position mid-text within a mark row')
	})

	describe('paste in rows', () => {
		it('update raw value when pasting text at end of a plain text row', async () => {
			const {host, value} = await echoPlainText()
			const row = rowsOf(host)[0]
			await focusAtEnd(row)
			dispatchPaste(row, ' pasted')
			await expect.element(page.getByText(/First block of plain text pasted/).first()).toBeInTheDocument()

			await expect.poll(value).toContain('First block of plain text pasted')
		})

		it('not affect other rows when pasting in one row', async () => {
			const {host, value} = await echoPlainText()
			const row = rowsOf(host)[0]
			await focusAtEnd(row)
			dispatchPaste(row, '!')
			await expect.element(page.getByText(/First block of plain text!/).first()).toBeInTheDocument()

			await expect.poll(value).toContain('Second block of plain text')
			expect(value()).toContain('Fifth block of plain text')
			expect(rowsOf(host)).toHaveLength(6)
		})

		it('update raw value when pasting text at end of a mark row', async () => {
			const {host, value} = await echoMarkdown()
			const row = rowsOf(host)[0]
			await focusAtEnd(row)
			dispatchPaste(row, '!')

			await expect.element(page.getByText('Welcome to Draggable Blocks!').first()).toBeInTheDocument()
			await expect.poll(() => value().split('\n\n')[0]).toBe('# Welcome to Draggable Blocks!')
		})
	})

	describe('Enter mid-row split', () => {
		it('increase row count by 1', async () => {
			const {host} = await mount(PlainTextDrag)

			const row = rowsOf(host)[0]
			await userEvent.click(row)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(rowsOf(host)).toHaveLength(7)
		})

		it('put text before caret in current row', async () => {
			const {host, value} = await echoPlainText()

			const row = rowsOf(host)[0]
			await userEvent.click(row)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			await expect.poll(() => value().split('\n\n')[0]).toBe('First')
		})

		it('put text after caret in new row', async () => {
			const {host, value} = await echoPlainText()

			const row = rowsOf(host)[0]
			await userEvent.click(row)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			await expect.poll(() => value().split('\n\n')[1]).toBe(' block of plain text')
		})

		it('insert new empty row after mark row when pressing Enter on mark', async () => {
			const {host, value} = await echoMarkdown()
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Enter}')

			await expect.poll(value).toContain('# Welcome to Draggable Blocks\n\n')
		})
	})
})

/**
 * The `list` preset renders `- __slot__` as `display: block; padding-left: 1em`, so the mark's
 * own element owns pixels no token's text covers. Chromium hit-tests a click in that 1em band
 * to the WRAPPER at offset 0 whenever the slot's first child is caret-unreachable — an atomic
 * `contenteditable=false` mark, which the `code` and `strikethrough` presets both are.
 *
 * That boundary used to answer nothing: the island guard read `isContentEditable`, which a slot
 * mark's BARE root and every element on its root→host path inherit from the container, so
 * `domAnchors()` declined and `dropUnexpressedInput` cancelled the key with no model edit.
 * Rows 3 and 6 are the controls in the same shape — a slot-mark-first row and a text-first row
 * both typed throughout.
 */
describe('Feature: typing on a list mark own padding', () => {
	/** Row-relative, in the padding band left of the first glyph and vertically centred. */
	const clickInPadding = async (row: HTMLElement, x: number) =>
		userEvent.click(row, {position: {x, y: Math.round(row.getBoundingClientRect().height / 2)}})

	it('insert at the near mark edge for a row whose slot opens with an ATOMIC mark', async () => {
		const {host} = await mount(Markdown)

		await clickInPadding(rowsOf(host)[4], 3)
		await userEvent.keyboard('X')

		// BEFORE the mark, not inside it: the boundary names no position within a mark's
		// presentation, so the collapsed read answers the near EDGE and the row un-lists.
		expect(rowsOf(host)[4].textContent).toBe('XCode snippets and code blocks')
	})

	it('insert for a strikethrough row too, at every x across the padding band', async () => {
		for (const x of [1, 3, 8]) {
			const {host} = await mount(Markdown)

			await clickInPadding(rowsOf(host)[5], x)
			await userEvent.keyboard('X')

			expect(rowsOf(host)[5].textContent).toBe('XStrikethrough for deleted content')
		}
	})

	it('leave the SLOT-mark-first and text-first rows where they already worked', async () => {
		const {host} = await mount(Markdown)

		// Chromium normalises the padding click out to the slot's own text here, so these two
		// never reached the guard — they are the control that says the harness types at all.
		await clickInPadding(rowsOf(host)[3], 3)
		await userEvent.keyboard('X')
		expect(rowsOf(host)[3].textContent).toBe('XBold and italic text support')

		await clickInPadding(rowsOf(host)[6], 3)
		await userEvent.keyboard('Y')
		expect(rowsOf(host)[6].textContent).toBe('YLinks like GitHub')
	})
})