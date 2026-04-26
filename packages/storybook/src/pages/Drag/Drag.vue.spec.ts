// oxlint-disable typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-call
import {MarkedInput} from '@markput/vue'
import type {Markup, Option} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h} from 'vue'

import {firstChild, getActiveElement, getElement} from '../../shared/lib/dom'
import {
	dispatchPaste,
	getAllRows,
	getBlocks,
	getEditableInRow,
	openMenuForRow,
	simulateDragRow,
} from '../../shared/lib/dragTestHelpers'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as DragStories from './Drag.vue.stories'

const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)

const PLAIN_TEXT_VALUE =
	'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text\n\n'

const ParagraphMark = defineComponent({
	props: {value: String, children: {type: null}},
	setup(props, {slots}) {
		return () => h('span', {}, slots.default?.() ?? props.value)
	},
})

// oxlint-disable-next-line no-unsafe-type-assertion
const paragraphOptions: Option[] = [{markup: '__slot__\n\n' as Markup, Mark: ParagraphMark}]

const UncontrolledPlainTextDrag = defineComponent({
	setup() {
		return () =>
			h(MarkedInput, {
				Mark: ParagraphMark,
				options: paragraphOptions,
				defaultValue: PLAIN_TEXT_VALUE,
				layout: 'block',
				draggable: true,
				style: {marginLeft: '64px'},
			})
	},
})

const TestMark = defineComponent({
	props: {value: String},
	setup(props) {
		return () => h('mark', {'data-testid': 'mark'}, props.value)
	},
})

function ControlledDragNoEcho(onChange: (value: string) => void) {
	return defineComponent({
		setup() {
			return () =>
				h(MarkedInput, {
					Mark: TestMark,
					value: 'hello @[world](1)\n\nfoo',
					onChange,
					layout: 'block',
					draggable: true,
					style: {marginLeft: '64px'},
				})
		},
	})
}

function getRawValue(container: Element) {
	return container.querySelector('pre')!.textContent
}

