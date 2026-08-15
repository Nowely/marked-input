import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {caretIsInside, childrenOf, firstChild, getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart, verifyCaretPosition} from '../../shared/lib/focus'
import {dispatchInsertText, dispatchPaste} from '../../shared/lib/inputEvents'
import {Mark} from '../../shared/lib/marks'
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
 * the story args would only get in the way. `marginLeft` reserves the drag gutter — see
 * `Drag.stories.ts`.
 */
const CONTROLLED_ARGS = {
	Mark,
	value: 'hello @[world](1)\n\nfoo',
	layout: 'block',
	draggable: true,
	style: {marginLeft: '64px'},
} as const

const GRIP = {name: 'Drag to reorder or click for options'} as const

/**
 * The rows of a block layout. Under the single-host topology the editing host IS the row
 * container, so a row is one of its element children.
 */
const rowsOf = (host: HTMLElement) => childrenOf(host)

/** Hovers a row, then clicks its grip — the only way the block menu opens. */
async function openMenuForRow(host: HTMLElement, rowIndex: number) {
	const row = rowsOf(host)[rowIndex]
	await userEvent.hover(row)
	const grip = await page.elementLocator(row).getByRole('button', GRIP).findElement()
	await userEvent.click(grip)
}

/** The drag sequence a browser produces: dragstart on the grip, dragover + drop on the target row. */
async function dragRow(
	host: HTMLElement,
	sourceIndex: number,
	targetIndex: number,
	position: 'before' | 'after' = 'after'
) {
	const rows = rowsOf(host)
	const sourceRow = rows[sourceIndex]
	const targetRow = rows[targetIndex]

	await userEvent.hover(sourceRow)
	const grip = await page.elementLocator(sourceRow).getByRole('button', GRIP).findElement()

	const dt = new DataTransfer()
	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}))

	const rect = targetRow.getBoundingClientRect()
	targetRow.dispatchEvent(
		new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: dt,
			clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
		})
	)

	targetRow.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))
}

/** The helper stories driven as a controlled field that echoes `onChange` back into `value`. */
const echoPlainText = () => mountEcho(PlainTextDrag, {value: PLAIN_TEXT_VALUE})
const echoMarkdown = () => mountEcho(MarkdownDrag, {value: MARKDOWN_DRAG_VALUE})

