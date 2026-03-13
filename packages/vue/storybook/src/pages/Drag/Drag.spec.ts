import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'

import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as DragStories from './Drag.stories'

const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)

const GRIP_SELECTOR = 'button[aria-label="Drag to reorder or click for options"]'

function getGrips(container: Element) {
	return container.querySelectorAll<HTMLButtonElement>(GRIP_SELECTOR)
}

function getBlockDiv(grip: HTMLElement) {
	return grip.closest('[data-testid="block"]') as HTMLElement
}

function getEditableInBlock(blockDiv: HTMLElement) {
	return (blockDiv.querySelector('[contenteditable="true"]') ?? blockDiv) as HTMLElement
}

function getBlocks(container: Element) {
	return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="block"]'))
}

function getRawValue(container: Element) {
	return container.querySelector('pre')!.textContent!
}

async function simulateDragBlock(
	container: Element,
	sourceGripIndex: number,
	targetBlockIndex: number,
	position: 'before' | 'after' = 'after'
) {
	const grips = getGrips(container)
	const blocks = Array.from(container.querySelectorAll('[data-testid="block"]')) as HTMLElement[]
	const grip = grips[sourceGripIndex]
	const targetBlock = blocks[targetBlockIndex]

	const dt = new DataTransfer()

	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}))

	const rect = targetBlock.getBoundingClientRect()
	targetBlock.dispatchEvent(
		new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: dt,
			clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
		})
	)

	await new Promise(r => setTimeout(r, 50))

	targetBlock.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))

	await new Promise(r => setTimeout(r, 50))
}

/** Hover a block to reveal its grip, then click it to open the menu */
async function openMenuForGrip(container: Element, gripIndex: number) {
	const grip = getGrips(container)[gripIndex]
	await userEvent.hover(getBlockDiv(grip))
	await userEvent.click(grip)
}