describe('Feature: drag rows', () => {
	it('render 5 rows for PlainTextDrag', async () => {
		const {container} = await render(PlainTextDrag)
		expect(getAllRows(container)).toHaveLength(5)
	})

	it('render 4 rows for MarkdownDrag', async () => {
		const {container} = await render(MarkdownDrag)
		expect(getAllRows(container)).toHaveLength(4)
	})

	it('render no grip buttons in read-only mode', async () => {
		const {container} = await render(ReadOnlyDrag)
		const rows = getAllRows(container)
		await userEvent.hover(rows[0])
		await expect
			.element(page.getByRole('button', {name: 'Drag to reorder or click for options'}))
			.not.toBeInTheDocument()
	})

	it('render content in read-only mode', async () => {
		await render(ReadOnlyDrag)
		await expect.element(page.getByText(/Read-Only/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section A/).first()).toBeInTheDocument()
		await expect.element(page.getByText(/Section B/).first()).toBeInTheDocument()
	})

	describe('menu', () => {
		it('open with Add below, Duplicate, Delete options', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)

			await expect.element(page.getByText('Add below')).toBeInTheDocument()
			await expect.element(page.getByText('Duplicate')).toBeInTheDocument()
			await expect.element(page.getByText('Delete')).toBeInTheDocument()
		})

		it('close on Escape', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.keyboard('{Escape}')
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})

		it('close when clicking outside', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await expect.element(page.getByText('Add below')).toBeInTheDocument()

			await userEvent.click(firstChild(container)!)
			await expect.element(page.getByText('Add below')).not.toBeInTheDocument()
		})
	})

	describe('add row', () => {
		it('increase row count by 1 when adding below first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('keeps controlled row unchanged after adding below until value is echoed', async () => {
			const onChange = vi.fn()
			const {container} = await render(ControlledDragNoEcho(onChange))
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const rows = getAllRows(container)
			expect(onChange).toHaveBeenCalled()
			expect(container.textContent).toContain('world')
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
		})

		it('increase row count by 1 when adding below middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('increase row count by 1 when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('insert an empty row between the target and next row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text\n\n\n\nSecond block of plain text')
		})

		it('not create a trailing separator when adding below last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Add below')))

			const raw = getRawValue(container)
			expect(raw.endsWith('\n\n\n\n\n\n')).toBe(false)
		})

		it('result in a single empty row when all rows are deleted', async () => {
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
		it('decrease count by 1 when deleting middle row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 2)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
		})

		it('keeps controlled row unchanged after deleting until value is echoed', async () => {
			const onChange = vi.fn()
			const {container} = await render(ControlledDragNoEcho(onChange))
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			const rows = getAllRows(container)
			expect(onChange).toHaveBeenCalled()
			expect(container.textContent).toContain('world')
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
		})

		it('preserve remaining content when deleting first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Second block of plain text')
		})

		it('decrease count by 1 when deleting last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Delete')))

			expect(getAllRows(container)).toHaveLength(4)
			expect(getRawValue(container)).toContain('Fourth block of plain text')
			expect(getRawValue(container)).not.toContain('Fifth block of plain text')
		})

		it('result in empty value when deleting the last remaining row', async () => {
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
		it('increase count by 1 when duplicating first row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('keeps controlled row unchanged after duplicating until value is echoed', async () => {
			const onChange = vi.fn()
			const {container} = await render(ControlledDragNoEcho(onChange))
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const rows = getAllRows(container)
			expect(onChange).toHaveBeenCalled()
			expect(container.textContent).toContain('world')
			expect(rows[0].textContent).toContain('hello ')
			expect(rows[1].textContent).toContain('world')
			expect(rows[2].textContent).toContain('foo')
		})

		it('create a copy with the same text content', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			const matches = getRawValue(container).match(/First block of plain text/g)
			expect(matches).toHaveLength(2)
		})

		it('increase count by 1 when duplicating last row', async () => {
			const {container} = await render(PlainTextDrag)
			await openMenuForRow(container, 4)
			await userEvent.click(getElement(page.getByText('Duplicate')))

			expect(getAllRows(container)).toHaveLength(6)
		})
	})

	describe('enter key', () => {
		it('create a new row when pressing Enter at end of text row', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getAllRows(container)).toHaveLength(5)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('preserve all row content after pressing Enter', async () => {
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

		it('not create a new row when pressing Shift+Enter', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

			expect(getAllRows(container)).toHaveLength(5)
		})
	})

	describe('drag & drop', () => {
		it('reorder rows when dragging row 0 after row 2', async () => {
			const {container} = await render(PlainTextDrag)

			await simulateDragRow(container, 0, 2)

			const raw = getRawValue(container)
			expect(raw.indexOf('First block of plain text')).toBeGreaterThan(raw.indexOf('Third block of plain text'))
		})

		it('not change order when dragging row onto itself', async () => {
			const {container} = await render(PlainTextDrag)
			const original = getRawValue(container)

			await simulateDragRow(container, 1, 1)

			expect(getRawValue(container)).toBe(original)
		})
	})

	describe('backspace on empty row', () => {
		it('delete the row and reduce count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			await openMenuForRow(container, 0)
			await userEvent.click(getElement(page.getByText('Add below')))
			expect(getAllRows(container)).toHaveLength(6)

			const newRow = getAllRows(container)[1]
			newRow.focus()
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})

		it('not delete a non-empty row on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			const editable = getEditableInRow(getAllRows(container)[0])
			await focusAtEnd(editable)
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(5)
		})
	})

	it('focus a row after Add below', async () => {
		const {container} = await render(UncontrolledPlainTextDrag)
		await openMenuForRow(container, 0)
		await userEvent.click(getElement(page.getByText('Add below')))

		const activeEl = getActiveElement()
		expect(activeEl.closest('[class*="Container"]')).toBeTruthy()
	})

	it('split row at caret when pressing Enter at the beginning', async () => {
		const {container} = await render(PlainTextDrag)
		const editable = getEditableInRow(getAllRows(container)[0])
		await focusAtStart(editable)
		await userEvent.keyboard('{Enter}')

		expect(getAllRows(container)).toHaveLength(6)
		expect(getRawValue(container)).toContain('First block of plain text')
	})

	it('restore original value after add then delete', async () => {
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

	it('restore original value after duplicate then delete', async () => {
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
		it('move focus to previous row when at start of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross to previous row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowLeft}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowRight cross-row', () => {
		it('move focus to next row when at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross to next row when caret is mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowRight}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowRight}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowDown cross-row', () => {
		it('move focus to next row when on last line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtEnd(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowDown}')

			expect(rows[1].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the last row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const last = rows[rows.length - 1]

			await focusAtEnd(getEditableInRow(last))
			await userEvent.keyboard('{ArrowDown}')

			expect(last.contains(document.activeElement)).toBe(true)
		})
	})

	describe('ArrowUp cross-row', () => {
		it('move focus to previous row when on first line of row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[1]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})

		it('not cross row boundary from the first row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			await focusAtStart(getEditableInRow(rows[0]))
			await userEvent.keyboard('{ArrowUp}')

			expect(rows[0].contains(document.activeElement)).toBe(true)
		})
	})

	describe('Backspace merge rows (text+text)', () => {
		it('merge with previous text row when Backspace pressed at start of non-empty row', async () => {
			const {container} = await render(PlainTextDrag)
			const before = getAllRows(container).length

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(before - 1)
		})

		describe('Backspace at start of text row after a mark row (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Backspace at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('move focus to the mark row on Backspace at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Backspace}')

				expect(markBlock.contains(document.activeElement)).toBe(true)
			})
		})

		it('preserve content of both merged rows', async () => {
			const {container} = await render(PlainTextDrag)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const raw = getRawValue(container)
			expect(raw).toContain('First block of plain text')
			expect(raw).toContain('Second block of plain text')
		})

		it('keep focus in the previous row after merge', async () => {
			const {container} = await render(UncontrolledPlainTextDrag)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			const currentRows = getAllRows(container)
			expect(currentRows[0].contains(document.activeElement)).toBe(true)
		})

		it('only delete one row at a time on Backspace', async () => {
			const {container} = await render(PlainTextDrag)
			expect(getAllRows(container)).toHaveLength(5)

			await focusAtStart(getEditableInRow(getAllRows(container)[1]))
			await userEvent.keyboard('{Backspace}')

			expect(getAllRows(container)).toHaveLength(4)
		})
	})

	describe('Delete merge rows', () => {
		describe('Delete at end of row', () => {
			it('merge with next row when Delete pressed at end of non-last row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getAllRows(container).length

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before - 1)
			})

			it('preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('keep focus in the current row after Delete merge', async () => {
				const {container} = await render(UncontrolledPlainTextDrag)

				await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				const currentRows = getAllRows(container)
				expect(currentRows[0].contains(document.activeElement)).toBe(true)
			})

			it('not merge when Delete pressed at end of last row', async () => {
				const {container} = await render(PlainTextDrag)
				const rows = getAllRows(container)
				const last = rows[rows.length - 1]

				await focusAtEnd(getEditableInRow(last))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(5)
			})
		})

		describe('Delete at start of row', () => {
			it('merge current row into previous when Delete pressed at start of non-first row', async () => {
				const {container} = await render(PlainTextDrag)
				const before = getAllRows(container).length

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(before - 1)
			})

			it('preserve content of both merged rows', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain text')
				expect(raw).toContain('Second block of plain text')
			})

			it('move focus to the previous row after merge', async () => {
				const {container} = await render(UncontrolledPlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const currentRows = getAllRows(container)
				expect(currentRows[0].contains(document.activeElement)).toBe(true)
			})

			it('not merge when Delete pressed at start of the first row', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[0]))
				await userEvent.keyboard('{Delete}')

				expect(getAllRows(container)).toHaveLength(5)
			})

			it('place caret at the join point after merge', async () => {
				const {container} = await render(PlainTextDrag)

				await focusAtStart(getEditableInRow(getAllRows(container)[1]))
				await userEvent.keyboard('{Delete}')

				const raw = getRawValue(container)
				expect(raw).toContain('First block of plain textSecond block of plain text')
			})
		})

		describe('Delete at mark→text boundary (navigate-only in drag mode)', () => {
			it('NOT reduce row count when Delete at start of text row after mark row', async () => {
				const {container} = await render(MarkdownDrag)
				const before = getBlocks(container).length

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(getBlocks(container)).toHaveLength(before)
			})

			it('move focus to mark row on Delete at mark boundary', async () => {
				const {container} = await render(MarkdownDrag)
				const markBlock = getBlocks(container)[0]

				await focusAtStart(getEditableInRow(getBlocks(container)[1]))
				await userEvent.keyboard('{Delete}')

				expect(markBlock.contains(document.activeElement)).toBe(true)
			})
		})
	})

	describe('typing in rows', () => {
		it('update raw value when typing a character at end of row', async () => {
			const {container} = await render(PlainTextDrag)
			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('!')

			expect(getRawValue(container)).toContain('First block of plain text!')
		})

		it('update raw value when deleting a character with Backspace mid-row', async () => {
			const {container} = await render(PlainTextDrag)
			await focusAtEnd(getEditableInRow(getAllRows(container)[0]))
			await userEvent.keyboard('{Backspace}')

			expect(getRawValue(container)).toContain('First block of plain tex')
			expect(getRawValue(container)).not.toContain('First block of plain text\n\n')
		})

		it('not wipe all rows when Ctrl+A in focused row then typing', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)

			getEditableInRow(rows[1]).focus()
			await userEvent.keyboard('{Control>}a{/Control}')
			await userEvent.keyboard('X')

			expect(getRawValue(container)).not.toBe('X')
			expect(getRawValue(container)).toContain('First block of plain text')
		})

		it('ignores beforeinput inside a drag control', async () => {
			const {container} = await render(PlainTextDrag)
			const before = getRawValue(container)
			const row = getAllRows(container)[0]
			await userEvent.hover(row)
			const handle = await page
				.elementLocator(row)
				.getByRole('button', {name: 'Drag to reorder or click for options'})
				.findElement()

			await userEvent.click(handle)
			await userEvent.keyboard('x')

			expect(getRawValue(container)).toBe(before)
		})

		it('append character after last mark when typing at end of mark row', async () => {
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInRow(blocks[0]))
			await userEvent.keyboard('!')

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})

		it.todo('insert character at correct position mid-text within a mark row')
	})

	describe('paste in rows', () => {
		it('update raw value when pasting text at end of a plain text row', async () => {
			const {container} = await render(PlainTextDrag)
			const rows = getAllRows(container)
			const editable = getEditableInRow(rows[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, ' pasted')
			await expect.element(page.getByText(/First block of plain text pasted/).first()).toBeInTheDocument()

			expect(getRawValue(container)).toContain('First block of plain text pasted')
		})

		it('not affect other rows when pasting in one row', async () => {
			const {container} = await render(PlainTextDrag)
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
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			const editable = getEditableInRow(blocks[0])
			await focusAtEnd(editable)
			dispatchPaste(editable, '!')
			await expect.element(page.getByText('# Welcome to Draggable Blocks!').first()).toBeInTheDocument()

			const block0Raw = getRawValue(container).split('\n\n')[0]
			expect(block0Raw).toBe('# Welcome to Draggable Blocks!')
		})
	})

	describe('Enter mid-row split', () => {
		it('increase row count by 1', async () => {
			const {container} = await render(PlainTextDrag)

			const editable = getEditableInRow(getAllRows(container)[0])
			await userEvent.click(editable)
			await userEvent.keyboard('{Home}')
			await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
			await userEvent.keyboard('{Enter}')

			expect(getAllRows(container)).toHaveLength(6)
		})

		it('put text before caret in current row', async () => {
			const {container} = await render(PlainTextDrag)

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
			const {container} = await render(PlainTextDrag)

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
			const {container} = await render(MarkdownDrag)
			const blocks = getBlocks(container)
			await focusAtEnd(getEditableInRow(blocks[0]))
			await userEvent.keyboard('{Enter}')

			const raw = getRawValue(container)
			expect(raw).toContain('# Welcome to Draggable Blocks\n\n')
		})
	})
})