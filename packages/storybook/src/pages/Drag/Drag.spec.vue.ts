// oxlint-disable typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-call
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'

import {childrenOf, firstChild, getActiveElement, getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as DragStories from './Drag.stories.vue'

const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)

const GRIP_SELECTOR = 'button[aria-label="Drag to reorder or click for options"]'

/**
 * Resolve the editor element whose direct children are drag rows.
 * Prefer the outermost `[class*="Container"]` that has DragMark children so we do not pick a
 * nested match or merge two editors when multiple roots exist in the tree.
 */
function findMarkputRowHost(container: Element): HTMLElement | null {
	const candidates = Array.from(container.querySelectorAll<HTMLElement>('[class*="Container"]'))
	for (const el of candidates) {
		const hasBlockChild = childrenOf(el).some(c => c instanceof HTMLElement && c.dataset.testid === 'block')
		if (hasBlockChild) return el
	}
	return container.querySelector<HTMLElement>('[class*="Container"]')
}

/** Get all rows (both mark blocks and DragMarks) as direct children of the markput container */
function getAllRows(container: Element) {
	const host = findMarkputRowHost(container)
	return host ? childrenOf(host) : []
}

/** Get only DragMark text blocks (have data-testid="block") within the resolved editor */
function getBlocks(container: Element) {
	const host = findMarkputRowHost(container)
	if (!host) return []
	return Array.from(host.querySelectorAll<HTMLElement>('[data-testid="block"]'))
}

function getRawValue(container: Element) {
	return container.querySelector('pre')!.textContent
}

function getEditableInRow(row: HTMLElement) {
	return row.querySelector('[contenteditable="true"]') ?? row
}

/**
 * Hover a row to reveal its overlay grip, then click the grip to open the menu.
 */
async function openMenuForRow(container: Element, rowIndex: number) {
	const row = getAllRows(container)[rowIndex]
	await userEvent.hover(row)
	await new Promise(r => setTimeout(r, 50))
	const grip = row.querySelector<HTMLButtonElement>(GRIP_SELECTOR)
	if (!grip) throw new Error(`No grip found after hovering row ${rowIndex}`)
	await userEvent.click(grip)
}

/**
 * Simulate an HTML5 drag-and-drop between two rows.
 */
async function simulateDragRow(
	container: Element,
	sourceIndex: number,
	targetIndex: number,
	position: 'before' | 'after' = 'after'
) {
	const rows = getAllRows(container)
	const sourceRow = rows[sourceIndex]
	const targetRow = rows[targetIndex]

	await userEvent.hover(sourceRow)
	await new Promise(r => setTimeout(r, 50))
	const grip = sourceRow.querySelector<HTMLButtonElement>(GRIP_SELECTOR)
	if (!grip) throw new Error(`No grip found for source row ${sourceIndex}`)

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

	await new Promise(r => setTimeout(r, 50))

	targetRow.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))

	await new Promise(r => setTimeout(r, 50))
}

/** Dispatch a synthetic beforeinput paste event using the current selection as the target range. */
function dispatchPaste(target: HTMLElement, text: string) {
	const sel = window.getSelection()
	if (!sel?.rangeCount) return
	const r = sel.getRangeAt(0)
	const staticRange = new StaticRange({
		startContainer: r.startContainer,
		startOffset: r.startOffset,
		endContainer: r.endContainer,
		endOffset: r.endOffset,
	})
	const dt = new DataTransfer()
	dt.setData('text/plain', text)
	target.dispatchEvent(
		new InputEvent('beforeinput', {
			bubbles: true,
			cancelable: true,
			inputType: 'insertFromPaste',
			dataTransfer: dt,
			targetRanges: [staticRange],
		})
	)
}

/** Dispatch a synthetic beforeinput insertText event using the current selection as the target range. */
function _dispatchInsertText(target: HTMLElement, text: string) {
	const sel = window.getSelection()
	if (!sel?.rangeCount) return
	const r = sel.getRangeAt(0)
	const staticRange = new StaticRange({
		startContainer: r.startContainer,
		startOffset: r.startOffset,
		endContainer: r.endContainer,
		endOffset: r.endOffset,
	})
	target.dispatchEvent(
		new InputEvent('beforeinput', {
			bubbles: true,
			cancelable: true,
			inputType: 'insertText',
			data: text,
			targetRanges: [staticRange],
		})
	)
}