describe('Feature: drag rows', () => {
	it('render 5 rows for PlainTextDrag', async () => {
		const {host} = await mount(PlainTextDrag)
		expect(rowsOf(host)).toHaveLength(5)
	})

	it('render 4 rows for MarkdownDrag', async () => {
		const {host} = await mount(MarkdownDrag)
		expect(rowsOf(host)).toHaveLength(4)
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

			expect(rowsOf(host)).toHaveLength(6)
		})

		it('keeps controlled row unchanged after adding below until value is echoed', async () => {
			const onChange = vi.fn()
			const {host} = await mountComponent({...CONTROLLED_ARGS, onChange})
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const rows = rowsOf(host)
			expect(onChange).toHaveBeenCalled()
			expect(host.textContent).toContain('world')
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
		})

		it('insert the empty row below the middle row and leave the rest in place', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 2)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(rowsOf(host)).toHaveLength(6)
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

			expect(rowsOf(host)).toHaveLength(6)
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

			expect(rowsOf(host)).toHaveLength(4)
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

			expect(rowsOf(host)).toHaveLength(4)
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
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
		})

		it('preserve remaining content when deleting first row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(4)
			await expect.poll(value).toContain('Second block of plain text')
		})

		it('decrease count by 1 when deleting last row', async () => {
			const {host, value} = await echoPlainText()
			await openMenuForRow(host, 4)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(rowsOf(host)).toHaveLength(4)
			await expect.poll(value).toContain('Fourth block of plain text')
			expect(value()).not.toContain('Fifth block of plain text')
		})

		it('result in empty value when deleting the last remaining row', async () => {
			const {host, value} = await echoPlainText()

			for (let i = 4; i > 0; i--) {
				await openMenuForRow(host, i)
				await userEvent.click(getElement(page.getByText('Delete')))
			}

			expect(rowsOf(host)).toHaveLength(1)

			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			await expect.poll(value).toBe('')
			expect(rowsOf(host)).toHaveLength(0)
		})
	})

	describe('duplicate row', () => {
		it('increase count by 1 when duplicating first row', async () => {
			const {host} = await mount(PlainTextDrag)
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(rowsOf(host)).toHaveLength(6)
		})

		it('keeps controlled row unchanged after duplicating until value is echoed', async () => {
			const onChange = vi.fn()
			const {host} = await mountComponent({...CONTROLLED_ARGS, onChange})
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const rows = rowsOf(host)
			expect(onChange).toHaveBeenCalled()
			expect(host.textContent).toContain('world')
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
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

			expect(rowsOf(host)).toHaveLength(6)
			await expect.poll(value).toBe(PLAIN_TEXT_VALUE + 'Fifth block of plain text\n\n')
		})
	})

	describe('enter key', () => {
		it('create a new row when pressing Enter at end of text row', async () => {
			const {host} = await mount(PlainTextDrag)
			expect(rowsOf(host)).toHaveLength(5)

			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Enter}')

			expect(rowsOf(host)).toHaveLength(6)
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

			expect(rowsOf(host)).toHaveLength(5)
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
			const {host} = await mount(PlainTextDrag)
			const firstRow = rowsOf(host)[0]

			await userEvent.hover(firstRow)
			const grip = await page.elementLocator(firstRow).getByRole('button', GRIP).findElement()

			await userEvent.hover(grip)
			expect(grip.parentElement!.matches('[class*="SidePanelVisible"]')).toBe(true)
		})

		it('reorder rows when dragging row 0 after row 2', async () => {
			const {host, value} = await echoPlainText()

			await dragRow(host, 0, 2)

			await expect
				.poll(() => value().indexOf('First block of plain text') > value().indexOf('Third block of plain text'))
				.toBe(true)
		})

		it('not change order when dragging row onto itself', async () => {
			const {host, value} = await echoPlainText()
			const original = value()

			await dragRow(host, 1, 1)

			expect(value()).toBe(original)
		})
	})

	describe('backspace on empty row', () => {
		it('delete the row and reduce count by 1', async () => {
			const {host} = await mount(PlainTextDrag)

			// Insert an empty row after row 0
			await openMenuForRow(host, 0)
			await userEvent.click(getElement(page.getByText('Add below')))
			expect(rowsOf(host)).toHaveLength(6)

			// Put the caret in the new empty row (index 1) and press Backspace
			await focusAtStart(rowsOf(host)[1])
			await userEvent.keyboard('{Backspace}')

			expect(rowsOf(host)).toHaveLength(5)
		})

		it('not delete a non-empty row on Backspace', async () => {
			const {host} = await mount(PlainTextDrag)
			await focusAtEnd(rowsOf(host)[0])
			await userEvent.keyboard('{Backspace}')

			expect(rowsOf(host)).toHaveLength(5)
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

		expect(rowsOf(host)).toHaveLength(6)
		expect(value()).toContain('First block of plain text')
	})

	it('restore original value after add then delete', async () => {
		const {host, value} = await echoPlainText()
		const original = value()

		await openMenuForRow(host, 0)
		await userEvent.click(getElement(page.getByText('Add below')))
		expect(rowsOf(host)).toHaveLength(6)

		await openMenuForRow(host, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(rowsOf(host)).toHaveLength(5)

		await expect.poll(value).toBe(original)
	})

	it('restore original value after duplicate then delete', async () => {
		const {host, value} = await echoPlainText()
		const original = value()

		await openMenuForRow(host, 0)
		await userEvent.click(getElement(page.getByText('Duplicate')))
		expect(rowsOf(host)).toHaveLength(6)

		await openMenuForRow(host, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(rowsOf(host)).toHaveLength(5)

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
			const last = rows[rows.length - 1]

			await focusAtEnd(last)
			await userEvent.keyboard('{ArrowRight}')

			verifyCaretPosition(last, 'Fifth block of plain text'.length)
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

		it('not cross row boundary from the last row', async () => {
			const {host} = await mount(PlainTextDrag)
			const rows = rowsOf(host)
			const last = rows[rows.length - 1]

			await focusAtEnd(last)
			await userEvent.keyboard('{ArrowDown}')

			verifyCaretPosition(last, 'Fifth block of plain text'.length)
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

		describe('Backspace at start of text row after a mark row (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Backspace at start of text row after mark row', async () => {
				const {host} = await mount(MarkdownDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Backspace}')

				expect(rowsOf(host)).toHaveLength(before)
			})

			it('move focus to the mark row on Backspace at mark boundary', async () => {
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

		describe('Delete at mark→text boundary (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Delete at start of text row after mark row', async () => {
				const {host} = await mount(MarkdownDrag)
				const before = rowsOf(host).length

				await focusAtStart(rowsOf(host)[1])
				await userEvent.keyboard('{Delete}')

				expect(rowsOf(host)).toHaveLength(before)
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
			const row = rowsOf(host)[0]
			await userEvent.hover(row)
			const handle = await page.elementLocator(row).getByRole('button', GRIP).findElement()

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
			expect(rowsOf(host)).toHaveLength(5)
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

			expect(rowsOf(host)).toHaveLength(6)
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