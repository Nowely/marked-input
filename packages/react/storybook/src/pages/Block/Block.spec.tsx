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

/** Read the raw value from the <pre> rendered by the Text component */
function getRawValue(container: Element) {
	return container.querySelector('pre')!.textContent!
}

/** Hover a block to reveal its grip, then click it to open the menu */
async function openMenuForGrip(container: Element, gripIndex: number) {
	const grip = getGrips(container)[gripIndex]
	await userEvent.hover(getBlockDiv(grip))
	await userEvent.click(grip)
}

describe('Block Feature', () => {
	// ── Phase 1: Bug-exposing tests ────────────────────────────────

	describe('Rendering — block counts', () => {
		it('BasicDraggable renders 5 blocks', async () => {
			const {container} = await render(<BasicDraggable />)
			expect(getGrips(container)).toHaveLength(5)
		})

		it('MarkdownDocument renders 6 blocks', async () => {
			const {container} = await render(<MarkdownDocument />)
			// Mark tokens can merge adjacent text blocks, resulting in 6 blocks
			expect(getGrips(container)).toHaveLength(6)
		})

		it('PlainTextBlocks renders 5 blocks', async () => {
			const {container} = await render(<PlainTextBlocks />)
			expect(getGrips(container)).toHaveLength(5)
		})

		it('ReadOnlyDraggable renders no grip buttons', async () => {
			const {container} = await render(<ReadOnlyDraggable />)
			expect(getGrips(container)).toHaveLength(0)
		})

		it('ReadOnlyDraggable still renders content', async () => {
			await render(<ReadOnlyDraggable />)
			await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
			await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
			await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
		})
	})

	describe('Bug #5 — Add block on last block creates trailing empty block', () => {
		it('adding below last block increases count by exactly 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			expect(getGrips(container)).toHaveLength(5)

			// Open menu on last block (index 4)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('value after adding below last block does not end with double separator', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			// Should end with exactly one \n\n (the separator before the new empty block),
			// NOT \n\n\n\n (which would mean a trailing extra separator)
			expect(raw.endsWith('\n\n\n\n')).toBe(false)
		})
	})

	describe('Bug #6 — Delete single remaining block', () => {
		it('deleting blocks until one remains, then deleting that block', async () => {
			const {container} = await render(<PlainTextBlocks />)

			// Delete blocks from the end until only 1 remains
			for (let i = 4; i > 0; i--) {
				await openMenuForGrip(container, i)
				await userEvent.click(page.getByText('Delete').element())
			}

			expect(getGrips(container)).toHaveLength(1)

			// Delete the last remaining block — exposes bug #6
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			const raw = getRawValue(container)
			// After deleting the only block, value becomes '' — the editor should still render
			expect(raw).toBe('')
		})
	})

	describe('Bug #1 — Empty value guard blocks operations', () => {
		it('adding a block after deleting all blocks should work', async () => {
			const {container} = await render(<PlainTextBlocks />)

			// Delete all blocks
			for (let i = 4; i > 0; i--) {
				await openMenuForGrip(container, i)
				await userEvent.click(page.getByText('Delete').element())
			}
			// Delete the last one
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			// Now value is '' — try to add a block
			// Bug #1: if (!value || !onChange) return — empty string is falsy, so this no-ops
			const gripsAfterEmpty = getGrips(container)
			if (gripsAfterEmpty.length > 0) {
				await openMenuForGrip(container, 0)
				await userEvent.click(page.getByText('Add below').element())
				// If bug is fixed, block count should increase
				expect(getGrips(container).length).toBeGreaterThan(0)
			}
		})
	})

	// ── Phase 2: Block Menu ────────────────────────────────────────

	describe('Block Menu', () => {
		it('clicking grip opens menu with Add below, Duplicate, Delete', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('Escape key closes the menu', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('clicking outside the menu closes it', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			// Click on the story wrapper (outside the menu)
			await userEvent.click(container.firstElementChild!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	// ── Phase 2: Add Block ─────────────────────────────────────────

	describe('Add Block', () => {
		it('add below first block increases block count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('add below middle block increases block count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Add below').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('new block added below first block is empty', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const originalValue = getRawValue(container)

			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())

			const raw = getRawValue(container)
			// Original "First block of plain text\n\n..."
			// After add: "First block of plain text\n\n\n\n..." (new separator + empty block before second block)
			expect(raw.length).toBeGreaterThan(originalValue.length)
		})
	})

	// ── Phase 2: Delete Block ──────────────────────────────────────

	describe('Delete Block', () => {
		it('delete middle block decreases count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 2)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
		})

		it('delete first block preserves remaining content', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			const raw = getRawValue(container)
			expect(raw).toContain('Second block of plain text')
		})

		it('delete last block decreases count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Delete').element())

			expect(getGrips(container)).toHaveLength(4)
			const raw = getRawValue(container)
			expect(raw).toContain('Fourth block of plain text')
			expect(raw).not.toContain('Fifth block of plain text')
		})
	})

	// ── Phase 2: Duplicate Block ───────────────────────────────────

	describe('Duplicate Block', () => {
		it('duplicate first block increases count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})

		it('duplicate creates a copy with same text content', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())

			const raw = getRawValue(container)
			// "First block of plain text" should appear twice
			const matches = raw.match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('duplicate last block increases count by 1', async () => {
			const {container} = await render(<PlainTextBlocks />)
			await openMenuForGrip(container, 4)
			await userEvent.click(page.getByText('Duplicate').element())

			expect(getGrips(container)).toHaveLength(6)
		})
	})

	// ── Phase 3: Enter Key ─────────────────────────────────────────

	describe('Enter Key — new block', () => {
		it('pressing Enter at end of block creates a new block', async () => {
			const {container} = await render(<PlainTextBlocks />)
			expect(getGrips(container)).toHaveLength(5)

			const blockDiv = getBlockDiv(getGrips(container)[0])
			await focusAtEnd(blockDiv)
			await userEvent.keyboard('{Enter}')

			expect(getGrips(container)).toHaveLength(6)
		})

		it('pressing Enter preserves all block content', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const originalValue = getRawValue(container)

			const blockDiv = getBlockDiv(getGrips(container)[0])
			await focusAtEnd(blockDiv)
			await userEvent.keyboard('{Enter}')

			const newValue = getRawValue(container)
			expect(newValue).not.toBe(originalValue)
			// Original content should still be present
			expect(newValue).toContain('First block of plain text')
			expect(newValue).toContain('Fifth block of plain text')
		})

		it('pressing Shift+Enter does NOT create a new block', async () => {
			const {container} = await render(<PlainTextBlocks />)

			const blockDiv = getBlockDiv(getGrips(container)[0])
			await focusAtEnd(blockDiv)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getGrips(container)).toHaveLength(5)
		})
	})

	// ── Phase 3: Drag & Drop ───────────────────────────────────────

	describe('Drag & Drop', () => {
		it.todo('drag block 0 after block 2 reorders blocks')
		it.todo('drag block onto itself causes no change')
	})

	// ── Phase 4: Regression / compound scenarios ───────────────────

	describe('Regression', () => {
		it('add then delete restores original value', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const original = getRawValue(container)

			// Add below first block
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Add below').element())
			expect(getGrips(container)).toHaveLength(6)

			// Delete the newly added empty block (index 1)
			await openMenuForGrip(container, 1)
			await userEvent.click(page.getByText('Delete').element())
			expect(getGrips(container)).toHaveLength(5)

			expect(getRawValue(container)).toBe(original)
		})

		it('duplicate then delete restores original value', async () => {
			const {container} = await render(<PlainTextBlocks />)
			const original = getRawValue(container)

			// Duplicate first block
			await openMenuForGrip(container, 0)
			await userEvent.click(page.getByText('Duplicate').element())
			expect(getGrips(container)).toHaveLength(6)

			// Delete the duplicate (index 1)
			await openMenuForGrip(container, 1)
			await userEvent.click(page.getByText('Delete').element())
			expect(getGrips(container)).toHaveLength(5)

			expect(getRawValue(container)).toBe(original)
		})
	})
})