describe('Feature: drag rows', () => {
	it('should render 5 rows for PlainTextDrag', async () => {
		const {container} = await render(PlainTextDrag)
		expect(getAllRows(container)).toHaveLength(5)
	})

	it('should render 4 rows for MarkdownDrag', async () => {
		const {container} = await render(MarkdownDrag)
		expect(getAllRows(container)).toHaveLength(4)
	})

	it('should render no grip buttons in read-only mode', async () => {
		const {container} = await render(ReadOnlyDrag)
		const rows = getAllRows(container)
		await userEvent.hover(rows[0])
		await new Promise(r => setTimeout(r, 50))
		expect(document.querySelectorAll(GRIP_SELECTOR)).toHaveLength(0)
	})

	it('should render content in read-only mode', async () => {
		await render(ReadOnlyDrag)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	describe('menu', () => {
		it('should open with Add below, Duplicate, Delete options', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('should close on Escape', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('should close when clicking outside', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(firstChild(container)!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add row', () => {
		it('should increase row count by 1 when adding below first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('should increase row count by 1 when adding below middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('should increase row count by 1 when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('should insert an empty row between the target and next row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('should not create a trailing separator when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n\n\n')).toBe(false)
		})

		it('should result in a single empty row when all rows are deleted', async () => {
			const {container} = await render(PlainTextDrag)

			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForRow(container, i)
				await userEvent.click(getElement(page.getByText('Delete')))
			}
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getRawValue(container)).toBe('')
		})
	})

	describe('delete row', () => {
		it('should decrease count by 1 when deleting middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
		})

		it('should preserve remaining content when deleting first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('should decrease count by 1 when deleting last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('should result in empty value when deleting the last remaining row', async () => {
			const {container} = await render(PlainTextDrag)

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
		it('should increase count by 1 when duplicating first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('should create a copy with the same text content', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('should increase count by 1 when duplicating last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('should create a new row when pressing Enter at end of text row', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getAllRows(container)).toHaveLength(5)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('should preserve all row content after pressing Enter', async () => {
			const {container} = await render(PlainTextDrag)
			const originalValue = getRawValue(container)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			const newValue = getRawValue(container)
			expect(newValue).not.toBe(originalValue)
			expect(newValue).toContain('First block of plain text')
			expect(newValue).toContain('Fifth block of plain text')
		})

		it('should not create a new row when pressing Shift+Enter', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getAllRows(container)).toHaveLength(5)
		})
	})

	describe('drag & drop', () => {
		it('should reorder rows when dragging row 0 after row 2', async () => {
			const {container} = await render(PlainTextDrag)

			await simulateDragRow(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('should not change order when dragging row onto itself', async () => {
			const {container} = await render(PlainTextDrag)
			const original = getRawValue(container)

			await simulateDragRow(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty row', () => {
		it('should delete the row and reduce count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))
			expect(getAllRows(container)).toHaveLength(6)

			const newRow = getAllRows(container)[1]
			newRow.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})

		it('should not delete a non-empty row on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})
	})

	it('should focus a row after Add below', async () => {
		const {container} = await render(PlainTextDrag)
		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Add below')))

		const activeEl = getActiveElement()
		expect(activeEl.closest('[class*="Container"]')).toBeTruthy()
	})

	it('should split row at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(PlainTextDrag)
		const editable = getEditableInRow(getAllRows(container)[0])
		await focusAtStart(editable)
		await userEvent.keyboard('{Enter}')

		expect(getAllRows(container)).toHaveLength(6)
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('should restore original value after add then delete', async () => {
		const {container} = await render(PlainTextDrag)
		const original = getRawValue(container)

		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Add below')))
		expect(getAllRows(container)).toHaveLength(6)

		await openMenuForRow(container, 1)
		await userEvent.click(getElement(page.getByText('Delete')))
		expect(getAllRows(container)).toHaveLength(5)

		expect(getRawValue(container)).toBe(original)
	})

	it('should restore original value after duplicate then delete', async () => {
		const {container} = await render(PlainTextDrag)
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
		it('should move focus to previous row when at start of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('should not cross to previous row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('should not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowRight cross-row', () => {
		it('should move focus to next row when at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('should not cross to next row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('should not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowRight}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowDown cross-row', () => {
		it('should move focus to next row when on last line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowDown}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('should not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowDown}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowUp cross-row', () => {
		it('should move focus to previous row when on first line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('should not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('Backspace merge rows (text+text)', () => {
		it('should merge with previous text row when Backspace pressed at start of non-empty row', async () => {
			const {container} = await render(PlainTextDrag)
			const before = getAllRows(container).length

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(before - 1)
		})

		describe('Backspace at start of text row after a mark row (navigate-only in drag mode)', () => {
			it('should NOT reduce row count when Backspace at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('should move focus to the mark row on Backspace at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(document.activeElement).toBe(markBlock)
			})
		})

		it('should preserve content of both merged rows', async () => {
			const {container} = await render(PlainTextDrag)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('should keep focus in the previous row after merge', async () => {
			const {container} = await render(PlainTextDrag)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const currentRows = getAllRows(container)
			expect(currentRows[0].contains(document.activeElement)).toBe(true)
		})

		it('should only delete one row at a time on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getAllRows(container)).toHaveLength(5)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(4)
		})
	})

	describe('Delete merge rows', () => {
		describe('Delete at end of row', () => {
			it('should merge with next row when Delete pressed at end of non-last row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getAllRows(container).length

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should keep focus in the current row after Delete merge', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				const currentRows = getAllRows(container)
				expect(currentRows[0].contains(document.activeElement)).toBe(true)
			})

			it('should not merge when Delete pressed at end of last row', async () => {
				const {container} = await render(PlainTextDrag)
				const rows = getAllRows(container)
				const last = rows[rows.length - 1]

				await focusAtEnd(getEditableInRow(last))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(5)
			})
		})

		describe('Delete at start of row', () => {
			it('should merge current row into previous when Delete pressed at start of non-first row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getAllRows(container).length

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should move focus to the previous row after merge', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const currentRows = getAllRows(container)
				expect(currentRows[0].contains(document.activeElement)).toBe(true)
			})

			it('should not merge when Delete pressed at start of the first row', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(5)
			})

			it('should place caret at the join point after merge', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain textSecond block of plain text')
			})
		})

		describe('Delete at mark→text boundary (navigate-only in drag mode)', () => {
			it('should NOT reduce row count when Delete at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('should move focus to mark row on Delete at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(markBlock)
			})
		})
	})

	describe('typing in rows', () => {
		it('should update raw value when typing a character at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('!')

			expect(getRawValue(container)).toContain('First block of plain text!')
		})

		it.todo('should update raw value when deleting a character with Backspace mid-row')

		it('should not wipe all rows when Ctrl+A in focused row then typing', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			getEditableInRow(rows[1]).focus()
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			expect(getRawValue(container)).not.toBe('X')
			expect(getRawValue(container)).toContain('First block of plain text')
		})

		it('should append character after last mark when typing at end of mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInRow(blocks[0]))
			await userEvent.keyboard('!')

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})

		it.todo('should insert character at correct position mid-text within a mark row')
	})

	describe('paste in rows', () => {
		it('should update raw value when pasting text at end of a plain text row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const editable = getEditableInRow(rows[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, ' pasted')
			await new Promise(r => setTimeout(r, 50))

			expect(getRawValue(container)).toContain('First block of plain text pasted')
		})

		it('should not affect other rows when pasting in one row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const editable = getEditableInRow(rows[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, '!')
			await new Promise(r => setTimeout(r, 50))

			const raw = getRawValue(container)
			expect(raw).toContain('Second block of plain text')
			expect(raw).toContain('Fifth block of plain text')
			expect(getAllRows(container)).toHaveLength(5)
		})

		it('should update raw value when pasting text at end of a mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			const editable = getEditableInRow(blocks[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, '!')
			await new Promise(r => setTimeout(r, 50))

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})
	})

	describe('Enter mid-row split', () => {
		it('should increase row count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInRow(getAllRows(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it.todo('should put text before caret in current row')

		it.todo('should put text after caret in new row')

		it('should insert new empty row after mark row when pressing Enter on mark', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInRow(blocks[0]))
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			expect(raw).toContain('# Welcome to Draggable Blocks\n\n')
		})
	})
})