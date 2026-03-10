import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'

import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as BlockStories from './Block.stories'

const {BasicDraggable, MarkdownDocument, PlainTextBlocks, ReadOnlyDraggable} = composeStories(BlockStories)

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

describe('Feature: blocks', () => {
	it('should render 6 blocks for BasicDraggable', async () => {
		const {container} = await render(BasicDraggable)
		expect(getGrips(container)).toHaveLength(6)
	})

	it('should render 10 blocks for MarkdownDocument', async () => {
		const {container} = await render(MarkdownDocument)
		expect(getGrips(container)).toHaveLength(10)
	})

	it('should render 5 blocks for PlainTextBlocks', async () => {
		const {container} = await render(PlainTextBlocks)
		expect(getGrips(container)).toHaveLength(5)
	})

	it('should render no grip buttons in read-only mode', async () => {
		const {container} = await render(ReadOnlyDraggable)
		expect(getGrips(container)).toHaveLength(0)
	})

	it('should render content in read-only mode', async () => {
		await render(ReadOnlyDraggable)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	describe('menu', () => {
		it('should open with Add below, Duplicate, Delete options', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('should close on Escape', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('should close when clicking outside', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(container.firstElementChild!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add block', () => {
		it('should increase block count by 1 when adding below first block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase block count by 1 when adding below middle block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase block count by 1 when adding below last block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should insert an empty block between the target and next block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('should not create a trailing separator when adding below last block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n')).toBe(false)
		})

		it('should result in a single empty block when all blocks are deleted', async () => {
			const {container} = await render(PlainTextBlocks)

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

	describe('delete block', () => {
		it('should decrease count by 1 when deleting middle block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
		})

		it('should preserve remaining content when deleting first block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('should decrease count by 1 when deleting last block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('should result in empty value when deleting the last remaining block', async () => {
			const {container} = await render(PlainTextBlocks)

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

	describe('duplicate block', () => {
		it('should increase count by 1 when duplicating first block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should create a copy with the same text content', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('should increase count by 1 when duplicating last block', async () => {
			const {container} = await render(PlainTextBlocks)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('should create a new block when pressing Enter at end of block', async () => {
			const {container} = await render(PlainTextBlocks)
			expect(getGrips(container)).toHaveLength(5)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should preserve all block content after pressing Enter', async () => {
			const {container} = await render(PlainTextBlocks)
			const originalValue = getRawValue(container)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			const newValue = getRawValue(container)
			expect(newValue).not.toBe(originalValue)
			expect(newValue).toContain('First block of plain text')
			expect(newValue).toContain('Fifth block of plain text')
		})

		it('should not create a new block when pressing Shift+Enter', async () => {
			const {container} = await render(PlainTextBlocks)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	describe('drag & drop', () => {
		it('should reorder blocks when dragging block 0 after block 2', async () => {
			const {container} = await render(PlainTextBlocks)

			await simulateDragBlock(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('should not change order when dragging block onto itself', async () => {
			const {container} = await render(PlainTextBlocks)
			const original = getRawValue(container)

			await simulateDragBlock(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty block', () => {
		it('should delete the block and reduce count by 1', async () => {
			const {container} = await render(PlainTextBlocks)

			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())
			expect(getGrips(container)).toHaveLength(6)

			const newBlockDiv = getBlockDiv(getGrips(container)[1])
			newBlockDiv.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getGrips(container)).toHaveLength(5)
		})

		it('should not delete a non-empty block on Backspace', async () => {
			const {container} = await render(PlainTextBlocks)
			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	it('should focus a block after Add below', async () => {
		const {container} = await render(PlainTextBlocks)
		await openMenuForGrip(container, 0)
		await userEvent.click(page.getByText('Add below').element())

		const activeEl = document.activeElement as HTMLElement
		expect(activeEl?.closest('[data-testid="block"]')).toBeTruthy()
	})

	it('should split block at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(PlainTextBlocks)
		const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
		await focusAtStart(editable)
		await userEvent.keyboard('{Enter}')

		expect(getGrips(container)).toHaveLength(6)
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('should restore original value after add then delete', async () => {
		const {container} = await render(PlainTextBlocks)
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
		const {container} = await render(PlainTextBlocks)
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

describe('Feature: block keyboard navigation', () => {
	describe('ArrowLeft cross-block', () => {
		it('should move focus to previous block when at start of block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross to previous block when caret is mid-block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross block boundary from the first block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(document.activeElement).toBe(blocks[0])
		})
	})

	describe('ArrowRight cross-block', () => {
		it('should move focus to next block when at end of block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross to next block when caret is mid-block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross block boundary from the last block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)
			const last = blocks[blocks.length - 1]

			await focusAtEnd(getEditableInBlock(last))
			await userEvent.keyboard('{ArrowRight}')

			expect(document.activeElement).toBe(last)
		})
	})

	describe('ArrowDown cross-block', () => {
		it('should move focus to next block when on last line of block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowDown}')

			expect(document.activeElement).toBe(blocks[1])
		})

		it('should not cross block boundary from the last block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)
			const last = blocks[blocks.length - 1]

			await focusAtEnd(getEditableInBlock(last))
			await userEvent.keyboard('{ArrowDown}')

			expect(document.activeElement).toBe(last)
		})
	})

	describe('ArrowUp cross-block', () => {
		it('should move focus to previous block when on first line of block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{ArrowUp}')

			expect(document.activeElement).toBe(blocks[0])
		})

		it('should not cross block boundary from the first block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			await focusAtStart(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('{ArrowUp}')

			expect(document.activeElement).toBe(blocks[0])
		})
	})

	describe('Backspace merge blocks', () => {
		it('should merge with previous block when Backspace pressed at start of non-empty block', async () => {
			const {container} = await render(PlainTextBlocks)
			const before = getBlocks(container).length

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getBlocks(container)).toHaveLength(before - 1)
		})

		it('should preserve content of both merged blocks', async () => {
			const {container} = await render(PlainTextBlocks)

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('should keep focus in the previous block after merge', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)
			const prevBlock = blocks[0]

			await focusAtStart(getEditableInBlock(blocks[1]))
			await userEvent.keyboard('{Backspace}')

			expect(document.activeElement).toBe(prevBlock)
		})

		it('should only delete one block at a time on Backspace', async () => {
			const {container} = await render(PlainTextBlocks)
			expect(getBlocks(container)).toHaveLength(5)

			await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getBlocks(container)).toHaveLength(4)
		})
	})

	describe('Delete merge blocks', () => {
		describe('Delete at end of block', () => {
			it('should merge with next block when Delete pressed at end of non-last block', async () => {
				const {container} = await render(PlainTextBlocks)
				const before = getBlocks(container).length

				await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged blocks', async () => {
				const {container} = await render(PlainTextBlocks)

				await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should keep focus in the current block after Delete merge', async () => {
				const {container} = await render(PlainTextBlocks)
				const currentBlock = getBlocks(container)[0]

				await focusAtEnd(getEditableInBlock(currentBlock))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(currentBlock)
			})

			it('should not merge when Delete pressed at end of last block', async () => {
				const {container} = await render(PlainTextBlocks)
				const blocks = getBlocks(container)
				const last = blocks[blocks.length - 1]

				await focusAtEnd(getEditableInBlock(last))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(5)
			})
		})

		describe('Delete at start of block', () => {
			it('should merge current block into previous when Delete pressed at start of non-first block', async () => {
				const {container} = await render(PlainTextBlocks)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before - 1)
			})

			it('should preserve content of both merged blocks', async () => {
				const {container} = await render(PlainTextBlocks)

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('should move focus to the previous block after merge', async () => {
				const {container} = await render(PlainTextBlocks)
				const prevBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(document.activeElement).toBe(prevBlock)
			})

			it('should not merge when Delete pressed at start of the first block', async () => {
				const {container} = await render(PlainTextBlocks)

				await focusAtStart(getEditableInBlock(getBlocks(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(5)
			})

			it('should place caret at the join point after merge', async () => {
				const {container} = await render(PlainTextBlocks)

				await focusAtStart(getEditableInBlock(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				// After merge, typing should insert right at the join point
				// (between the end of block 0 and start of block 1 text)
				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain textSecond block of plain text')
			})
		})
	})

	describe('typing in blocks', () => {
		it('should update raw value when typing a character at end of block', async () => {
			const {container} = await render(PlainTextBlocks)
			await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
			await userEvent.keyboard('!')

			expect(getRawValue(container)).toContain('First block of plain text!')
		})

		it('should update raw value when deleting a character with Backspace mid-block', async () => {
			const {container} = await render(PlainTextBlocks)
			await focusAtEnd(getEditableInBlock(getBlocks(container)[0]))
			await userEvent.keyboard('{Backspace}')

			expect(getRawValue(container)).toContain('First block of plain tex')
			expect(getRawValue(container)).not.toContain('First block of plain text\n\n')
		})

		it('should not wipe all blocks when Ctrl+A in focused block then typing', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)

			getEditableInBlock(blocks[1]).focus()
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			expect(getRawValue(container)).not.toBe('X')
			expect(getRawValue(container)).toContain('First block of plain text')
		})

		it('should append character after last mark when typing at end of mark block', async () => {
			const {container} = await render(MarkdownDocument)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			await userEvent.keyboard('!')

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to **Marked Input**!')
		})

		it('should insert character at correct position mid-text within a mark block', async () => {
			const {container} = await render(MarkdownDocument)
			const blocks = getBlocks(container)
			await focusAtStart(blocks[0])
			await userEvent.keyboard('{ArrowRight}{ArrowRight}')
			dispatchInsertText(blocks[0], 'X')
			await new Promise(r => setTimeout(r, 50))

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# WeXlcome to **Marked Input**')
		})
	})

	describe('paste in blocks', () => {
		it('should update raw value when pasting text at end of a plain text block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(blocks[0], ' pasted')
			await new Promise(r => setTimeout(r, 50))

			expect(getRawValue(container)).toContain('First block of plain text pasted')
		})

		it('should not affect other blocks when pasting in one block', async () => {
			const {container} = await render(PlainTextBlocks)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(blocks[0], '!')
			await new Promise(r => setTimeout(r, 50))

			const raw = getRawValue(container)
			expect(raw).toContain('Second block of plain text')
			expect(raw).toContain('Fifth block of plain text')
			expect(getBlocks(container)).toHaveLength(5)
		})

		it('should update raw value when pasting text at end of a mark block', async () => {
			const {container} = await render(MarkdownDocument)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInBlock(blocks[0]))
			dispatchPaste(getEditableInBlock(blocks[0]), '!')
			await new Promise(r => setTimeout(r, 50))

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to **Marked Input**!')
		})
	})

	describe('Enter mid-block split', () => {
		it('should increase block count by 1', async () => {
			const {container} = await render(PlainTextBlocks)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(getBlocks(container)).toHaveLength(6)
		})

		it('should put text before caret in current block', async () => {
			const {container} = await render(PlainTextBlocks)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const blockTexts = raw.split('\n\n')
			expect(blockTexts[0]).toBe('First')
		})

		it('should put text after caret in new block', async () => {
			const {container} = await render(PlainTextBlocks)

			const editable = getEditableInBlock(getBlocks(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			const blockTexts = raw.split('\n\n')
			expect(blockTexts[1]).toBe(' block of plain text')
		})

		it('should not expose raw markdown syntax in block[0] after Enter with marks', async () => {
			const {container} = await render(MarkdownDocument)
			const blocks = getBlocks(container)
			await focusAtEnd(blocks[0])
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			expect(raw).toContain('**Marked Input**\n\n')
		})
	})
})