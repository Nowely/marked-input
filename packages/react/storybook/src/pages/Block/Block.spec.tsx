import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {focusAtEnd} from '../../shared/lib/focus'
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
	return blockDiv.querySelector('[contenteditable="true"]') as HTMLElement
}

/** Read the raw value from the <pre> rendered by the Text component */
function getRawValue(container: Element) {
	return container.querySelector('pre')!.textContent!
}

/**
 * Simulate an HTML5 drag-and-drop: drag the grip at sourceGripIndex and drop it
 * onto the block at targetBlockIndex. The drop lands in the 'after' position
 * (cursor past the midpoint of the target) by default.
 */
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

	// dragstart — React handler sets dt data as side-effect
	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}))

	// dragover — React handler reads clientY to set dropPosition state
	const rect = targetBlock.getBoundingClientRect()
	targetBlock.dispatchEvent(
		new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: dt,
			clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
		})
	)

	// Allow React to flush the dropPosition state update before drop fires
	await new Promise(r => setTimeout(r, 50))

	// drop — React handler reads dt data and calls onReorder
	targetBlock.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))

	// Allow React to re-render after reorder
	await new Promise(r => setTimeout(r, 50))
}

/** Hover a block to reveal its grip, then click it to open the menu */
async function openMenuForGrip(container: Element, gripIndex: number) {
	const grip = getGrips(container)[gripIndex]
	await userEvent.hover(getBlockDiv(grip))
	await userEvent.click(grip)
}

describe('Feature: blocks', () => {
	it('should render 5 blocks for BasicDraggable', async () => {
		const {container} = await render(<BasicDraggable />)
		expect(getGrips(container)).toHaveLength(5)
	})

	it('should render 6 blocks for MarkdownDocument', async () => {
		const {container} = await render(<MarkdownDocument />)
		expect(getGrips(container)).toHaveLength(6)
	})

	it('should render 5 blocks for PlainTextBlocks', async () => {
		const {container} = await render(<PlainTextBlocks />)
		expect(getGrips(container)).toHaveLength(5)
	})

	it('should render no grip buttons in read-only mode', async () => {
		const {container} = await render(<ReadOnlyDraggable />)
		expect(getGrips(container)).toHaveLength(0)
	})

	it('should render content in read-only mode', async () => {
		await render(<ReadOnlyDraggable />)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	describe('menu', () => {
		it('should open with Add below, Duplicate, Delete options', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('should close on Escape', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('should close when clicking outside', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(container.firstElementChild!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add block', () => {
		it('should increase block count by 1 when adding below first block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase block count by 1 when adding below middle block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should increase block count by 1 when adding below last block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should insert an empty block between the target and next block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('should not create a trailing separator when adding below last block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n')).toBe(false)
		})

		it('should work when value is empty', async () => {
			const {container} = await render(<PlainTextBlocks />)

			// Delete all blocks until value is '' — sequential DOM interactions
			// eslint-disable-next-line no-await-in-loop
			for (let i = 4; i > 0; i--) {
				await openMenuForGrip(container, i)
				await userEvent.click(page.getByText('Delete').element())
			}
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			// Editor renders 1 empty block even when value is ''
			expect(getGrips(container)).toHaveLength(1)

			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(2)
		})
	})

	describe('delete block', () => {
		it('should decrease count by 1 when deleting middle block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
		})

		it('should preserve remaining content when deleting first block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('should decrease count by 1 when deleting last block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('should result in empty value when deleting the last remaining block', async () => {
			const {container} = await render(<PlainTextBlocks />)

			// Sequential DOM interactions — must await each step
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
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should create a copy with the same text content', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('should increase count by 1 when duplicating last block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('should create a new block when pressing Enter at end of block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			expect(getGrips(container)).toHaveLength(5)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getGrips(container)).toHaveLength(6)
		})

		it('should preserve all block content after pressing Enter', async () => {
			const {container} = await render(<PlainTextBlocks />)
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
			const {container} = await render(<PlainTextBlocks />)

			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	describe('drag & drop', () => {
		it('should reorder blocks when dragging block 0 after block 2', async () => {
			const {container} = await render(<PlainTextBlocks />)

			await simulateDragBlock(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('should not change order when dragging block onto itself', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const original = getRawValue(container)

			await simulateDragBlock(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty block', () => {
		it('should delete the block and reduce count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)

			// Insert an empty block after block 0
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())
			expect(getGrips(container)).toHaveLength(6)

			// Focus the new empty block (index 1) and press Backspace
			const newBlockDiv = getBlockDiv(getGrips(container)[1])
			newBlockDiv.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getGrips(container)).toHaveLength(5)
		})

		it('should not delete a non-empty block on Backspace', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			// Only one character was deleted, not the whole block
			expect(getGrips(container)).toHaveLength(5)
		})
	})

	it('should focus the new empty block after Add below', async () => {
		const {container} = await render(<PlainTextBlocks />)
		await openMenuForGrip(container, 0)
		await userEvent.click(page.getByText('Add below').element())

		const newBlockDiv = getBlockDiv(getGrips(container)[1])
		expect(document.activeElement).toBe(newBlockDiv)
	})

	it('should split block at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(<PlainTextBlocks />)
		const editable = getEditableInBlock(getBlockDiv(getGrips(container)[0]))
		await userEvent.click(editable)
		await userEvent.keyboard('{Home}')
		await userEvent.keyboard('{Enter}')

		expect(getGrips(container)).toHaveLength(6)
		// Original first-block text should still be present
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('should restore original value after add then delete', async () => {
		const {container} = await render(<PlainTextBlocks />)
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
		const {container} = await render(<PlainTextBlocks />)
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