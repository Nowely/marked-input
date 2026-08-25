import {describe, expect, it, vi} from 'vitest'
import {userEvent} from 'vitest/browser'

import {rowsOf} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * Nesting, driven through the DOM in both adapters. Framework-free on purpose: the two `Rows`
 * implementations paint the same sibling list through the same core resolver, so a divergence
 * between them is a failing test here rather than a difference nobody diffs.
 *
 * THE ORDER IS THE POINT. Every case here nests a row AT RUNTIME and only then types into it. A
 * spec that mounts an already-nested document passes against an add-only editable-state climb —
 * the row that gains children after mount is the one whose new host the climb froze.
 */
const BLOCK = {separator: '\n', indent: '\t', Mark} as const

describe('nested rows', () => {
	it('mounts a nested document with the child row inside its parent', async () => {
		const {host} = await mountComponent({value: 'alpha\n\tbeta', ...BLOCK})

		const roots = rowsOf(host)
		expect(roots).toHaveLength(1)
		expect(roots[0].textContent).toBe('alphabeta')
		// The child is INSIDE the parent's element — that is the whole claim, and the lead never
		// reaches the document.
		expect(roots[0].querySelector('[class*="Block"]')?.textContent).toBe('beta')
	})

	it('nests a row at RUNTIME and then types into it', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: 'alpha\nbeta', ...BLOCK, onChange})
		expect(rowsOf(host)).toHaveLength(2)

		// The indent is written as ordinary text at the row's own start, which is what makes it a
		// lead. Dispatched rather than typed because Tab leaves the field (ADR-0002) and its
		// keymap is not this phase's.
		await focusAtStart(rowsOf(host)[1])
		dispatchInsertText(host, '\t')

		await expect.poll(() => rowsOf(host)).toHaveLength(1)
		expect(onChange).toHaveBeenLastCalledWith('alpha\n\tbeta')

		// AND THEN TYPE. Real keystrokes, so Chromium decides whether the newly mounted rows host
		// is editable at all — a dispatched `beforeinput` would land in a frozen host just as
		// happily and pin nothing.
		const nested = rowsOf(host)[0].querySelector('[class*="Block"]')
		if (!(nested instanceof HTMLElement)) throw new Error('expected a nested row element')
		await focusAtEnd(nested)
		await userEvent.keyboard('X')

		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('alpha\n\tbetaX')
	})

	it('outdents a row at RUNTIME and then types into it', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: 'alpha\n\tbeta', ...BLOCK, onChange})
		expect(rowsOf(host)).toHaveLength(1)

		const nested = rowsOf(host)[0].querySelector('[class*="Block"]')
		if (!(nested instanceof HTMLElement)) throw new Error('expected a nested row element')
		// Backspace at the nested row's first caret position takes the boundary — the separator
		// AND the lead — so the two rows merge rather than the indent surviving as text.
		await focusAtStart(nested)
		await userEvent.keyboard('{Backspace}')

		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('alphabeta')
		await expect.poll(() => rowsOf(host)).toHaveLength(1)

		await userEvent.keyboard('Y')
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('alphaYbeta')
	})
})