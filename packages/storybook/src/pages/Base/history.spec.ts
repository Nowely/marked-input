import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {editingHost, getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset, moveDomCaret, verifyCaretPosition} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
import {composePage, mount, mountEcho} from '../../shared/lib/page'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

/** No mark and nothing repeated, so `getByText` names exactly one surface to type into. */
const VALUE = 'Undo me'

/** One task, which is what `selectionchange` costs: after it the editor holds what the DOM holds. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

const undo = () => userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
const redo = () => userEvent.keyboard('{Shift>}{ControlOrMeta>}z{/ControlOrMeta}{/Shift}')

/**
 * The keys, driven for real, in BOTH adapters — the core suite drives the same arms through
 * synthesised events, and what this adds is the wiring: the prop reaching the model, and the
 * container's own listener answering a key Chromium delivered.
 */
describe('API: history', () => {
	it('undoes a typed run on Mod+Z and redoes it on Shift+Mod+Z', async () => {
		const onChange = vi.fn()
		await mount(Default, {defaultValue: VALUE, onChange})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('XY')
		expect(onChange).toHaveBeenLastCalledWith('Undo meXY')

		// One entry for the run, so one press takes both characters.
		await undo()
		expect(onChange).toHaveBeenLastCalledWith(VALUE)

		await redo()
		expect(onChange).toHaveBeenLastCalledWith('Undo meXY')
	})

	it('undoes through the parent, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('X')
		expect(value()).toBe('Undo meX')

		await undo()
		expect(value()).toBe(VALUE)
		expect(host.textContent).toBe(VALUE)
	})

	/**
	 * An undo restores the CARET the edit was made from, and only a browser can say whether it
	 * does: core's own `HistoryModel` spec asserts the restored offsets against core's selection
	 * state, which is the very reading these two show can be a task out of date.
	 *
	 * `moveDomCaret` leaves the editor un-told on purpose — see its own note. The edit that
	 * follows is committed against the DOM's caret, so that is the caret the entry names and the
	 * one the undo has to put back.
	 */
	it('restores the caret the undone edit was made from', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: VALUE, onChange})
		await focusAtOffset(getElement(page.getByText(VALUE)), 0)
		await settle()

		moveDomCaret(getElement(page.getByText(VALUE)), 4)
		dispatchInsertText(editingHost(host), 'X')
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('UndoX me')

		await undo()
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe(VALUE)
		verifyCaretPosition(host, 4)
	})

	it('restores it through the parent too, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE})
		await focusAtOffset(getElement(page.getByText(VALUE)), 0)
		await settle()

		moveDomCaret(getElement(page.getByText(VALUE)), 4)
		dispatchInsertText(editingHost(host), 'X')
		await expect.poll(value).toBe('UndoX me')

		await undo()
		await expect.poll(value).toBe(VALUE)
		verifyCaretPosition(host, 4)
	})

	it('leaves the keys inert with `history` off', async () => {
		const onChange = vi.fn()
		await mount(Default, {defaultValue: VALUE, history: false, onChange})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('X')
		expect(onChange).toHaveBeenLastCalledWith('Undo meX')

		await undo()
		expect(onChange).toHaveBeenLastCalledWith('Undo meX')
	})
})