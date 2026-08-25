import {describe, expect, it, vi} from 'vitest'
import {userEvent} from 'vitest/browser'

import {rowsOf} from '../../shared/lib/dom'
import {focusAtStart} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {composePage, mountComponent, mountEcho} from '../../shared/lib/page'
import {rows} from './Base.fixtures'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

/**
 * THE ROW KEYMAP through real keystrokes, in both adapters. Framework-free on purpose: the two
 * adapters paint rows through the same core resolver and the same keymap, so a divergence between
 * them is a failing test here rather than a difference nobody diffs.
 *
 * The value at EVERY step, not only at the end: a keymap that reaches the right document by the
 * wrong route — an extra empty row that the next keystroke happens to fill, a caret left in the
 * row above — passes an end-state assertion and fails a user.
 *
 * Real keys rather than dispatched input events, and that is the whole reason this spec is in the
 * browser: Tab and Enter have BROWSER defaults (focus moves, the host is split into `<div>`s), and
 * only a real keystroke can tell whether the keymap cancelled them.
 */
const BLOCK = {separator: '\n', indent: '\t', Mark} as const
/** A list item: it continues on Enter and it indents on Tab, which is every arm this page drives. */
const BULLET = {markup: '- __slot__' as const, row: {Component: rows.Bullet, continues: true, indents: true}}

describe('the row keymap', () => {
	it('types `- a⏎b⇥c⏎⏎` and lands a nested list', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: '', ...BLOCK, options: [BULLET], onChange})
		const emitted = () => onChange.mock.lastCall?.[0]

		await focusAtStart(rowsOf(host)[0])

		// The opener is typed like any other text, and the row takes its kind the moment it
		// matches — from there the `- ` is structural and the caret sits past it.
		await userEvent.keyboard('- a')
		await expect.poll(emitted).toBe('- a')
		expect(host.querySelector('li')?.textContent).toBe('a')

		// Enter at the end of a row whose kind CONTINUES opens another row of that kind.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n- ')
		expect(rowsOf(host)).toHaveLength(2)

		// And the caret is inside the fresh row's body: the next character lands there.
		await userEvent.keyboard('b')
		await expect.poll(emitted).toBe('- a\n- b')

		// Tab re-indents, because the kind declares `indents`. The two rows become one root.
		await userEvent.keyboard('{Tab}')
		await expect.poll(emitted).toBe('- a\n\t- b')
		await expect.poll(() => rowsOf(host)).toHaveLength(1)

		// AND THEN TYPE, into the row that was just nested: a spec that stops at the value would
		// pass against a nested row the editing host has frozen.
		await userEvent.keyboard('c')
		await expect.poll(emitted).toBe('- a\n\t- bc')

		// Enter at the end of the NESTED row keeps both the kind and the depth.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n\t- bc\n\t- ')

		// Enter on the empty row it just opened gives up the DEPTH before the kind, which is how a
		// nested list is left one level at a time.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n\t- bc\n- ')
	})

	/**
	 * The soft break, which under one line per row is a CHILD ROW with no kind: the continuation
	 * belongs to the row it was typed in, so it travels with it and renders inside its component.
	 */
	it('opens a continuation line on Shift+Enter and types into it', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: '- a', ...BLOCK, options: [BULLET], onChange})
		const emitted = () => onChange.mock.lastCall?.[0]

		await focusAtStart(rowsOf(host)[0])
		await userEvent.keyboard('{End}')
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(emitted).toBe('- a\n\t')

		await userEvent.keyboard('second line')
		await expect.poll(emitted).toBe('- a\n\tsecond line')

		// One ROOT, and the continuation is painted inside the bullet's own element rather than
		// beside it.
		expect(rowsOf(host)).toHaveLength(1)
		expect(host.querySelector('li [class*="Block"]')?.textContent).toBe('second line')
	})

	/**
	 * CONTROLLED, which is the mode the whole seam is designed around and the reason the
	 * continuation is ONE splice: a commit there emits and waits for the echo, so the tree has not
	 * moved when a verb returns, and a second verb in the same tick would address the document as
	 * it was. A soft break composed of a split and a re-indent passes uncontrolled and fails here.
	 */
	it('opens the continuation in CONTROLLED mode too', async () => {
		const {host, value} = await mountEcho(Default, {...BLOCK, options: [BULLET], value: '- a'})

		await focusAtStart(rowsOf(host)[0])
		await userEvent.keyboard('{End}')
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(value).toBe('- a\n\t')

		await userEvent.keyboard('x')
		await expect.poll(value).toBe('- a\n\tx')
	})
})