describe('Feature: drag rows', () => {
	it('should render 5 rows for PlainTextDrag', async () => {
		const {container} = await render(PlainTextDrag)
		expect(getGrips(container)).toHaveLength(5)
	})

	it('should render 5 rows for MarkdownDrag', async () => {
		const {container} = await render(MarkdownDrag)
		expect(getGrips(container)).toHaveLength(5)
	})

	it('should render no grip buttons in read-only mode', async () => {
		const {container} = await render(ReadOnlyDrag)
		expect(getGrips(container)).toHaveLength(0)
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
			await openMenuForGrip(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('should close on Escape', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('should close when clicking outside', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(container.firstElementChild!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add row', () => {
		it('should increase row count by 1 when adding below first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase row count by 1 when adding below middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase row count by 1 when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should insert an empty row between the target and next row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('should not create a trailing separator when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n')).toBe(false)
		})

		it('should result in a single empty row when all rows are deleted', async () => {
			const {container} = await render(PlainTextDrag)

			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForGrip(container, i)
				await userEvent.click(page.getByText('Delete').element())
			}
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getRawValue(container)).toBe('')
		})
	})

	describe('delete row', () => {
		it('should decrease count by 1 when deleting middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
		})

		it('should preserve remaining content when deleting first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('should decrease count by 1 when deleting last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('should result in empty value when deleting the last remaining row', async () => {
			const {container} = await render(PlainTextDrag)

			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForGrip(container, i)
				await userEvent.click(page.getByText('Delete').element())
			}

			expect(getGrips(container)).toHaveLength(1)

			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getRawValue(container)).toBe('')
		})
	})

	describe('duplicate row', () => {
		it('should increase count by 1 when duplicating first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should create a copy with the same text content', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('should increase count by 1 when duplicating last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('should create a new row when pressing Enter at end of text row', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getGrips(container)).toHaveLength(5)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should preserve all row content after pressing Enter', async () => {
			const {container} = await render(PlainTextDrag)
			const originalValue = getRawValue(container)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			const newValue = getRawValue(container)
			expect(newValue).not.toBe(originalValue)
			expect(newValue).toContain('First block of plain text')
			expect(newValue).toContain('Fifth block of plain text')
		})

		it('should not create a new row when pressing Shift+Enter', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	describe('drag & drop', () => {
		it('should reorder rows when dragging row 0 after row 2', async () => {
			const {container} = await render(PlainTextDrag)

			await simulateDragBlock(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('should not change order when dragging row onto itself', async () => {
			const {container} = await render(PlainTextDrag)
			const original = getRawValue(container)

			await simulateDragBlock(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty row', () => {
		it('should delete the row and reduce count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())
			expect(getGrips(container)).toHaveLength(6)

			const newBlockDiv = getBlockDiv(getGrips(container)[1])
			newBlockDiv.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getGrips(container)).toHaveLength(5)
		})

		it('should not delete a non-empty row on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	it('should focus a row after Add below', async () => {
		const {container} = await render(PlainTextDrag)
		await openMenuForGrip(container, 0)
		await userEvent.click(page.getByText('Add below').element())

		const activeEl = document.activeElement as HTMLElement
		expect(activeEl?.closest('[data-testid="block"]')).toBeTruthy()
	})

	it('should split row at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(PlainTextDrag)
		const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
		await focusAtStart(editable)
		await userEvent.keyboard('{Enter}')

		expect(getGrips(container)).toHaveLength(6)
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('should restore original value after add then delete', async () => {
		const {container} = await render(PlainTextDrag)
		const original = getRawValue(container)

		await openMenuForGrip(container, 0)
		await userEvent.click(page.getByText('Add below').element())
		expect(getGrips(container)).toHaveLength(6)

		await openMenuForGrip(container, 1)
		await userEvent.click(page.getByText('Delete').element())
		expect(getGrips(container)).toHaveLength(5)

		expect(getRawValue(container)).toBe(original)
	})

	it('should restore original value after duplicate then delete', async () => {
		const {container} = await render(PlainTextDrag)
		const original = getRawValue(container)

		await openMenuForGrip(container, 0)
		await userEvent.click(page.getByText('Duplicate').element())
		expect(getGrips(container)).toHaveLength(6)

		await openMenuForGrip(container, 1)
		await userEvent.click(page.getByText('Delete').element())
		expect(getGrips(container)).toHaveLength(5)

		expect(getRawValue(container)).toBe(original)
	})
})

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

function dispatchInsertText(target: HTMLElement, text: string) {
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

describe('Feature: drag row keyboard navigation', () => {
	describe('ArrowLeft cross-row', () => {
		it('should move focus to previous row when at start of row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross to previous row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[0])
		})
	})

	describe('ArrowRight cross-row', () => {
		it('should move focus to next row when at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross to next row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)
			const last = blocks[blocks.length - 1]

			await focusAtEnd(getEditableInBlock(last))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(last)
		})
	})

	describe('ArrowDown cross-row', () => {
		it('should move focus to next row when on last line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowDown}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)
			const last = blocks[blocks.length - 1]

			await focusAtEnd(getEditableInBlock(last))
			await userEvent.keyboard('{ArrowDown}')

			expect(document.activeElement).toBe(last)
		})
	})

	describe('ArrowUp cross-row', () => {
		it('should move focus to previous row when on first line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowUp}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowUp}')

			expect(document.activeElement).toBe(blocks[0])
		})
	})

	describe('Backspace merge rows (text+text)', () => {
		it('should merge with previous text row when Backspace pressed at start of non-empty row', async () => {
			const {container} = await render(PlainTextDrag)
			const before = getBlocks(container).length

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getBlocks(container)).toHaveLength(before - 1)
		})

		describe('Backspace at start of text row after a mark row (navigate-only in drag mode)', () => {
			// In drag mode, mark→text boundary is navigate-only: Backspace moves focus
			// to the mark row but does NOT merge.

			it('should NOT reduce row count when Backspace at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('should move focus to the mark row on Backspace at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(document.activeElement).toBe(markBlock)
			})
		})

		it('should preserve content of both merged rows', async () => {
			const {container} = await render(PlainTextDrag)

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('should keep focus in the previous row after merge', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)
			const prevBlock = blocks[0]

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{Backspace}')

			expect(document.activeElement).toBe(prevBlock)
		})

		it('should only delete one row at a time on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getBlocks(container)).toHaveLength(5)

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getBlocks(container)).toHaveLength(4)
		})
	})

	describe('Delete merge rows', () => {
		describe('Delete at end of row', () => {
			it('should merge with next row when Delete pressed at end of non-last row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getBlocks(container).length

				await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should keep focus in the current row after Delete merge', async () => {
				const {container} = await render(PlainTextDrag)
				const currentBlock = getBlocks(container)[0]

				await focusAtEnd(getEditableInBlock(currentBlock))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(currentBlock)
			})

			it('should not merge when Delete pressed at end of last row', async () => {
				const {container} = await render(PlainTextDrag)
				const blocks = getBlocks(container)
				const last = blocks[blocks.length - 1]

				await focusAtEnd(getEditableInBlock(last))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(5)
			})
		})

		describe('Delete at start of row', () => {
			it('should merge current row into previous when Delete pressed at start of non-first row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should move focus to the previous row after merge', async () => {
				const {container} = await render(PlainTextDrag)
				const prevBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(prevBlock)
			})

			it('should not merge when Delete pressed at start of the first row', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(5)
			})

			it('should place caret at the join point after merge', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain textSecond block of plain text')
			})
		})

		describe('Delete at mark→text boundary (navigate-only in drag mode)', () => {
			it('should NOT reduce row count when Delete at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('should move focus to mark row on Delete at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(markBlock)
			})
		})
	})

	describe('typing in rows', () => {
		it('should update raw value when typing a character at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
			await userEvent.keyboard('!')

			expect(getRawValue(container)).toContain('First block of plain text!')
		})

		it('should update raw value when deleting a character with Backspace mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
			await userEvent.keyboard('{Backspace}')

			expect(getRawValue(container)).toContain('First block of plain tex')
			expect(getRawValue(container)).not.toContain('First block of plain text\n\n')
		})

		it('should not wipe all rows when Ctrl+A in focused row then typing', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)

			getEditableInBlock(blocks[1]).focus()
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			expect(getRawValue(container)).not.toBe('X')
			expect(getRawValue(container)).toContain('First block of plain text')
		})

		it('should append character after last mark when typing at end of mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('!')

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})

		it('should insert character at correct position mid-text within a mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtStart(blocks[0])
			await userEvent.keyboard('{ArrowRight}{ArrowRight}')
			dispatchInsertText(blocks[0], 'X')
			await new Promise(r => setTimeout(r, 50))

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# WeXlcome to Draggable Blocks')
		})
	})

	describe('paste in rows', () => {
		it('should update raw value when pasting text at end of a plain text row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(blocks[0], ' pasted')
			await new Promise(r => setTimeout(r, 50))

			expect(getRawValue(container)).toContain('First block of plain text pasted')
		})

		it('should not affect other rows when pasting in one row', async () => {
			const {container} = await render(PlainTextDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(blocks[0], '!')
			await new Promise(r => setTimeout(r, 50))

			const raw = getRawValue(container)
			expect(raw).toContain('Second block of plain text')
			expect(raw).toContain('Fifth block of plain text')
			expect(getBlocks(container)).toHaveLength(5)
		})

		it('should update raw value when pasting text at end of a mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(getEditableInBlock(blocks[0]), '!')
			await new Promise(r => setTimeout(r, 50))

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})
	})

	describe('Enter mid-row split', () => {
		it('should increase row count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(getBlocks(container)).toHaveLength(6)
		})

		it('should put text before caret in current row', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const rowTexts = raw.split('\n\n')
			expect(rowTexts[0]).toBe('First')
		})

		it('should put text after caret in new row', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const rowTexts = raw.split('\n\n')
			expect(rowTexts[1]).toBe(' block of plain text')
		})

		it('should insert new empty row after mark row when pressing Enter on mark', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(blocks[0])
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			expect(raw).toContain('# Welcome to Draggable Blocks\n\n')
		})
	})
})