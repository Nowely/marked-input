import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {firstChild, getActiveElement, getElement} from '../../shared/lib/dom'
import {
	dispatchInsertText,
	dispatchPaste,
	getAllRows,
	getBlocks,
	getEditableInRow,
	openMenuForRow,
	simulateDragRow,
} from '../../shared/lib/dragTestHelpers'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as DragStories from './Drag.react.stories'

const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)

function getRawValue(container: Element) {
	return container.querySelector<HTMLElement>('pre[data-value]')!.dataset.value!
}

describe('Feature: drag rows', () => {
	it('render 5 rows for PlainTextDrag', async () => {
		const {container} = await render(<PlainTextDrag />)
		expect(getAllRows(container)).toHaveLength(5)
	})

	it('render 4 rows for MarkdownDrag', async () => {
		const {container} = await render(<MarkdownDrag />)
		expect(getAllRows(container)).toHaveLength(4)
	})

	it('render no grip buttons in read-only mode', async () => {
		const {container} = await render(<ReadOnlyDrag />)
		const rows = getAllRows(container)
		await userEvent.hover(rows[0])
		await expect
			.element(page.getByRole('button', {name: 'Drag to reorder or click for options'}))
			.not.toBeInTheDocument()
	})

	it('render content in read-only mode', async () => {
		await render(<ReadOnlyDrag />)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	describe('menu', () => {
		it('open with Add below, Duplicate, Delete options', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('close on Escape', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('close when clicking outside', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(firstChild(container)!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add row', () => {
		it('increase row count by 1 when adding below first row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('increase row count by 1 when adding below middle row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('increase row count by 1 when adding below last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('insert an empty row between the target and next row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('not create a trailing separator when adding below last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n\n\n')).toBe(false)
		})

		it('work when value is empty', async () => {
			const {container} = await render(<PlainTextDrag />)

			// Delete all rows until value is ''
			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForRow(container, i)
				await userEvent.click(getElement(page.getByText('Delete')))
			}
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(0)
		})
	})

	describe('delete row', () => {
		it('decrease count by 1 when deleting middle row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
		})

		it('preserve remaining content when deleting first row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('decrease count by 1 when deleting last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('result in empty value when deleting the last remaining row', async () => {
			const {container} = await render(<PlainTextDrag />)

			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForRow(container, i)
				await userEvent.click(getElement(page.getByText('Delete')))
			}

			expect(getAllRows(container)).toHaveLength(1)

			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getRawValue(container)).toBe('')
		})
	})

	describe('duplicate row', () => {
		it('increase count by 1 when duplicating first row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('create a copy with the same text content', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('increase count by 1 when duplicating last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('create a new row when pressing Enter at end of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			expect(getAllRows(container)).toHaveLength(5)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('preserve all row content after pressing Enter', async () => {
			const {container} = await render(<PlainTextDrag />)
			const originalValue = getRawValue(container)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			const newValue = getRawValue(container)
			expect(newValue).not.toBe(originalValue)
			expect(newValue).toContain('First block of plain text')
			expect(newValue).toContain('Fifth block of plain text')
		})

		it('not create a new row when pressing Shift+Enter', async () => {
			const {container} = await render(<PlainTextDrag />)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getAllRows(container)).toHaveLength(5)
		})

		it('create a new empty row after a mark row when pressing Enter', async () => {
			const {container} = await render(<MarkdownDrag />)
			const before = getAllRows(container).length
			const markBlock = getAllRows(container)[0]
			markBlock.focus()
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(before + 1)
		})
	})

	describe('drag & drop', () => {
		it('keep grip visible when pointer moves from block content to grip button', async () => {
			const {container} = await render(<PlainTextDrag />)
			const firstRow = getAllRows(container)[0]

			await userEvent.hover(firstRow)
			const grip = await page
				.elementLocator(firstRow)
				.getByRole('button', {name: 'Drag to reorder or click for options'})
				.findElement()

			await userEvent.hover(grip)
			expect(grip.parentElement!.matches('[class*="SidePanelVisible"]')).toBe(true)
		})

		it('reorder rows when dragging row 0 after row 2', async () => {
			const {container} = await render(<PlainTextDrag />)

			await simulateDragRow(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('not change order when dragging row onto itself', async () => {
			const {container} = await render(<PlainTextDrag />)
			const original = getRawValue(container)

			await simulateDragRow(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty row', () => {
		it('delete the row and reduce count by 1', async () => {
			const {container} = await render(<PlainTextDrag />)

			// Insert an empty row after row 0
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))
			expect(getAllRows(container)).toHaveLength(6)

			// Focus the new empty row (index 1) and press Backspace
			const newRow = getAllRows(container)[1]
			newRow.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})

		it('not delete a non-empty row on Backspace', async () => {
			const {container} = await render(<PlainTextDrag />)
			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})
	})

	it('focus the new empty row after Add below', async () => {
		const {container} = await render(<PlainTextDrag />)
		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Add below')))

		const activeEl = getActiveElement()
		expect(activeEl.closest('[class*="Container"]')).toBeTruthy()
	})

	it('split row at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(<PlainTextDrag />)
		const editable = getEditableInRow(getAllRows(container)[0])
		await focusAtStart(editable)
		await userEvent.keyboard('{Enter}')

		expect(getAllRows(container)).toHaveLength(6)
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('restore original value after add then delete', async () => {
		const {container} = await render(<PlainTextDrag />)
		const original = getRawValue(container)

		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Add below')))
		expect(getAllRows(container)).toHaveLength(6)

		await openMenuForRow(container, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(getAllRows(container)).toHaveLength(5)

		expect(getRawValue(container)).toBe(original)
	})

	it('restore original value after duplicate then delete', async () => {
		const {container} = await render(<PlainTextDrag />)
		const original = getRawValue(container)

		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Duplicate')))
		expect(getAllRows(container)).toHaveLength(6)

		await openMenuForRow(container, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(getAllRows(container)).toHaveLength(5)

		expect(getRawValue(container)).toBe(original)
	})
})

describe('Feature: drag row keyboard navigation', () => {
	describe('ArrowLeft cross-row', () => {
		it('move focus to previous row when at start of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross to previous row when caret is mid-row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the first row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowRight cross-row', () => {
		it('move focus to next row when at end of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross to next row when caret is mid-row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowRight}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowDown cross-row', () => {
		it('move focus to next row when on last line of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowDown}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowDown}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowUp cross-row', () => {
		it('move focus to previous row when on first line of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the first row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('Backspace merge rows (text+text)', () => {
		it('merge with previous text row when Backspace pressed at start of non-empty row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const before = getAllRows(container).length

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(before - 1)
		})

		it('preserve content of both merged rows', async () => {
			const {container} = await render(<PlainTextDrag />)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('keep focus in the previous row after merge', async () => {
			const {container} = await render(<PlainTextDrag />)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const currentRows = getAllRows(container)
			expect(currentRows[0].contains(document.activeElement)).toBe(true)
		})

		it('only delete one row at a time on Backspace', async () => {
			const {container} = await render(<PlainTextDrag />)
			expect(getAllRows(container)).toHaveLength(5)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(4)
		})

		describe('Backspace at start of text row after a mark row (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Backspace at start of text row after mark row', async () => {
				const {container} = await render(<MarkdownDrag />)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('move focus to the mark row on Backspace at mark boundary', async () => {
				const {container} = await render(<MarkdownDrag />)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(markBlock.contains(document.activeElement)).toBe(true)
			})
		})
	})

	describe('Delete merge rows', () => {
		it('merge with next text row when Delete pressed at end of non-last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const before = getAllRows(container).length

			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('{Delete}')

			expect(getAllRows(container)).toHaveLength(before - 1)
		})

		it('preserve content of both merged rows', async () => {
			const {container} = await render(<PlainTextDrag />)

			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('{Delete}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('keep focus in the current row after Delete merge', async () => {
			const {container} = await render(<PlainTextDrag />)

			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('{Delete}')

			const currentRows = getAllRows(container)
			expect(currentRows[0].contains(document.activeElement)).toBe(true)
		})

		it('not merge when Delete pressed at end of last row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{Delete}')

			expect(getAllRows(container)).toHaveLength(5)
		})

		describe('Delete at start of row', () => {
			it('merge with previous row when Delete pressed at start of non-first row', async () => {
				const {container} = await render(<PlainTextDrag />)
				const before = getAllRows(container).length

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before - 1)
			})

			it('preserve content of both merged rows', async () => {
				const {container} = await render(<PlainTextDrag />)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('keep focus in the previous row after Delete merge', async () => {
				const {container} = await render(<PlainTextDrag />)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const currentRows = getAllRows(container)
				expect(currentRows[0].contains(document.activeElement)).toBe(true)
			})

			it('not merge when Delete pressed at start of first row', async () => {
				const {container} = await render(<PlainTextDrag />)
				const before = getAllRows(container).length

				await focusAtStart(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before)
			})
		})

		describe('Delete at mark→text boundary (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Delete at start of text row after mark row', async () => {
				const {container} = await render(<MarkdownDrag />)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('move focus to mark row on Delete at mark boundary', async () => {
				const {container} = await render(<MarkdownDrag />)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(markBlock.contains(document.activeElement)).toBe(true)
			})
		})
	})

	describe('typing in rows', () => {
		it('update raw value when typing a character at end of row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('!')

			expect(getRawValue(container)).toContain('First block of plain text!')
		})

		it('update raw value when deleting a character with Backspace mid-row', async () => {
			const {container} = await render(<PlainTextDrag />)
			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('{Backspace}')

			expect(getRawValue(container)).toContain('First block of plain tex')
			expect(getRawValue(container)).not.toContain('First block of plain text\n\n')
		})

		it('not wipe all rows when Ctrl+A in focused row then typing', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)

			getEditableInRow(rows[1]).focus()
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			expect(getRawValue(container)).not.toBe('X')
			expect(getRawValue(container)).toContain('First block of plain text')
		})

		it('append character after last mark when typing at end of mark row', async () => {
			const {container} = await render(<MarkdownDrag />)
			const markRow = getAllRows(container)[0]
			const editable = getEditableInRow(markRow)
			await focusAtEnd(editable)
			dispatchInsertText(editable, '!')
			await expect.element(page.getByText('# Welcome to Draggable Blocks!').first()).toBeInTheDocument()

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})

		it.todo('insert character at correct position mid-text within a mark row')
	})

	describe('paste in rows', () => {
		it('update raw value when pasting text at end of a plain text row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)
			const editable = getEditableInRow(rows[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, ' pasted')
			await expect.element(page.getByText(/First block of plain text pasted/).first()).toBeInTheDocument()

			expect(getRawValue(container)).toContain('First block of plain text pasted')
		})

		it('not affect other rows when pasting in one row', async () => {
			const {container} = await render(<PlainTextDrag />)
			const rows = getAllRows(container)
			const editable = getEditableInRow(rows[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, '!')
			await expect.element(page.getByText(/First block of plain text!/).first()).toBeInTheDocument()

			const raw = getRawValue(container)
			expect(raw).toContain('Second block of plain text')
			expect(raw).toContain('Fifth block of plain text')
			expect(getAllRows(container)).toHaveLength(5)
		})

		it('update raw value when pasting text at end of a mark row', async () => {
			const {container} = await render(<MarkdownDrag />)
			const markRow = getAllRows(container)[0]
			const editable = getEditableInRow(markRow)
			await focusAtEnd(editable)
			dispatchPaste(editable, '!')
			await expect.element(page.getByText('# Welcome to Draggable Blocks!').first()).toBeInTheDocument()

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})
	})

	describe('Enter mid-row split', () => {
		it('increase row count by 1', async () => {
			const {container} = await render(<PlainTextDrag />)

			const editable = getEditableInRow(getAllRows(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('put text before caret in current row', async () => {
			const {container} = await render(<PlainTextDrag />)

			const editable = getEditableInRow(getAllRows(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const rowTexts = raw.split('\n\n')
			expect(rowTexts[0]).toBe('First')
		})

		it('put text after caret in new row', async () => {
			const {container} = await render(<PlainTextDrag />)

			const editable = getEditableInRow(getAllRows(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const rowTexts = raw.split('\n\n')
			expect(rowTexts[1]).toBe(' block of plain text')
		})

		it('insert new empty row after mark row when pressing Enter on mark', async () => {
			const {container} = await render(<MarkdownDrag />)
			const blocks = getBlocks(container)
			const editable = getEditableInRow(blocks[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			expect(raw).toContain('# Welcome to Draggable Blocks\n\n')
		})
	})
})